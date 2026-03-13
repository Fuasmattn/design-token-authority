/**
 * TICKET-017: Token alias dependency graph.
 *
 * Builds a directed graph of all alias references across token files,
 * detects circular references, dangling aliases, and orphaned tokens,
 * and reports maximum alias chain depth.
 */

import * as fs from 'fs'
import * as path from 'path'
import { Token, TokenOrTokenGroup, TokensFile } from './token_types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  /** Fully qualified token ID: "CollectionName.ModeName/Group/SubGroup/Token" */
  id: string
  /** Collection + mode filename (without .json) */
  file: string
  /** Dot-separated path within the file */
  path: string[]
  /** Token type ($type) */
  type: string
  /** Raw $value */
  value: string | number | boolean
  /** If this token is an alias, the resolved target ID (dot-notation from $value) */
  aliasTarget: string | null
}

export interface GraphEdge {
  from: string
  to: string
}

export interface CycleInfo {
  /** Nodes forming the cycle, e.g. ["A", "B", "C", "A"] */
  path: string[]
}

export interface DanglingAlias {
  /** The token that references a missing target */
  sourceId: string
  /** The file this token lives in */
  sourceFile: string
  /** The alias reference string from $value, e.g. "{Colors.Foundation.Focus.Default}" */
  rawAlias: string
  /** The normalized target ID that was not found */
  targetId: string
}

export interface TokenGraph {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
  cycles: CycleInfo[]
  danglingAliases: DanglingAlias[]
  orphanedTokens: string[]
  maxChainDepth: number
  chainDepths: Map<string, number>
}

export interface GraphStats {
  totalTokens: number
  aliasTokens: number
  aliasPercentage: number
  maxChainDepth: number
  circularRefs: number
  danglingAliases: number
  orphanedTokens: number
  fileCount: number
  tokensByFile: Map<string, number>
  tokensByType: Map<string, number>
}

// ---------------------------------------------------------------------------
// Token file reading (reuses patterns from token_import.ts)
// ---------------------------------------------------------------------------

function isAlias(value: unknown): value is string {
  return typeof value === 'string' && value.trim().startsWith('{') && value.trim().endsWith('}')
}

/** Extract the dot-notation target from an alias value like "{Colors.Brand.Primary}" */
function extractAliasTarget(value: string): string {
  return value.trim().replace(/[{}]/g, '')
}

function flattenTokensFile(
  tokensFile: TokensFile,
): { tokenName: string; token: Token; path: string[] }[] {
  const result: { tokenName: string; token: Token; path: string[] }[] = []

  function traverse(key: string, object: TokenOrTokenGroup, pathParts: string[]) {
    if (key.startsWith('$')) return

    if (object.$value !== undefined) {
      result.push({
        tokenName: key,
        token: object as Token,
        path: pathParts,
      })
    } else {
      Object.entries<TokenOrTokenGroup>(object).forEach(([childKey, childObj]) => {
        if (!childKey.startsWith('$') && typeof childObj === 'object') {
          traverse(`${key}/${childKey}`, childObj, [...pathParts, childKey])
        }
      })
    }
  }

  Object.entries(tokensFile).forEach(([groupKey, groupValue]) => {
    traverse(groupKey, groupValue, [groupKey])
  })

  return result
}

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

export function readTokenFilesForGraph(tokensDir: string): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>()
  const files = fs
    .readdirSync(tokensDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(tokensDir, f))

  for (const filePath of files) {
    const baseFileName = path.basename(filePath)
    const fileLabel = baseFileName.replace(/\.json$/, '')
    const content = fs.readFileSync(filePath, 'utf-8')
    if (!content.trim()) continue

    const tokensFile: TokensFile = JSON.parse(content)
    const flattened = flattenTokensFile(tokensFile)

    for (const { tokenName, token, path: tokenPath } of flattened) {
      // Token IDs use slash-separated names (matching Figma convention in the file)
      // The alias targets use dot-notation — we normalize aliases to slash-separated for matching
      const nodeId = `${fileLabel}/${tokenName}`

      let aliasTarget: string | null = null
      if (isAlias(token.$value)) {
        aliasTarget = extractAliasTarget(token.$value as string)
      }

      nodes.set(nodeId, {
        id: nodeId,
        file: fileLabel,
        path: tokenPath,
        type: token.$type,
        value: token.$value,
        aliasTarget,
      })
    }
  }

  return nodes
}

/**
 * Resolve an alias target (dot-notation like "Colors.Brand.Primary") to a node ID
 * by searching across all nodes. Alias targets are file-agnostic — they match
 * against the token name portion (slash-separated) of any node.
 */
function resolveAliasTarget(target: string, nodes: Map<string, GraphNode>): string | null {
  // Convert dot-notation to slash-separated for matching
  const slashTarget = target.replace(/\./g, '/')

  // Search all nodes for a matching token name suffix
  for (const [nodeId, node] of nodes) {
    // The token name within the file is the part after "FileLabel/"
    const tokenNameInFile = nodeId.slice(node.file.length + 1)
    if (tokenNameInFile === slashTarget) {
      return nodeId
    }
  }

  return null
}

export function buildGraph(nodes: Map<string, GraphNode>): TokenGraph {
  const edges: GraphEdge[] = []
  const danglingAliases: DanglingAlias[] = []
  const referencedNodes = new Set<string>()

  // Build edges from alias references
  for (const [nodeId, node] of nodes) {
    if (node.aliasTarget) {
      const resolvedTarget = resolveAliasTarget(node.aliasTarget, nodes)

      if (resolvedTarget) {
        edges.push({ from: nodeId, to: resolvedTarget })
        referencedNodes.add(resolvedTarget)
      } else {
        danglingAliases.push({
          sourceId: nodeId,
          sourceFile: node.file,
          rawAlias: `{${node.aliasTarget}}`,
          targetId: node.aliasTarget,
        })
      }
    }
  }

  // Detect cycles using DFS
  const cycles = detectCycles(nodes, edges)

  // Find orphaned tokens (defined but never referenced by any alias)
  // Primitives/raw values that nobody aliases to
  const orphanedTokens: string[] = []
  for (const [nodeId, node] of nodes) {
    if (!node.aliasTarget && !referencedNodes.has(nodeId)) {
      orphanedTokens.push(nodeId)
    }
  }

  // Compute chain depths
  const { maxDepth, depths } = computeChainDepths(nodes, edges)

  return {
    nodes,
    edges,
    cycles,
    danglingAliases,
    orphanedTokens,
    maxChainDepth: maxDepth,
    chainDepths: depths,
  }
}

// ---------------------------------------------------------------------------
// Cycle detection (DFS with in-stack tracking)
// ---------------------------------------------------------------------------

function detectCycles(nodes: Map<string, GraphNode>, edges: GraphEdge[]): CycleInfo[] {
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, [])
    adjacency.get(edge.from)!.push(edge.to)
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()
  const cycles: CycleInfo[] = []
  const pathStack: string[] = []

  function dfs(nodeId: string) {
    if (inStack.has(nodeId)) {
      // Found a cycle — extract the cycle path from the stack
      const cycleStart = pathStack.indexOf(nodeId)
      const cyclePath = [...pathStack.slice(cycleStart), nodeId]
      cycles.push({ path: cyclePath })
      return
    }
    if (visited.has(nodeId)) return

    visited.add(nodeId)
    inStack.add(nodeId)
    pathStack.push(nodeId)

    const neighbors = adjacency.get(nodeId) || []
    for (const neighbor of neighbors) {
      dfs(neighbor)
    }

    pathStack.pop()
    inStack.delete(nodeId)
  }

  for (const nodeId of nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId)
    }
  }

  return cycles
}

// ---------------------------------------------------------------------------
// Chain depth computation
// ---------------------------------------------------------------------------

function computeChainDepths(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
): { maxDepth: number; depths: Map<string, number> } {
  const adjacency = new Map<string, string>()
  for (const edge of edges) {
    adjacency.set(edge.from, edge.to) // Each alias has exactly one target
  }

  const depths = new Map<string, number>()
  const computing = new Set<string>()

  function getDepth(nodeId: string): number {
    if (depths.has(nodeId)) return depths.get(nodeId)!
    if (computing.has(nodeId)) return 0 // Break cycles

    computing.add(nodeId)
    const target = adjacency.get(nodeId)
    const depth = target ? 1 + getDepth(target) : 0
    computing.delete(nodeId)
    depths.set(nodeId, depth)
    return depth
  }

  let maxDepth = 0
  for (const nodeId of nodes.keys()) {
    const d = getDepth(nodeId)
    if (d > maxDepth) maxDepth = d
  }

  return { maxDepth, depths }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function computeStats(graph: TokenGraph): GraphStats {
  const tokensByFile = new Map<string, number>()
  const tokensByType = new Map<string, number>()
  let aliasCount = 0

  for (const node of graph.nodes.values()) {
    tokensByFile.set(node.file, (tokensByFile.get(node.file) || 0) + 1)
    tokensByType.set(node.type, (tokensByType.get(node.type) || 0) + 1)
    if (node.aliasTarget) aliasCount++
  }

  return {
    totalTokens: graph.nodes.size,
    aliasTokens: aliasCount,
    aliasPercentage: graph.nodes.size > 0 ? Math.round((aliasCount / graph.nodes.size) * 100) : 0,
    maxChainDepth: graph.maxChainDepth,
    circularRefs: graph.cycles.length,
    danglingAliases: graph.danglingAliases.length,
    orphanedTokens: graph.orphanedTokens.length,
    fileCount: tokensByFile.size,
    tokensByFile,
    tokensByType,
  }
}

// ---------------------------------------------------------------------------
// Console report formatting
// ---------------------------------------------------------------------------

export function formatConsoleReport(graph: TokenGraph, stats: GraphStats): string {
  const lines: string[] = []

  lines.push('Token Dependency Graph')
  lines.push('─'.repeat(50))
  lines.push('')
  lines.push(`  Total tokens:       ${stats.totalTokens.toLocaleString()}`)
  lines.push(
    `  Alias tokens:       ${stats.aliasTokens.toLocaleString()}  (${stats.aliasPercentage}%)`,
  )
  lines.push(`  Max chain depth:    ${stats.maxChainDepth}`)
  lines.push(`  Circular refs:      ${stats.circularRefs}`)
  lines.push(
    `  Dangling aliases:   ${stats.danglingAliases}${stats.danglingAliases > 0 ? '  ⚠' : ''}`,
  )
  lines.push(
    `  Orphaned tokens:    ${stats.orphanedTokens}${stats.orphanedTokens > 0 ? '  ℹ' : ''}`,
  )
  lines.push('')

  // Tokens by file
  lines.push('  Tokens by file:')
  for (const [file, count] of stats.tokensByFile) {
    lines.push(`    ${file}: ${count}`)
  }
  lines.push('')

  // Tokens by type
  lines.push('  Tokens by type:')
  for (const [type, count] of stats.tokensByType) {
    lines.push(`    ${type}: ${count}`)
  }

  // Dangling aliases detail
  if (graph.danglingAliases.length > 0) {
    lines.push('')
    lines.push('⚠ Dangling aliases:')
    for (const da of graph.danglingAliases) {
      lines.push(`  ${da.sourceFile} > ${da.sourceId.slice(da.sourceFile.length + 1)}`)
      lines.push(`    → ${da.rawAlias} — not found in any token file`)
    }
  }

  // Circular references detail
  if (graph.cycles.length > 0) {
    lines.push('')
    lines.push('⚠ Circular references:')
    for (const cycle of graph.cycles) {
      lines.push(`  ${cycle.path.join(' → ')}`)
    }
  }

  // Orphaned tokens summary (just count + examples, not full list)
  if (graph.orphanedTokens.length > 0) {
    lines.push('')
    lines.push(
      `ℹ Orphaned tokens (${graph.orphanedTokens.length} raw values never referenced by any alias):`,
    )
    const examples = graph.orphanedTokens.slice(0, 10)
    for (const id of examples) {
      lines.push(`  ${id}`)
    }
    if (graph.orphanedTokens.length > 10) {
      lines.push(`  ... and ${graph.orphanedTokens.length - 10} more`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// DOT format export
// ---------------------------------------------------------------------------

export function formatDotGraph(graph: TokenGraph): string {
  const lines: string[] = []
  lines.push('digraph TokenDependencies {')
  lines.push('  rankdir=LR;')
  lines.push('  node [shape=box, fontname="Helvetica", fontsize=10];')
  lines.push('  edge [color="#666666"];')
  lines.push('')

  // Subgraphs by file
  const fileGroups = new Map<string, string[]>()
  for (const node of graph.nodes.values()) {
    if (!fileGroups.has(node.file)) fileGroups.set(node.file, [])
    fileGroups.get(node.file)!.push(node.id)
  }

  const fileColors: Record<string, string> = {}
  const palette = ['#e3f2fd', '#fce4ec', '#e8f5e9', '#fff3e0', '#f3e5f5', '#e0f7fa', '#fafafa']
  let colorIdx = 0
  for (const file of fileGroups.keys()) {
    fileColors[file] = palette[colorIdx % palette.length]
    colorIdx++
  }

  for (const [file, nodeIds] of fileGroups) {
    lines.push(`  subgraph "cluster_${file.replace(/[^a-zA-Z0-9]/g, '_')}" {`)
    lines.push(`    label="${file}";`)
    lines.push(`    style=filled;`)
    lines.push(`    color="${fileColors[file]}";`)
    for (const id of nodeIds) {
      const shortId = id.slice(file.length + 1)
      const escaped = id.replace(/"/g, '\\"')
      const shortEscaped = shortId.replace(/"/g, '\\"')
      lines.push(`    "${escaped}" [label="${shortEscaped}"];`)
    }
    lines.push('  }')
    lines.push('')
  }

  // Edges
  for (const edge of graph.edges) {
    const from = edge.from.replace(/"/g, '\\"')
    const to = edge.to.replace(/"/g, '\\"')
    lines.push(`  "${from}" -> "${to}";`)
  }

  lines.push('}')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Markdown table export
// ---------------------------------------------------------------------------

export function formatMarkdownReport(graph: TokenGraph, stats: GraphStats): string {
  const lines: string[] = []

  lines.push('# Token Dependency Graph Report')
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push(`| Total tokens | ${stats.totalTokens.toLocaleString()} |`)
  lines.push(`| Alias tokens | ${stats.aliasTokens.toLocaleString()} (${stats.aliasPercentage}%) |`)
  lines.push(`| Max chain depth | ${stats.maxChainDepth} |`)
  lines.push(`| Circular references | ${stats.circularRefs} |`)
  lines.push(`| Dangling aliases | ${stats.danglingAliases} |`)
  lines.push(`| Orphaned tokens | ${stats.orphanedTokens} |`)
  lines.push(`| Files | ${stats.fileCount} |`)
  lines.push('')

  // Tokens by file
  lines.push('## Tokens by file')
  lines.push('')
  lines.push('| File | Count |')
  lines.push('|------|-------|')
  for (const [file, count] of stats.tokensByFile) {
    lines.push(`| ${file} | ${count} |`)
  }
  lines.push('')

  // Dangling aliases
  if (graph.danglingAliases.length > 0) {
    lines.push('## Dangling aliases')
    lines.push('')
    lines.push('| Source | Alias | Target (missing) |')
    lines.push('|--------|-------|-------------------|')
    for (const da of graph.danglingAliases) {
      const shortSource = da.sourceId.slice(da.sourceFile.length + 1)
      lines.push(`| ${da.sourceFile} > ${shortSource} | ${da.rawAlias} | ${da.targetId} |`)
    }
    lines.push('')
  }

  // Circular references
  if (graph.cycles.length > 0) {
    lines.push('## Circular references')
    lines.push('')
    for (const cycle of graph.cycles) {
      lines.push(`- ${cycle.path.join(' → ')}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Interactive HTML visualization
// ---------------------------------------------------------------------------

export function generateHtmlVisualization(graph: TokenGraph, stats: GraphStats): string {
  // Build serializable data for the HTML
  const nodesArray = Array.from(graph.nodes.values()).map((n) => ({
    id: n.id,
    file: n.file,
    type: n.type,
    value: String(n.value),
    aliasTarget: n.aliasTarget,
    depth: graph.chainDepths.get(n.id) || 0,
    shortName: n.id.slice(n.file.length + 1),
  }))

  const edgesArray = graph.edges.map((e) => ({
    source: e.from,
    target: e.to,
  }))

  const danglingArray = graph.danglingAliases.map((d) => ({
    sourceId: d.sourceId,
    rawAlias: d.rawAlias,
    targetId: d.targetId,
  }))

  const filesArray = Array.from(stats.tokensByFile.entries()).map(([file, count]) => ({
    file,
    count,
  }))

  const data = {
    nodes: nodesArray,
    edges: edgesArray,
    dangling: danglingArray,
    files: filesArray,
    stats: {
      totalTokens: stats.totalTokens,
      aliasTokens: stats.aliasTokens,
      aliasPercentage: stats.aliasPercentage,
      maxChainDepth: stats.maxChainDepth,
      circularRefs: stats.circularRefs,
      danglingAliases: stats.danglingAliases,
      orphanedTokens: stats.orphanedTokens,
    },
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Token Dependency Graph — Design Token Farm</title>
<style>
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --text-muted: #8b949e;
    --accent: #58a6ff;
    --accent-subtle: #1f6feb33;
    --danger: #f85149;
    --warning: #d29922;
    --success: #3fb950;
    --info: #58a6ff;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }
  .header {
    border-bottom: 1px solid var(--border);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .header h1 {
    font-size: 20px;
    font-weight: 600;
  }
  .header .logo {
    font-family: monospace;
    color: var(--accent);
    font-size: 14px;
  }
  .layout {
    display: grid;
    grid-template-columns: 320px 1fr;
    height: calc(100vh - 57px);
  }
  .sidebar {
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 16px;
  }
  .main {
    position: relative;
    overflow: hidden;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 16px;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
  }
  .stat-card .label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .stat-card .value {
    font-size: 24px;
    font-weight: 700;
    margin-top: 2px;
  }
  .stat-card .value.danger { color: var(--danger); }
  .stat-card .value.warning { color: var(--warning); }
  .stat-card .value.success { color: var(--success); }
  .section-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin: 16px 0 8px;
    font-weight: 600;
  }
  .file-list {
    list-style: none;
  }
  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.15s;
  }
  .file-item:hover { background: var(--surface); }
  .file-item.active { background: var(--accent-subtle); color: var(--accent); }
  .file-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .file-count {
    margin-left: auto;
    color: var(--text-muted);
    font-size: 12px;
  }
  .search-box {
    width: 100%;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 13px;
    outline: none;
    margin-bottom: 12px;
  }
  .search-box:focus { border-color: var(--accent); }
  .search-box::placeholder { color: var(--text-muted); }

  /* Canvas */
  #canvas {
    width: 100%;
    height: 100%;
    cursor: grab;
  }
  #canvas:active { cursor: grabbing; }

  /* Tooltip */
  .tooltip {
    display: none;
    position: fixed;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    font-size: 12px;
    max-width: 360px;
    z-index: 100;
    pointer-events: none;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .tooltip.visible { display: block; }
  .tooltip .tt-label { color: var(--text-muted); font-size: 11px; }
  .tooltip .tt-value { color: var(--text); margin-bottom: 6px; word-break: break-all; }
  .tooltip .tt-chain { color: var(--accent); font-family: monospace; font-size: 11px; }

  /* Issues panel */
  .issues-panel {
    margin-top: 16px;
  }
  .issue-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .issue-item:hover { border-color: var(--accent); }
  .issue-item .issue-type {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .issue-item .issue-type.dangling { color: var(--warning); }
  .issue-item .issue-type.cycle { color: var(--danger); }
  .issue-item .issue-detail {
    color: var(--text-muted);
    font-family: monospace;
    font-size: 11px;
    word-break: break-all;
  }

  /* Controls */
  .controls {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
  }
  .ctrl-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    padding: 8px 12px;
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .ctrl-btn:hover { border-color: var(--accent); }
  .ctrl-btn.active { background: var(--accent-subtle); border-color: var(--accent); }

  /* Legend */
  .legend {
    position: absolute;
    top: 16px;
    right: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    font-size: 11px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  /* Depth bar chart */
  .depth-chart {
    margin-top: 8px;
  }
  .depth-bar-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 3px;
    font-size: 11px;
  }
  .depth-bar-label {
    width: 60px;
    color: var(--text-muted);
    text-align: right;
  }
  .depth-bar {
    height: 14px;
    background: var(--accent);
    border-radius: 3px;
    min-width: 2px;
    transition: width 0.3s;
  }
  .depth-bar-count {
    color: var(--text-muted);
    font-size: 10px;
  }
</style>
</head>
<body>

<div class="header">
  <span class="logo">{·} dtf</span>
  <h1>Token Dependency Graph</h1>
</div>

<div class="layout">
  <div class="sidebar">
    <input type="text" class="search-box" id="search" placeholder="Search tokens..." />

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Total tokens</div>
        <div class="value" id="stat-total">—</div>
      </div>
      <div class="stat-card">
        <div class="label">Aliases</div>
        <div class="value" id="stat-aliases">—</div>
      </div>
      <div class="stat-card">
        <div class="label">Max depth</div>
        <div class="value" id="stat-depth">—</div>
      </div>
      <div class="stat-card">
        <div class="label">Issues</div>
        <div class="value" id="stat-issues">—</div>
      </div>
    </div>

    <div class="section-title">Files</div>
    <ul class="file-list" id="file-list"></ul>

    <div class="section-title">Chain depth distribution</div>
    <div class="depth-chart" id="depth-chart"></div>

    <div class="issues-panel" id="issues-panel">
      <div class="section-title">Issues</div>
    </div>
  </div>

  <div class="main">
    <canvas id="canvas"></canvas>
    <div class="tooltip" id="tooltip"></div>
    <div class="legend" id="legend"></div>
    <div class="controls">
      <button class="ctrl-btn" id="btn-zoom-in" title="Zoom in">+</button>
      <button class="ctrl-btn" id="btn-zoom-out" title="Zoom out">−</button>
      <button class="ctrl-btn" id="btn-fit" title="Fit to screen">Fit</button>
      <button class="ctrl-btn" id="btn-aliases-only" title="Show only alias edges">Aliases only</button>
    </div>
  </div>
</div>

<script>
// Embedded graph data
const DATA = ${JSON.stringify(data)};

// Color palette for files
const FILE_COLORS = [
  '#58a6ff', '#f0883e', '#3fb950', '#bc8cff', '#f778ba',
  '#79c0ff', '#d29922', '#56d4dd',
];

const fileColorMap = {};
DATA.files.forEach((f, i) => { fileColorMap[f.file] = FILE_COLORS[i % FILE_COLORS.length]; });

// ---- Stats ----
document.getElementById('stat-total').textContent = DATA.stats.totalTokens.toLocaleString();
document.getElementById('stat-aliases').textContent =
  DATA.stats.aliasTokens.toLocaleString() + ' (' + DATA.stats.aliasPercentage + '%)';
document.getElementById('stat-depth').textContent = DATA.stats.maxChainDepth;
const issueCount = DATA.stats.danglingAliases + DATA.stats.circularRefs;
const issueEl = document.getElementById('stat-issues');
issueEl.textContent = issueCount;
issueEl.className = 'value ' + (issueCount > 0 ? 'warning' : 'success');

// ---- File list ----
const fileListEl = document.getElementById('file-list');
let activeFile = null;
DATA.files.forEach(f => {
  const li = document.createElement('li');
  li.className = 'file-item';
  li.innerHTML = '<span class="file-dot" style="background:' + fileColorMap[f.file] + '"></span>'
    + '<span>' + f.file + '</span>'
    + '<span class="file-count">' + f.count + '</span>';
  li.addEventListener('click', () => {
    if (activeFile === f.file) {
      activeFile = null;
      li.classList.remove('active');
    } else {
      document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
      activeFile = f.file;
      li.classList.add('active');
    }
    render();
  });
  fileListEl.appendChild(li);
});

// ---- Depth chart ----
const depthCounts = {};
DATA.nodes.forEach(n => {
  const d = n.depth;
  depthCounts[d] = (depthCounts[d] || 0) + 1;
});
const depthChartEl = document.getElementById('depth-chart');
const maxCount = Math.max(...Object.values(depthCounts));
Object.keys(depthCounts).sort((a,b) => +a - +b).forEach(d => {
  const row = document.createElement('div');
  row.className = 'depth-bar-row';
  const pct = (depthCounts[d] / maxCount) * 100;
  row.innerHTML = '<span class="depth-bar-label">Depth ' + d + '</span>'
    + '<div class="depth-bar" style="width:' + Math.max(pct, 1) + '%"></div>'
    + '<span class="depth-bar-count">' + depthCounts[d] + '</span>';
  depthChartEl.appendChild(row);
});

// ---- Issues ----
const issuesPanel = document.getElementById('issues-panel');
if (DATA.dangling.length === 0 && DATA.stats.circularRefs === 0) {
  issuesPanel.innerHTML = '<div class="section-title">Issues</div><div style="color:var(--success);font-size:12px;padding:8px;">No issues found.</div>';
}
DATA.dangling.forEach(d => {
  const div = document.createElement('div');
  div.className = 'issue-item';
  div.innerHTML = '<div class="issue-type dangling">Dangling alias</div>'
    + '<div class="issue-detail">' + d.sourceId + '<br>→ ' + d.rawAlias + '</div>';
  div.addEventListener('click', () => { highlightNode(d.sourceId); });
  issuesPanel.appendChild(div);
});

// ---- Legend ----
const legendEl = document.getElementById('legend');
let legendHtml = '';
DATA.files.forEach(f => {
  legendHtml += '<div class="legend-item"><div class="legend-dot" style="background:' + fileColorMap[f.file] + '"></div>' + f.file + '</div>';
});
legendEl.innerHTML = legendHtml;

// ---- Canvas graph rendering ----
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');

let width, height, dpr;
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  width = rect.width;
  height = rect.height;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); render(); });

// ---- Force-directed layout (simple) ----
// We use a deterministic layout: group by file, arrange in columns

const nodePositions = {};
const nodeIndex = {};
DATA.nodes.forEach((n, i) => { nodeIndex[n.id] = i; });

function computeLayout() {
  const fileOrder = DATA.files.map(f => f.file);
  const colWidth = Math.max(width / (fileOrder.length + 1), 200);
  const nodesByFile = {};
  DATA.nodes.forEach(n => {
    if (!nodesByFile[n.file]) nodesByFile[n.file] = [];
    nodesByFile[n.file].push(n);
  });

  fileOrder.forEach((file, colIdx) => {
    const nodes = nodesByFile[file] || [];
    const rowHeight = Math.max(Math.min(height / (nodes.length + 1), 16), 3);
    nodes.forEach((n, rowIdx) => {
      nodePositions[n.id] = {
        x: (colIdx + 0.5) * colWidth,
        y: (rowIdx + 0.5) * rowHeight,
      };
    });
  });
}
computeLayout();

// Camera / transform
let camX = 0, camY = 0, zoom = 1;
let isDragging = false, dragStartX = 0, dragStartY = 0, dragCamStartX = 0, dragCamStartY = 0;
let searchQuery = '';
let showAliasesOnly = false;
let highlightedNode = null;

function screenToWorld(sx, sy) {
  return { x: (sx - width/2) / zoom + camX, y: (sy - height/2) / zoom + camY };
}
function worldToScreen(wx, wy) {
  return { x: (wx - camX) * zoom + width/2, y: (wy - camY) * zoom + height/2 };
}

function fitToScreen() {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const positions = Object.values(nodePositions);
  if (positions.length === 0) return;
  positions.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  camX = (minX + maxX) / 2;
  camY = (minY + maxY) / 2;
  const rangeX = maxX - minX + 100;
  const rangeY = maxY - minY + 100;
  zoom = Math.min(width / rangeX, height / rangeY, 2);
  render();
}

function render() {
  ctx.clearRect(0, 0, width, height);

  const visibleNodes = new Set();
  DATA.nodes.forEach(n => {
    if (activeFile && n.file !== activeFile) return;
    if (searchQuery && !n.id.toLowerCase().includes(searchQuery) && !n.shortName.toLowerCase().includes(searchQuery)) return;
    visibleNodes.add(n.id);
  });

  // Draw edges
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;
  DATA.edges.forEach(e => {
    if (showAliasesOnly || activeFile || searchQuery) {
      if (!visibleNodes.has(e.source) && !visibleNodes.has(e.target)) return;
    }
    const from = nodePositions[e.source];
    const to = nodePositions[e.target];
    if (!from || !to) return;
    const s = worldToScreen(from.x, from.y);
    const t = worldToScreen(to.x, to.y);

    const isHighlighted = highlightedNode && (e.source === highlightedNode || e.target === highlightedNode);
    ctx.strokeStyle = isHighlighted ? '#58a6ff' : '#30363d';
    ctx.globalAlpha = isHighlighted ? 0.8 : 0.15;
    ctx.lineWidth = isHighlighted ? 1.5 : 0.5;

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    // Bezier curve for cross-file edges
    const dx = t.x - s.x;
    ctx.bezierCurveTo(s.x + dx * 0.3, s.y, t.x - dx * 0.3, t.y, t.x, t.y);
    ctx.stroke();
  });

  // Draw nodes
  ctx.globalAlpha = 1;
  const nodeRadius = Math.max(2, Math.min(4, 3 * zoom));
  DATA.nodes.forEach(n => {
    const pos = nodePositions[n.id];
    if (!pos) return;
    const s = worldToScreen(pos.x, pos.y);

    // Skip off-screen
    if (s.x < -20 || s.x > width + 20 || s.y < -20 || s.y > height + 20) return;

    let alpha = 1;
    if (activeFile && n.file !== activeFile) alpha = 0.1;
    if (searchQuery && !visibleNodes.has(n.id)) alpha = 0.05;
    if (highlightedNode && n.id !== highlightedNode) {
      // Check if connected
      const connected = DATA.edges.some(e =>
        (e.source === highlightedNode && e.target === n.id) ||
        (e.target === highlightedNode && e.source === n.id)
      );
      alpha = connected ? 1 : 0.1;
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = fileColorMap[n.file] || '#8b949e';
    ctx.beginPath();
    ctx.arc(s.x, s.y, n.id === highlightedNode ? nodeRadius * 2 : nodeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Show label on zoom or highlight
    if (zoom > 1.5 || n.id === highlightedNode) {
      ctx.fillStyle = 'var(--text)';
      ctx.font = '9px -apple-system, sans-serif';
      ctx.fillText(n.shortName, s.x + nodeRadius + 3, s.y + 3);
    }
  });

  ctx.globalAlpha = 1;
}

// ---- Interaction ----
canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragCamStartX = camX;
  dragCamStartY = camY;
});
canvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    camX = dragCamStartX - dx / zoom;
    camY = dragCamStartY - dy / zoom;
    render();
  } else {
    // Hover detection
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const world = screenToWorld(mx, my);
    let closest = null;
    let closestDist = Infinity;
    DATA.nodes.forEach(n => {
      const pos = nodePositions[n.id];
      if (!pos) return;
      const dx = pos.x - world.x;
      const dy = pos.y - world.y;
      const dist = dx*dx + dy*dy;
      if (dist < closestDist) { closestDist = dist; closest = n; }
    });
    const threshold = (10 / zoom) * (10 / zoom);
    if (closest && closestDist < threshold) {
      showTooltip(closest, e.clientX, e.clientY);
    } else {
      tooltip.classList.remove('visible');
    }
  }
});
canvas.addEventListener('mouseup', () => { isDragging = false; });
canvas.addEventListener('mouseleave', () => { isDragging = false; tooltip.classList.remove('visible'); });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  zoom = Math.max(0.1, Math.min(10, zoom * zoomFactor));
  render();
}, { passive: false });

function showTooltip(node, x, y) {
  let chain = buildChain(node.id);
  let html = '<div class="tt-label">Token</div><div class="tt-value">' + node.id + '</div>';
  html += '<div class="tt-label">Type</div><div class="tt-value">' + node.type + '</div>';
  html += '<div class="tt-label">Value</div><div class="tt-value">' + escapeHtml(node.value) + '</div>';
  html += '<div class="tt-label">Chain depth</div><div class="tt-value">' + node.depth + '</div>';
  if (chain.length > 1) {
    html += '<div class="tt-label">Alias chain</div><div class="tt-chain">' + chain.join('<br>→ ') + '</div>';
  }
  tooltip.innerHTML = html;
  tooltip.style.left = (x + 16) + 'px';
  tooltip.style.top = (y + 16) + 'px';
  tooltip.classList.add('visible');
}

function buildChain(nodeId) {
  const chain = [nodeId];
  const visited = new Set([nodeId]);
  let current = nodeId;
  for (let i = 0; i < 20; i++) {
    const edge = DATA.edges.find(e => e.source === current);
    if (!edge || visited.has(edge.target)) break;
    chain.push(edge.target);
    visited.add(edge.target);
    current = edge.target;
  }
  return chain;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightNode(nodeId) {
  highlightedNode = highlightedNode === nodeId ? null : nodeId;
  const pos = nodePositions[nodeId];
  if (pos && highlightedNode) {
    camX = pos.x;
    camY = pos.y;
    zoom = Math.max(zoom, 1.5);
  }
  render();
}

// ---- Controls ----
document.getElementById('btn-zoom-in').addEventListener('click', () => {
  zoom = Math.min(10, zoom * 1.3);
  render();
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  zoom = Math.max(0.1, zoom / 1.3);
  render();
});
document.getElementById('btn-fit').addEventListener('click', fitToScreen);
document.getElementById('btn-aliases-only').addEventListener('click', function() {
  showAliasesOnly = !showAliasesOnly;
  this.classList.toggle('active');
  render();
});

// ---- Search ----
document.getElementById('search').addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  render();
});

// Initial render
fitToScreen();
</script>
</body>
</html>`
}
