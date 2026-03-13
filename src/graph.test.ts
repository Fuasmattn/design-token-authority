import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  readTokenFilesForGraph,
  buildGraph,
  computeStats,
  formatConsoleReport,
  formatDotGraph,
  formatMarkdownReport,
  generateHtmlVisualization,
  GraphNode,
} from './graph.js'
import * as fs from 'fs'
import * as path from 'path'

vi.mock('fs')
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path')
  return { ...actual }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNodes(defs: Partial<GraphNode>[]): Map<string, GraphNode> {
  const map = new Map<string, GraphNode>()
  for (const d of defs) {
    const node: GraphNode = {
      id: d.id ?? 'unknown',
      file: d.file ?? 'Test.Mode',
      path: d.path ?? [],
      type: d.type ?? 'color',
      value: d.value ?? '#000',
      aliasTarget: d.aliasTarget ?? null,
    }
    map.set(node.id, node)
  }
  return map
}

function tokenFile(tokens: Record<string, { $type: string; $value: string | number }>) {
  const result: Record<string, unknown> = {}
  for (const [dotPath, token] of Object.entries(tokens)) {
    const parts = dotPath.split('.')
    let current: Record<string, unknown> = result
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {}
      current = current[parts[i]] as Record<string, unknown>
    }
    current[parts[parts.length - 1]] = { $type: token.$type, $value: token.$value }
  }
  return JSON.stringify(result)
}

// ---------------------------------------------------------------------------
// readTokenFilesForGraph
// ---------------------------------------------------------------------------

describe('readTokenFilesForGraph', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('reads and flattens token files into graph nodes', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      'Primitives.Value.json' as unknown as fs.Dirent,
      'Brand.Bayernwerk.json' as unknown as fs.Dirent,
    ])

    vi.mocked(fs.readFileSync).mockImplementation((filePath: fs.PathOrFileDescriptor) => {
      const p = String(filePath)
      if (p.includes('Primitives.Value.json')) {
        return tokenFile({
          'Colors.red.500': { $type: 'color', $value: '#ff0000' },
          'Colors.blue.500': { $type: 'color', $value: '#0000ff' },
        })
      }
      if (p.includes('Brand.Bayernwerk.json')) {
        return tokenFile({
          'Colors.primary': { $type: 'color', $value: '{Colors.red.500}' },
        })
      }
      return ''
    })

    const nodes = readTokenFilesForGraph('tokens')

    expect(nodes.size).toBe(3)
    expect(nodes.has('Primitives.Value/Colors/red/500')).toBe(true)
    expect(nodes.has('Primitives.Value/Colors/blue/500')).toBe(true)
    expect(nodes.has('Brand.Bayernwerk/Colors/primary')).toBe(true)

    const aliasNode = nodes.get('Brand.Bayernwerk/Colors/primary')!
    expect(aliasNode.aliasTarget).toBe('Colors.red.500')
    expect(aliasNode.type).toBe('color')
  })

  it('skips empty files', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['empty.Mode.json' as unknown as fs.Dirent])
    vi.mocked(fs.readFileSync).mockReturnValue('   ')

    const nodes = readTokenFilesForGraph('tokens')
    expect(nodes.size).toBe(0)
  })

  it('only reads .json files', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      'Primitives.Value.json' as unknown as fs.Dirent,
      'README.md' as unknown as fs.Dirent,
      '.DS_Store' as unknown as fs.Dirent,
    ])

    vi.mocked(fs.readFileSync).mockReturnValue(
      tokenFile({ 'Colors.red': { $type: 'color', $value: '#ff0000' } }),
    )

    const nodes = readTokenFilesForGraph('tokens')
    expect(nodes.size).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// buildGraph — basic edge building
// ---------------------------------------------------------------------------

describe('buildGraph', () => {
  it('creates edges for alias references that resolve', () => {
    const nodes = makeNodes([
      { id: 'Prim.Value/Colors/red/500', file: 'Prim.Value', value: '#ff0000' },
      {
        id: 'Brand.BW/Colors/primary',
        file: 'Brand.BW',
        value: '{Colors.red.500}',
        aliasTarget: 'Colors.red.500',
      },
    ])

    const graph = buildGraph(nodes)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]).toEqual({
      from: 'Brand.BW/Colors/primary',
      to: 'Prim.Value/Colors/red/500',
    })
    expect(graph.danglingAliases).toHaveLength(0)
  })

  it('detects dangling aliases', () => {
    const nodes = makeNodes([
      {
        id: 'Brand.BW/Colors/focus',
        file: 'Brand.BW',
        value: '{Colors.Foundation.Focus}',
        aliasTarget: 'Colors.Foundation.Focus',
      },
    ])

    const graph = buildGraph(nodes)
    expect(graph.edges).toHaveLength(0)
    expect(graph.danglingAliases).toHaveLength(1)
    expect(graph.danglingAliases[0].rawAlias).toBe('{Colors.Foundation.Focus}')
    expect(graph.danglingAliases[0].targetId).toBe('Colors.Foundation.Focus')
  })

  it('detects circular references', () => {
    const nodes = makeNodes([
      { id: 'F.M/A', file: 'F.M', value: '{B}', aliasTarget: 'B' },
      { id: 'F.M/B', file: 'F.M', value: '{C}', aliasTarget: 'C' },
      { id: 'F.M/C', file: 'F.M', value: '{A}', aliasTarget: 'A' },
    ])

    const graph = buildGraph(nodes)
    expect(graph.cycles.length).toBeGreaterThan(0)
    // The cycle should contain A, B, C
    const cyclePaths = graph.cycles.flatMap((c) => c.path)
    expect(cyclePaths).toContain('F.M/A')
    expect(cyclePaths).toContain('F.M/B')
    expect(cyclePaths).toContain('F.M/C')
  })

  it('detects orphaned tokens (raw values never referenced)', () => {
    const nodes = makeNodes([
      { id: 'Prim.V/Colors/red', file: 'Prim.V', value: '#ff0000' },
      { id: 'Prim.V/Colors/blue', file: 'Prim.V', value: '#0000ff' },
      {
        id: 'Brand.BW/primary',
        file: 'Brand.BW',
        value: '{Colors.red}',
        aliasTarget: 'Colors.red',
      },
    ])

    const graph = buildGraph(nodes)
    // red is referenced by Brand.BW/primary, blue is orphaned
    expect(graph.orphanedTokens).toContain('Prim.V/Colors/blue')
    expect(graph.orphanedTokens).not.toContain('Prim.V/Colors/red')
  })

  it('computes chain depths correctly', () => {
    const nodes = makeNodes([
      { id: 'F.M/raw', file: 'F.M', value: '#000' },
      { id: 'F.M/alias1', file: 'F.M', value: '{raw}', aliasTarget: 'raw' },
      { id: 'F.M/alias2', file: 'F.M', value: '{alias1}', aliasTarget: 'alias1' },
      { id: 'F.M/alias3', file: 'F.M', value: '{alias2}', aliasTarget: 'alias2' },
    ])

    const graph = buildGraph(nodes)
    expect(graph.maxChainDepth).toBe(3)
    expect(graph.chainDepths.get('F.M/raw')).toBe(0)
    expect(graph.chainDepths.get('F.M/alias1')).toBe(1)
    expect(graph.chainDepths.get('F.M/alias2')).toBe(2)
    expect(graph.chainDepths.get('F.M/alias3')).toBe(3)
  })

  it('handles cross-file alias resolution', () => {
    const nodes = makeNodes([
      { id: 'Primitives.Value/Spacing/base', file: 'Primitives.Value', value: 16, type: 'number' },
      {
        id: 'ScreenType.Desktop/Spacing/base',
        file: 'ScreenType.Desktop',
        value: '{Spacing.base}',
        aliasTarget: 'Spacing.base',
        type: 'number',
      },
    ])

    const graph = buildGraph(nodes)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].to).toBe('Primitives.Value/Spacing/base')
  })
})

// ---------------------------------------------------------------------------
// computeStats
// ---------------------------------------------------------------------------

describe('computeStats', () => {
  it('computes correct statistics', () => {
    const nodes = makeNodes([
      { id: 'Prim.V/Colors/red', file: 'Prim.V', value: '#ff0000', type: 'color' },
      { id: 'Prim.V/Spacing/sm', file: 'Prim.V', value: 8, type: 'number' },
      {
        id: 'Brand.BW/primary',
        file: 'Brand.BW',
        value: '{Colors.red}',
        aliasTarget: 'Colors.red',
        type: 'color',
      },
    ])

    const graph = buildGraph(nodes)
    const stats = computeStats(graph)

    expect(stats.totalTokens).toBe(3)
    expect(stats.aliasTokens).toBe(1)
    expect(stats.aliasPercentage).toBe(33)
    expect(stats.fileCount).toBe(2)
    expect(stats.tokensByFile.get('Prim.V')).toBe(2)
    expect(stats.tokensByFile.get('Brand.BW')).toBe(1)
    expect(stats.tokensByType.get('color')).toBe(2)
    expect(stats.tokensByType.get('number')).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Format outputs
// ---------------------------------------------------------------------------

describe('formatConsoleReport', () => {
  it('generates readable console output', () => {
    const nodes = makeNodes([
      { id: 'Prim.V/Colors/red', file: 'Prim.V', value: '#ff0000' },
      {
        id: 'Brand.BW/primary',
        file: 'Brand.BW',
        value: '{Colors.red}',
        aliasTarget: 'Colors.red',
      },
    ])
    const graph = buildGraph(nodes)
    const stats = computeStats(graph)
    const report = formatConsoleReport(graph, stats)

    expect(report).toContain('Token Dependency Graph')
    expect(report).toContain('Total tokens:')
    expect(report).toContain('Alias tokens:')
    expect(report).toContain('Max chain depth:')
  })

  it('includes dangling alias details when present', () => {
    const nodes = makeNodes([
      {
        id: 'Brand.BW/focus',
        file: 'Brand.BW',
        value: '{Missing.Token}',
        aliasTarget: 'Missing.Token',
      },
    ])
    const graph = buildGraph(nodes)
    const stats = computeStats(graph)
    const report = formatConsoleReport(graph, stats)

    expect(report).toContain('Dangling aliases')
    expect(report).toContain('{Missing.Token}')
  })
})

describe('formatDotGraph', () => {
  it('generates valid DOT format', () => {
    const nodes = makeNodes([
      { id: 'Prim.V/red', file: 'Prim.V', value: '#ff0000' },
      { id: 'Brand.BW/primary', file: 'Brand.BW', value: '{red}', aliasTarget: 'red' },
    ])
    const graph = buildGraph(nodes)
    const dot = formatDotGraph(graph)

    expect(dot).toContain('digraph TokenDependencies')
    expect(dot).toContain('rankdir=LR')
    expect(dot).toContain('cluster_Prim_V')
    expect(dot).toContain('cluster_Brand_BW')
    expect(dot).toContain('->')
  })
})

describe('formatMarkdownReport', () => {
  it('generates valid markdown', () => {
    const nodes = makeNodes([{ id: 'Prim.V/red', file: 'Prim.V', value: '#ff0000' }])
    const graph = buildGraph(nodes)
    const stats = computeStats(graph)
    const md = formatMarkdownReport(graph, stats)

    expect(md).toContain('# Token Dependency Graph Report')
    expect(md).toContain('| Metric | Value |')
    expect(md).toContain('| Total tokens |')
  })
})

describe('generateHtmlVisualization', () => {
  it('generates HTML with embedded data', () => {
    const nodes = makeNodes([
      { id: 'Prim.V/red', file: 'Prim.V', value: '#ff0000' },
      { id: 'Brand.BW/primary', file: 'Brand.BW', value: '{red}', aliasTarget: 'red' },
    ])
    const graph = buildGraph(nodes)
    const stats = computeStats(graph)
    const html = generateHtmlVisualization(graph, stats)

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Token Dependency Graph')
    expect(html).toContain('const DATA =')
    expect(html).toContain('Prim.V/red')
    expect(html).toContain('Brand.BW/primary')
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty token set', () => {
    const nodes = new Map<string, GraphNode>()
    const graph = buildGraph(nodes)
    const stats = computeStats(graph)

    expect(stats.totalTokens).toBe(0)
    expect(stats.aliasPercentage).toBe(0)
    expect(graph.maxChainDepth).toBe(0)
    expect(graph.cycles).toHaveLength(0)
  })

  it('handles self-referencing alias (immediate cycle)', () => {
    const nodes = makeNodes([{ id: 'F.M/self', file: 'F.M', value: '{self}', aliasTarget: 'self' }])
    const graph = buildGraph(nodes)
    expect(graph.cycles.length).toBeGreaterThan(0)
  })

  it('handles multiple aliases pointing to the same target', () => {
    const nodes = makeNodes([
      { id: 'Prim.V/base', file: 'Prim.V', value: '#000' },
      { id: 'Brand.A/x', file: 'Brand.A', value: '{base}', aliasTarget: 'base' },
      { id: 'Brand.B/y', file: 'Brand.B', value: '{base}', aliasTarget: 'base' },
    ])
    const graph = buildGraph(nodes)
    expect(graph.edges).toHaveLength(2)
    expect(graph.danglingAliases).toHaveLength(0)
  })

  it('resolves aliases across files correctly', () => {
    const nodes = makeNodes([
      { id: 'Prim.V/Colors/red/500', file: 'Prim.V', value: '#ff0000' },
      { id: 'Prim.V/Colors/red/600', file: 'Prim.V', value: '#cc0000' },
      {
        id: 'Brand.BW/Colors/primary',
        file: 'Brand.BW',
        value: '{Colors.red.500}',
        aliasTarget: 'Colors.red.500',
      },
    ])
    const graph = buildGraph(nodes)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].to).toBe('Prim.V/Colors/red/500')
  })
})
