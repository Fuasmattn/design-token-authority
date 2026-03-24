import { describe, it, expect } from 'vitest'
import type { GraphNode, TokenGraph } from './graph.js'
import type { LintConfig } from './config/index.js'
import { lintGraph, contrastRatio } from './linter.js'

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

function emptyGraph(nodes: Map<string, GraphNode>): TokenGraph {
  return {
    nodes,
    edges: [],
    cycles: [],
    danglingAliases: [],
    orphanedTokens: [],
    maxChainDepth: 0,
    chainDepths: new Map(),
  }
}

// ---------------------------------------------------------------------------
// Built-in rules
// ---------------------------------------------------------------------------

describe('no-dangling-aliases', () => {
  it('reports dangling aliases from graph', () => {
    const nodes = makeNodes([])
    const graph = emptyGraph(nodes)
    graph.danglingAliases = [
      {
        sourceId: 'Brand.BW/Colors/Primary',
        sourceFile: 'Brand.BW',
        rawAlias: '{Colors.Missing}',
        targetId: 'Colors/Missing',
      },
    ]

    const result = lintGraph(nodes, graph)
    expect(result.errorCount).toBe(1)
    expect(result.violations[0].rule).toBe('no-dangling-aliases')
    expect(result.violations[0].severity).toBe('error')
    expect(result.violations[0].message).toContain('Colors.Missing')
  })

  it('reports no violations when graph has no dangling aliases', () => {
    const nodes = makeNodes([])
    const graph = emptyGraph(nodes)

    const result = lintGraph(nodes, graph)
    const dangling = result.violations.filter((v) => v.rule === 'no-dangling-aliases')
    expect(dangling).toHaveLength(0)
  })
})

describe('no-circular-aliases', () => {
  it('reports circular aliases from graph', () => {
    const nodes = makeNodes([])
    const graph = emptyGraph(nodes)
    graph.cycles = [{ path: ['A', 'B', 'C', 'A'] }]

    const result = lintGraph(nodes, graph)
    const circular = result.violations.filter((v) => v.rule === 'no-circular-aliases')
    expect(circular).toHaveLength(1)
    expect(circular[0].severity).toBe('error')
    expect(circular[0].message).toContain('A → B → C → A')
  })
})

describe('no-default-mode-names', () => {
  it('flags "Mode 1" as default mode name', () => {
    const nodes = makeNodes([
      { id: 'Collection.Mode 1/Colors/Red', file: 'Collection.Mode 1', path: ['Colors', 'Red'] },
    ])
    const graph = emptyGraph(nodes)

    const result = lintGraph(nodes, graph)
    const modeViolations = result.violations.filter((v) => v.rule === 'no-default-mode-names')
    expect(modeViolations).toHaveLength(1)
    expect(modeViolations[0].message).toContain('Mode 1')
  })

  it('flags "Mode1" as default mode name', () => {
    const nodes = makeNodes([
      { id: 'Collection.Mode1/Colors/Red', file: 'Collection.Mode1', path: ['Colors', 'Red'] },
    ])
    const graph = emptyGraph(nodes)

    const result = lintGraph(nodes, graph)
    const modeViolations = result.violations.filter((v) => v.rule === 'no-default-mode-names')
    expect(modeViolations).toHaveLength(1)
  })

  it('does not flag custom mode names', () => {
    const nodes = makeNodes([
      {
        id: 'Brand.Bayernwerk/Colors/Red',
        file: 'Brand.Bayernwerk',
        path: ['Colors', 'Red'],
      },
    ])
    const graph = emptyGraph(nodes)

    const result = lintGraph(nodes, graph)
    const modeViolations = result.violations.filter((v) => v.rule === 'no-default-mode-names')
    expect(modeViolations).toHaveLength(0)
  })

  it('only reports each file once', () => {
    const nodes = makeNodes([
      { id: 'C.Mode 2/A', file: 'C.Mode 2', path: ['A'] },
      { id: 'C.Mode 2/B', file: 'C.Mode 2', path: ['B'] },
    ])
    const graph = emptyGraph(nodes)

    const result = lintGraph(nodes, graph)
    const modeViolations = result.violations.filter((v) => v.rule === 'no-default-mode-names')
    expect(modeViolations).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Configurable rules
// ---------------------------------------------------------------------------

describe('semantic-must-alias', () => {
  it('flags raw values in specified collections', () => {
    const nodes = makeNodes([
      {
        id: 'Brand.BW/Colors/Primary',
        file: 'Brand.BW',
        path: ['Colors', 'Primary'],
        value: '#003f8a',
        aliasTarget: null,
      },
      {
        id: 'Brand.BW/Colors/Secondary',
        file: 'Brand.BW',
        path: ['Colors', 'Secondary'],
        value: '{Colors.Blue.500}',
        aliasTarget: 'Primitives.Default/Colors/Blue/500',
      },
    ])
    const graph = emptyGraph(nodes)
    const config: LintConfig = {
      rules: { 'semantic-must-alias': { collections: ['Brand'] } },
    }

    const result = lintGraph(nodes, graph, config)
    const violations = result.violations.filter((v) => v.rule === 'semantic-must-alias')
    expect(violations).toHaveLength(1)
    expect(violations[0].severity).toBe('warn')
    expect(violations[0].tokenPath).toBe('Brand.BW/Colors/Primary')
  })

  it('does not flag tokens in unspecified collections', () => {
    const nodes = makeNodes([
      {
        id: 'Primitives.Default/Colors/Red',
        file: 'Primitives.Default',
        path: ['Colors', 'Red'],
        value: '#ff0000',
        aliasTarget: null,
      },
    ])
    const graph = emptyGraph(nodes)
    const config: LintConfig = {
      rules: { 'semantic-must-alias': { collections: ['Brand'] } },
    }

    const result = lintGraph(nodes, graph, config)
    const violations = result.violations.filter((v) => v.rule === 'semantic-must-alias')
    expect(violations).toHaveLength(0)
  })

  it('respects severity: off', () => {
    const nodes = makeNodes([
      {
        id: 'Brand.BW/Colors/Primary',
        file: 'Brand.BW',
        path: ['Colors', 'Primary'],
        value: '#003f8a',
        aliasTarget: null,
      },
    ])
    const graph = emptyGraph(nodes)
    const config: LintConfig = {
      rules: { 'semantic-must-alias': { severity: 'off', collections: ['Brand'] } },
    }

    const result = lintGraph(nodes, graph, config)
    const violations = result.violations.filter((v) => v.rule === 'semantic-must-alias')
    expect(violations).toHaveLength(0)
  })

  it('respects severity: error', () => {
    const nodes = makeNodes([
      {
        id: 'Brand.BW/Colors/Primary',
        file: 'Brand.BW',
        path: ['Colors', 'Primary'],
        value: '#003f8a',
        aliasTarget: null,
      },
    ])
    const graph = emptyGraph(nodes)
    const config: LintConfig = {
      rules: { 'semantic-must-alias': { severity: 'error', collections: ['Brand'] } },
    }

    const result = lintGraph(nodes, graph, config)
    const violations = result.violations.filter((v) => v.rule === 'semantic-must-alias')
    expect(violations).toHaveLength(1)
    expect(violations[0].severity).toBe('error')
  })
})

describe('naming-pattern', () => {
  it('flags token names not matching the pattern', () => {
    const nodes = makeNodes([
      {
        id: 'Primitives.Default/Colors/RED_500',
        file: 'Primitives.Default',
        path: ['Colors', 'RED_500'],
      },
    ])
    const graph = emptyGraph(nodes)
    const config: LintConfig = {
      rules: { 'naming-pattern': { patterns: { Primitives: '^[A-Za-z][a-z0-9-]*$' } } },
    }

    const result = lintGraph(nodes, graph, config)
    const violations = result.violations.filter((v) => v.rule === 'naming-pattern')
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('RED_500')
  })

  it('passes when all names match', () => {
    const nodes = makeNodes([
      {
        id: 'Primitives.Default/colors/red-500',
        file: 'Primitives.Default',
        path: ['colors', 'red-500'],
      },
    ])
    const graph = emptyGraph(nodes)
    const config: LintConfig = {
      rules: { 'naming-pattern': { patterns: { Primitives: '^[a-z][a-z0-9-]*$' } } },
    }

    const result = lintGraph(nodes, graph, config)
    const violations = result.violations.filter((v) => v.rule === 'naming-pattern')
    expect(violations).toHaveLength(0)
  })
})

describe('color-contrast', () => {
  it('flags low contrast pairs', () => {
    const nodes = makeNodes([
      {
        id: 'Primitives.Default/Colors/LightGray',
        file: 'Primitives.Default',
        path: ['Colors', 'LightGray'],
        type: 'color',
        value: '#cccccc',
      },
      {
        id: 'Primitives.Default/Colors/White',
        file: 'Primitives.Default',
        path: ['Colors', 'White'],
        type: 'color',
        value: '#ffffff',
      },
    ])
    const graph = emptyGraph(nodes)
    const config: LintConfig = {
      rules: {
        'color-contrast': {
          minRatio: 4.5,
          pairs: [['Colors/LightGray', 'Colors/White']],
        },
      },
    }

    const result = lintGraph(nodes, graph, config)
    const violations = result.violations.filter((v) => v.rule === 'color-contrast')
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('below 4.5:1')
  })

  it('passes for high contrast pairs', () => {
    const nodes = makeNodes([
      {
        id: 'Primitives.Default/Colors/Black',
        file: 'Primitives.Default',
        path: ['Colors', 'Black'],
        type: 'color',
        value: '#000000',
      },
      {
        id: 'Primitives.Default/Colors/White',
        file: 'Primitives.Default',
        path: ['Colors', 'White'],
        type: 'color',
        value: '#ffffff',
      },
    ])
    const graph = emptyGraph(nodes)
    const config: LintConfig = {
      rules: {
        'color-contrast': {
          minRatio: 4.5,
          pairs: [['Colors/Black', 'Colors/White']],
        },
      },
    }

    const result = lintGraph(nodes, graph, config)
    const violations = result.violations.filter((v) => v.rule === 'color-contrast')
    expect(violations).toHaveLength(0)
  })
})

describe('no-duplicate-values', () => {
  it('flags tokens with identical raw values', () => {
    const nodes = makeNodes([
      {
        id: 'Primitives.Default/Colors/Red',
        file: 'Primitives.Default',
        path: ['Colors', 'Red'],
        type: 'color',
        value: '#ff0000',
        aliasTarget: null,
      },
      {
        id: 'Primitives.Default/Colors/Danger',
        file: 'Primitives.Default',
        path: ['Colors', 'Danger'],
        type: 'color',
        value: '#ff0000',
        aliasTarget: null,
      },
    ])
    const graph = emptyGraph(nodes)
    const config: LintConfig = {
      rules: { 'no-duplicate-values': {} },
    }

    const result = lintGraph(nodes, graph, config)
    const violations = result.violations.filter((v) => v.rule === 'no-duplicate-values')
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('#ff0000')
  })

  it('does not flag aliases', () => {
    const nodes = makeNodes([
      {
        id: 'Brand.BW/Colors/Primary',
        file: 'Brand.BW',
        path: ['Colors', 'Primary'],
        type: 'color',
        value: '{Colors.Red}',
        aliasTarget: 'Primitives.Default/Colors/Red',
      },
      {
        id: 'Brand.BW/Colors/Accent',
        file: 'Brand.BW',
        path: ['Colors', 'Accent'],
        type: 'color',
        value: '{Colors.Red}',
        aliasTarget: 'Primitives.Default/Colors/Red',
      },
    ])
    const graph = emptyGraph(nodes)
    const config: LintConfig = {
      rules: { 'no-duplicate-values': {} },
    }

    const result = lintGraph(nodes, graph, config)
    const violations = result.violations.filter((v) => v.rule === 'no-duplicate-values')
    expect(violations).toHaveLength(0)
  })

  it('does not flag unique values', () => {
    const nodes = makeNodes([
      {
        id: 'Primitives.Default/Colors/Red',
        file: 'Primitives.Default',
        path: ['Colors', 'Red'],
        type: 'color',
        value: '#ff0000',
        aliasTarget: null,
      },
      {
        id: 'Primitives.Default/Colors/Blue',
        file: 'Primitives.Default',
        path: ['Colors', 'Blue'],
        type: 'color',
        value: '#0000ff',
        aliasTarget: null,
      },
    ])
    const graph = emptyGraph(nodes)
    const config: LintConfig = {
      rules: { 'no-duplicate-values': {} },
    }

    const result = lintGraph(nodes, graph, config)
    const violations = result.violations.filter((v) => v.rule === 'no-duplicate-values')
    expect(violations).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// contrastRatio utility
// ---------------------------------------------------------------------------

describe('contrastRatio', () => {
  it('returns 21:1 for black on white', () => {
    const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 })
    expect(ratio).toBeCloseTo(21, 0)
  })

  it('returns 1:1 for same color', () => {
    const ratio = contrastRatio({ r: 0.5, g: 0.5, b: 0.5 }, { r: 0.5, g: 0.5, b: 0.5 })
    expect(ratio).toBeCloseTo(1, 0)
  })
})

// ---------------------------------------------------------------------------
// Overall result
// ---------------------------------------------------------------------------

describe('lintGraph result', () => {
  it('returns correct error and warning counts', () => {
    const nodes = makeNodes([
      {
        id: 'Brand.BW/Colors/Primary',
        file: 'Brand.BW',
        path: ['Colors', 'Primary'],
        value: '#003f8a',
        aliasTarget: null,
      },
    ])
    const graph = emptyGraph(nodes)
    graph.danglingAliases = [
      {
        sourceId: 'Brand.BW/Colors/X',
        sourceFile: 'Brand.BW',
        rawAlias: '{Missing}',
        targetId: 'Missing',
      },
    ]
    const config: LintConfig = {
      rules: { 'semantic-must-alias': { collections: ['Brand'] } },
    }

    const result = lintGraph(nodes, graph, config)
    expect(result.errorCount).toBe(1) // dangling alias
    expect(result.warningCount).toBe(1) // semantic-must-alias
    expect(result.violations).toHaveLength(2)
  })

  it('returns empty result for clean tokens', () => {
    const nodes = makeNodes([
      {
        id: 'Primitives.Default/Colors/Red',
        file: 'Primitives.Default',
        path: ['Colors', 'Red'],
        value: '#ff0000',
        aliasTarget: null,
      },
    ])
    const graph = emptyGraph(nodes)

    const result = lintGraph(nodes, graph)
    expect(result.errorCount).toBe(0)
    expect(result.warningCount).toBe(0)
    expect(result.violations).toHaveLength(0)
  })
})
