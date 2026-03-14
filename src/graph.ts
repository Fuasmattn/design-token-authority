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

// Pre-build lookup tables for performance
const edgesBySource = {};
const edgesByTarget = {};
DATA.edges.forEach(e => {
  if (!edgesBySource[e.source]) edgesBySource[e.source] = [];
  edgesBySource[e.source].push(e);
  if (!edgesByTarget[e.target]) edgesByTarget[e.target] = [];
  edgesByTarget[e.target].push(e);
});

// Build node lookup and resolve colors for alias tokens
const nodeById = {};
DATA.nodes.forEach(n => { nodeById[n.id] = n; });

// For color tokens, follow the alias chain to find the resolved hex value
const resolvedColorCache = {};
function resolveColor(nodeId) {
  if (resolvedColorCache[nodeId] !== undefined) return resolvedColorCache[nodeId];
  const n = nodeById[nodeId];
  if (!n || n.type !== 'color') { resolvedColorCache[nodeId] = null; return null; }
  if (n.value && n.value.startsWith('#') && n.value.length >= 4) {
    resolvedColorCache[nodeId] = n.value;
    return n.value;
  }
  // Follow edge to target
  const edges = edgesBySource[nodeId];
  if (edges && edges.length > 0) {
    const resolved = resolveColor(edges[0].target);
    resolvedColorCache[nodeId] = resolved;
    return resolved;
  }
  resolvedColorCache[nodeId] = null;
  return null;
}

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
    autoFitVisible();
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

// ---- Match counter badge ----
const matchBadge = document.createElement('div');
matchBadge.id = 'match-badge';
matchBadge.style.cssText = 'position:absolute;top:16px;left:16px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:12px;color:var(--text-muted);display:none;z-index:10;';
document.querySelector('.main').appendChild(matchBadge);

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
window.addEventListener('resize', () => { resizeCanvas(); computeLayout(); autoFitVisible(); });

// ---- Layout with semantic grouping ----
// Tokens are grouped by their top-level path segment (e.g. Colors, Spacing, Typography).
// Groups get header labels and spacing between them, making the graph navigable.

const nodePositions = {};
const nodeIndex = {};
DATA.nodes.forEach((n, i) => { nodeIndex[n.id] = i; });

const ROW_HEIGHT = 20;
const COL_WIDTH = 350;
const GROUP_GAP = 40;       // Extra space between groups
const GROUP_HEADER_H = 30;  // Space for group header label

// Pre-compute groups per file: { file -> [{ name, nodes }] }
const groupsByFile = {};
const groupHeaders = []; // { file, colIdx, name, x, y } for rendering
DATA.files.forEach(f => {
  const nodesByGroup = {};
  DATA.nodes.filter(n => n.file === f.file).forEach(n => {
    const firstSeg = n.shortName.split('/')[0];
    if (!nodesByGroup[firstSeg]) nodesByGroup[firstSeg] = [];
    nodesByGroup[firstSeg].push(n);
  });
  groupsByFile[f.file] = Object.entries(nodesByGroup).map(([name, nodes]) => ({ name, nodes }));
});

function computeLayout() {
  const fileOrder = DATA.files.map(f => f.file);
  groupHeaders.length = 0;

  fileOrder.forEach((file, colIdx) => {
    const groups = groupsByFile[file] || [];
    let y = 0;

    groups.forEach(group => {
      // Store group header position
      groupHeaders.push({
        file,
        colIdx,
        name: group.name,
        x: (colIdx + 0.5) * COL_WIDTH,
        y: y,
        nodeCount: group.nodes.length,
      });

      y += GROUP_HEADER_H;

      group.nodes.forEach(n => {
        nodePositions[n.id] = {
          x: (colIdx + 0.5) * COL_WIDTH,
          y: y,
        };
        y += ROW_HEIGHT;
      });

      y += GROUP_GAP;
    });
  });
}
computeLayout();

// Camera / transform
let camX = 0, camY = 0, zoom = 1;
let targetCamX = 0, targetCamY = 0, targetZoom = 1;
let animating = false;
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

// ---- Animated camera transitions ----
function animateTo(tx, ty, tz, snap) {
  targetCamX = tx;
  targetCamY = ty;
  targetZoom = tz;

  // Snap immediately for large changes (e.g. initial fit, or zoom ratio > 5x)
  const zoomRatio = Math.max(zoom / tz, tz / zoom);
  if (snap || zoomRatio > 5) {
    camX = tx; camY = ty; zoom = tz;
    animating = false;
    render();
    return;
  }

  if (!animating) {
    animating = true;
    requestAnimationFrame(animateStep);
  }
}

function animateStep() {
  const ease = 0.2;
  camX += (targetCamX - camX) * ease;
  camY += (targetCamY - camY) * ease;
  zoom += (targetZoom - zoom) * ease;

  const dx = Math.abs(targetCamX - camX);
  const dy = Math.abs(targetCamY - camY);
  const dz = Math.abs(targetZoom - zoom);
  // Use relative threshold for zoom to handle small target values
  const zoomClose = dz < 0.001 || dz / Math.max(targetZoom, 0.01) < 0.01;

  render();

  if (dx > 0.5 || dy > 0.5 || !zoomClose) {
    requestAnimationFrame(animateStep);
  } else {
    camX = targetCamX;
    camY = targetCamY;
    zoom = targetZoom;
    animating = false;
    render();
  }
}

// ---- Visible node computation ----
function getVisibleNodeIds() {
  const ids = new Set();
  DATA.nodes.forEach(n => {
    if (activeFile && n.file !== activeFile) return;
    if (searchQuery && !n.id.toLowerCase().includes(searchQuery) && !n.shortName.toLowerCase().includes(searchQuery)) return;
    ids.add(n.id);
  });
  // Also include connected nodes (alias targets/sources) so edges make sense
  if (searchQuery || highlightedNode) {
    const extra = new Set();
    ids.forEach(id => {
      (edgesBySource[id] || []).forEach(e => extra.add(e.target));
      (edgesByTarget[id] || []).forEach(e => extra.add(e.source));
    });
    extra.forEach(id => ids.add(id));
  }
  return ids;
}

// ---- Get directly matching nodes (without connected expansion) ----
function getDirectMatchIds() {
  const ids = new Set();
  DATA.nodes.forEach(n => {
    if (activeFile && n.file !== activeFile) return;
    if (searchQuery && !n.id.toLowerCase().includes(searchQuery) && !n.shortName.toLowerCase().includes(searchQuery)) return;
    ids.add(n.id);
  });
  return ids;
}

// ---- Auto-fit to visible nodes (animated) ----
function autoFitVisible() {
  // Use direct matches for bbox (not connected nodes, which span entire columns)
  const directMatches = getDirectMatchIds();
  const allVisible = getVisibleNodeIds();

  // Update match badge
  const isFiltered = activeFile || searchQuery;
  if (isFiltered && directMatches.size < DATA.nodes.length) {
    matchBadge.textContent = directMatches.size + ' of ' + DATA.nodes.length + ' tokens';
    matchBadge.style.display = 'block';
  } else {
    matchBadge.style.display = 'none';
  }

  const bboxNodes = directMatches.size > 0 ? directMatches : allVisible;
  if (bboxNodes.size === 0) { render(); return; }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  bboxNodes.forEach(id => {
    const p = nodePositions[id];
    if (!p) return;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rangeX = maxX - minX + COL_WIDTH * 0.5;
  const rangeY = maxY - minY + ROW_HEIGHT * 4;

  // Compute zoom to fit, with a minimum that ensures labels are readable.
  // Labels show when screenRowH >= 13 (global) or >= 8 (filtered).
  // Enforce minimum zoom so labels are comfortably readable on filter.
  // 14 / ROW_HEIGHT = 0.7, which gives ~14px screen spacing per row.
  const MIN_LABEL_ZOOM = 14 / ROW_HEIGHT;
  let fitZoom = Math.min(width / rangeX, height / rangeY);

  // Cap maximum zoom based on result count to avoid excessive zoom on large sets
  if (bboxNodes.size <= 1) {
    fitZoom = Math.min(fitZoom, 5);
  } else if (bboxNodes.size <= 10) {
    fitZoom = Math.min(fitZoom, 4);
  } else if (bboxNodes.size <= 50) {
    fitZoom = Math.min(fitZoom, 3);
  } else {
    fitZoom = Math.min(fitZoom, 2);
  }

  // Enforce minimum zoom for readability when filtering,
  // but only if the bbox fits within the viewport at the boosted zoom.
  if (isFiltered) {
    let targetMin = 0;
    if (bboxNodes.size <= 30) {
      targetMin = MIN_LABEL_ZOOM * 1.5;
    } else if (bboxNodes.size <= 200) {
      targetMin = MIN_LABEL_ZOOM;
    }
    // Only boost if both dimensions still fit at the target zoom
    if (targetMin > fitZoom && rangeX * targetMin < width && rangeY * targetMin < height) {
      fitZoom = targetMin;
    }
  }

  fitZoom = Math.max(fitZoom, 0.05);
  animateTo(cx, cy, fitZoom);
}

// Width-optimized initial fit: fit horizontally with top padding
function initialFit() {
  const allNodes = getDirectMatchIds();
  if (allNodes.size === 0) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  allNodes.forEach(id => {
    const p = nodePositions[id];
    if (!p) return;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const rangeX = maxX - minX + COL_WIDTH * 0.8;
  const fitZoom = Math.max(0.05, width / rangeX);
  const cx = (minX + maxX) / 2;
  // Position camera so top of content is at ~10% from viewport top
  const topPad = height * 0.1;
  const cy = minY - GROUP_HEADER_H + (height / 2 - topPad) / fitZoom;

  camX = cx; camY = cy; zoom = fitZoom;
  targetCamX = cx; targetCamY = cy; targetZoom = fitZoom;
  render();
}

function fitToScreen() {
  activeFile = null;
  searchQuery = '';
  highlightedNode = null;
  document.getElementById('search').value = '';
  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
  autoFitVisible();
}

// ---- Render ----
function render() {
  ctx.clearRect(0, 0, width, height);

  const visibleNodes = new Set();
  DATA.nodes.forEach(n => {
    if (activeFile && n.file !== activeFile) return;
    if (searchQuery && !n.id.toLowerCase().includes(searchQuery) && !n.shortName.toLowerCase().includes(searchQuery)) return;
    visibleNodes.add(n.id);
  });

  const isFiltered = activeFile || searchQuery || highlightedNode;
  const screenRowH = ROW_HEIGHT * zoom;

  // Semantic zoom thresholds:
  // Level 1 (overview):    zoom < 0.04 — only file column backgrounds + group headers
  // Level 2 (groups+dots): 0.04 <= zoom < 0.5 — group headers + dot per node, no labels
  // Level 3 (labels):      zoom >= 0.5 — group headers + nodes with labels
  const ZOOM_SHOW_NODES = 0.04;
  const ZOOM_SHOW_LABELS = 0.5;
  const showNodes = zoom >= ZOOM_SHOW_NODES;
  const showLabels = zoom >= ZOOM_SHOW_LABELS;
  const showLabelsForVisible = zoom >= 0.15 && isFiltered;

  // ---- Draw file column backgrounds (always visible) ----
  {
    const fileOrder = DATA.files.map(f => f.file);
    fileOrder.forEach((file, colIdx) => {
      const colCenterX = (colIdx + 0.5) * COL_WIDTH;
      const groups = groupsByFile[file] || [];
      if (groups.length === 0) return;

      // Compute column vertical extent
      let minY = Infinity, maxY = -Infinity;
      groups.forEach(group => {
        group.nodes.forEach(n => {
          const pos = nodePositions[n.id];
          if (pos) {
            if (pos.y < minY) minY = pos.y;
            if (pos.y > maxY) maxY = pos.y;
          }
        });
      });
      if (!isFinite(minY)) return;

      const s1 = worldToScreen(colCenterX - COL_WIDTH * 0.4, minY - GROUP_HEADER_H);
      const s2 = worldToScreen(colCenterX + COL_WIDTH * 0.4, maxY + ROW_HEIGHT);
      if (s2.x < 0 || s1.x > width || s2.y < 0 || s1.y > height) return;

      const color = fileColorMap[file] || '#8b949e';
      ctx.fillStyle = color;
      ctx.globalAlpha = (isFiltered && activeFile && file !== activeFile) ? 0.02 : 0.04;
      ctx.beginPath();
      ctx.roundRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y, 4 * zoom);
      ctx.fill();

      // File name label at the top of each column
      const labelS = worldToScreen(colCenterX, minY - GROUP_HEADER_H - 20);
      const fileFontSize = Math.max(7, Math.min(16, 12 * zoom));
      ctx.font = 'bold ' + fileFontSize + 'px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = color;
      ctx.globalAlpha = (isFiltered && activeFile && file !== activeFile) ? 0.15 : 0.6;
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'center';
      ctx.fillText(file, labelS.x, labelS.y);
      ctx.textAlign = 'start';
    });
  }

  // ---- Draw group headers (semantic zoom level 1+) ----
  const screenGroupH = GROUP_HEADER_H * zoom;
  if (screenGroupH >= 4) {
    groupHeaders.forEach(gh => {
      const s = worldToScreen(gh.x, gh.y);
      if (s.x < -200 || s.x > width + 200 || s.y < -50 || s.y > height + 50) return;

      const headerAlpha = (isFiltered && activeFile && gh.file !== activeFile) ? 0.1 : 0.7;
      ctx.globalAlpha = headerAlpha;

      // Group label
      const fontSize = Math.max(8, Math.min(14, 11 * zoom));
      ctx.font = 'bold ' + fontSize + 'px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = fileColorMap[gh.file] || '#8b949e';
      ctx.textBaseline = 'middle';

      const label = gh.name + (zoom < ZOOM_SHOW_LABELS ? ' (' + gh.nodeCount + ')' : '');
      ctx.fillText(label, s.x - 5, s.y);

      // Subtle underline
      const metrics = ctx.measureText(label);
      ctx.strokeStyle = fileColorMap[gh.file] || '#8b949e';
      ctx.globalAlpha = headerAlpha * 0.3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - 5, s.y + fontSize/2 + 2);
      ctx.lineTo(s.x - 5 + metrics.width, s.y + fontSize/2 + 2);
      ctx.stroke();
    });
  }

  // ---- Draw edges ----
  if (showNodes) {
    DATA.edges.forEach(e => {
      const from = nodePositions[e.source];
      const to = nodePositions[e.target];
      if (!from || !to) return;
      const s = worldToScreen(from.x, from.y);
      const t = worldToScreen(to.x, to.y);

      if (s.x < -100 && t.x < -100) return;
      if (s.x > width+100 && t.x > width+100) return;
      if (s.y < -100 && t.y < -100) return;
      if (s.y > height+100 && t.y > height+100) return;

      const srcVisible = visibleNodes.has(e.source);
      const tgtVisible = visibleNodes.has(e.target);
      const isHighlighted = highlightedNode && (e.source === highlightedNode || e.target === highlightedNode);

      if (isFiltered && !srcVisible && !tgtVisible && !isHighlighted) return;

      if (isHighlighted) {
        ctx.strokeStyle = '#58a6ff';
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 2;
      } else if (isFiltered && (srcVisible || tgtVisible)) {
        ctx.strokeStyle = fileColorMap[DATA.nodes.find(n => n.id === e.source)?.file] || '#58a6ff';
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = '#30363d';
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 0.5;
      }

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      const dx = t.x - s.x;
      ctx.bezierCurveTo(s.x + dx * 0.4, s.y, t.x - dx * 0.4, t.y, t.x, t.y);
      ctx.stroke();
    });
  }

  // ---- Draw nodes (semantic zoom level 2+) ----
  if (showNodes) {
    ctx.globalAlpha = 1;
    const baseRadius = Math.max(2.5, Math.min(6, 3.5 * zoom));

    DATA.nodes.forEach(n => {
      const pos = nodePositions[n.id];
      if (!pos) return;
      const s = worldToScreen(pos.x, pos.y);

      if (s.x < -50 || s.x > width + 50 || s.y < -50 || s.y > height + 50) return;

      const isMatch = visibleNodes.has(n.id);
      const isHL = n.id === highlightedNode;
      const isConnected = highlightedNode && (
        (edgesBySource[highlightedNode] || []).some(e => e.target === n.id) ||
        (edgesByTarget[highlightedNode] || []).some(e => e.source === n.id)
      );

      let alpha, r;
      if (isHL) {
        alpha = 1; r = baseRadius * 2.5;
      } else if (!isFiltered) {
        alpha = 1; r = baseRadius;
      } else if (highlightedNode && isConnected) {
        alpha = 1; r = baseRadius * 1.5;
      } else if (isMatch) {
        alpha = 1; r = baseRadius * 1.3;
      } else {
        alpha = 0.12; r = baseRadius * 0.7;
      }

      ctx.globalAlpha = alpha;

      // Use actual resolved color for color tokens, file color otherwise
      let nodeColor = fileColorMap[n.file] || '#8b949e';
      const resolved = resolveColor(n.id);
      if (resolved) nodeColor = resolved;

      ctx.fillStyle = nodeColor;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Add a thin border ring so dark colors are visible on dark background
      if (resolved) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ---- Labels (semantic zoom level 3, or level 2 when filtered) ----
      const shouldLabel = isHL || (showLabels && alpha > 0.5) || (showLabelsForVisible && isMatch);
      if (shouldLabel) {
        const fontSize = Math.max(9, Math.min(14, 11 * zoom));
        ctx.font = fontSize + 'px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.globalAlpha = alpha * 0.9;

        // Use last 2 path segments for a short readable label
        const parts = n.shortName.split('/');
        const label = parts.length > 2 ? parts.slice(-2).join('/') : n.shortName;

        const metrics = ctx.measureText(label);
        const lx = s.x + r + 5;
        const ly = s.y;

        // Background pill
        ctx.fillStyle = 'rgba(13,17,23,0.85)';
        ctx.beginPath();
        ctx.roundRect(lx - 3, ly - fontSize/2 - 2, metrics.width + 6, fontSize + 4, 3);
        ctx.fill();

        ctx.fillStyle = '#e6edf3';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx, ly);
      }
    });
  }

  ctx.globalAlpha = 1;
}

// ---- Interaction ----
canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragCamStartX = camX;
  dragCamStartY = camY;
  // Stop animation when user grabs
  targetCamX = camX; targetCamY = camY; targetZoom = zoom;
});
canvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    camX = dragCamStartX - dx / zoom;
    camY = dragCamStartY - dy / zoom;
    targetCamX = camX; targetCamY = camY;
    render();
  } else {
    // Hover detection — only check visible nodes for performance
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const world = screenToWorld(mx, my);
    let closest = null;
    let closestDist = Infinity;
    const threshold = (12 / zoom) * (12 / zoom);
    DATA.nodes.forEach(n => {
      const pos = nodePositions[n.id];
      if (!pos) return;
      const dx = pos.x - world.x;
      const dy = pos.y - world.y;
      const dist = dx*dx + dy*dy;
      if (dist < closestDist && dist < threshold) { closestDist = dist; closest = n; }
    });
    if (closest) {
      showTooltip(closest, e.clientX, e.clientY);
    } else {
      tooltip.classList.remove('visible');
    }
  }
});
canvas.addEventListener('mouseup', (e) => {
  if (isDragging) {
    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);
    // If it was a click (not a drag), toggle node highlight
    if (dx < 4 && dy < 4) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const world = screenToWorld(mx, my);
      let closest = null;
      let closestDist = Infinity;
      const threshold = (12 / zoom) * (12 / zoom);
      DATA.nodes.forEach(n => {
        const pos = nodePositions[n.id];
        if (!pos) return;
        const dx = pos.x - world.x;
        const dy = pos.y - world.y;
        const dist = dx*dx + dy*dy;
        if (dist < closestDist && dist < threshold) { closestDist = dist; closest = n; }
      });
      if (closest) {
        highlightNode(closest.id);
      } else if (highlightedNode) {
        highlightedNode = null;
        render();
      }
    }
  }
  isDragging = false;
});
canvas.addEventListener('mouseleave', () => { isDragging = false; tooltip.classList.remove('visible'); });

// Zoom toward cursor position
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // World position under cursor before zoom
  const worldBefore = screenToWorld(mx, my);

  const zoomFactor = e.deltaY > 0 ? 0.88 : 1.14;
  zoom = Math.max(0.05, Math.min(20, zoom * zoomFactor));
  targetZoom = zoom;

  // World position under cursor after zoom
  const worldAfter = screenToWorld(mx, my);

  // Adjust camera so the same world point stays under the cursor
  camX -= (worldAfter.x - worldBefore.x);
  camY -= (worldAfter.y - worldBefore.y);
  targetCamX = camX;
  targetCamY = camY;

  render();
}, { passive: false });

function showTooltip(node, x, y) {
  let chain = buildChain(node.id);
  let html = '<div class="tt-label">Token</div><div class="tt-value">' + escapeHtml(node.shortName) + '</div>';
  html += '<div class="tt-label">File</div><div class="tt-value">' + escapeHtml(node.file) + '</div>';
  html += '<div class="tt-label">Type</div><div class="tt-value">' + node.type + '</div>';

  // Show color swatch for color tokens
  if (node.type === 'color' && node.value.startsWith('#')) {
    html += '<div class="tt-label">Value</div><div class="tt-value"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:' + escapeHtml(node.value) + ';vertical-align:middle;margin-right:6px;border:1px solid rgba(255,255,255,0.2);"></span>' + escapeHtml(node.value) + '</div>';
  } else {
    html += '<div class="tt-label">Value</div><div class="tt-value">' + escapeHtml(node.value) + '</div>';
  }

  html += '<div class="tt-label">Chain depth</div><div class="tt-value">' + node.depth + '</div>';
  if (chain.length > 1) {
    html += '<div class="tt-label">Alias chain</div><div class="tt-chain">' + chain.map(c => {
      const n = DATA.nodes.find(nn => nn.id === c);
      return n ? n.shortName : c;
    }).join('<br>→ ') + '</div>';
  }
  tooltip.innerHTML = html;

  // Position tooltip, keeping it on screen
  let tx = x + 16, ty = y + 16;
  if (tx + 360 > window.innerWidth) tx = x - 376;
  if (ty + 200 > window.innerHeight) ty = y - 216;
  tooltip.style.left = tx + 'px';
  tooltip.style.top = ty + 'px';
  tooltip.classList.add('visible');
}

function buildChain(nodeId) {
  const chain = [nodeId];
  const visited = new Set([nodeId]);
  let current = nodeId;
  for (let i = 0; i < 20; i++) {
    const edges = edgesBySource[current];
    if (!edges || edges.length === 0) break;
    const next = edges[0].target;
    if (visited.has(next)) break;
    chain.push(next);
    visited.add(next);
    current = next;
  }
  return chain;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightNode(nodeId) {
  highlightedNode = highlightedNode === nodeId ? null : nodeId;
  if (highlightedNode) {
    const pos = nodePositions[nodeId];
    if (pos) {
      animateTo(pos.x, pos.y, Math.max(zoom, 2.5));
    }
  }
  render();
}

// ---- Controls ----
document.getElementById('btn-zoom-in').addEventListener('click', () => {
  targetZoom = Math.min(20, zoom * 1.5);
  targetCamX = camX; targetCamY = camY;
  if (!animating) { animating = true; requestAnimationFrame(animateStep); }
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  targetZoom = Math.max(0.05, zoom / 1.5);
  targetCamX = camX; targetCamY = camY;
  if (!animating) { animating = true; requestAnimationFrame(animateStep); }
});
document.getElementById('btn-fit').addEventListener('click', fitToScreen);
document.getElementById('btn-aliases-only').addEventListener('click', function() {
  showAliasesOnly = !showAliasesOnly;
  this.classList.toggle('active');
  render();
});

// ---- Search with debounced auto-fit ----
let searchTimer = null;
document.getElementById('search').addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  highlightedNode = null;
  clearTimeout(searchTimer);
  // Debounce: auto-fit after typing pauses
  searchTimer = setTimeout(() => { autoFitVisible(); }, 200);
  render();
});

// Initial render — fit to width with top padding for a nice overview
initialFit();
</script>
</body>
</html>`
}
