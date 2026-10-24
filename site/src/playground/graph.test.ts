import { analyzeGraph } from '@dta/core'
import { describe, expect, it } from 'vitest'
import { layoutGraph } from '../components/ds/graph-layout'
import { analyse } from './analyse'
import { EXAMPLE_FILES, PROBLEM_EXAMPLE } from './example'
import { buildGraph, graphModes, idInModes, parseNodeId, splitName, tokenDetail } from './graph'

const problems = analyse(PROBLEM_EXAMPLE.files)
const clean = analyse(EXAMPLE_FILES)
const BRAND = 'Brand(Alias)'
const node = (view: ReturnType<typeof buildGraph>, id: string) =>
  view.data.layers.flatMap((l) => l.groups.flatMap((g) => g.nodes)).find((n) => n.id === id)

describe('graph of the example with problems', () => {
  const view = buildGraph(problems, { [BRAND]: 'BrandA', ScreenType: 'Desktop' })

  it('has one column per layer, in the order of the 3-layer model, in the modes shown', () => {
    expect(view.data.layers.map((l) => [l.collection, l.mode, l.count])).toEqual([
      ['Primitives', 'Mode 1', '26 tokens'],
      [BRAND, 'BrandA', '11 tokens'],
      ['ScreenType', 'Desktop', '5 tokens'],
    ])
    expect(view.label).toBe('BrandA · Desktop')
    expect(view.data.layers[0].groups.map((g) => g.label)).toEqual([
      'Colors.Foundation',
      'Dimensions.spacing',
      'Dimensions.radius',
      'Effects.opacity',
      'Effects.blur',
      'Typography.FontFamily',
      'Typography.FontSize',
    ])
  })

  it('takes nodes, edges, cycles, dangling aliases and unused values from @dta/core', () => {
    const graph = analyzeGraph(problems.model!)
    const shown = graph.nodes.filter((n) => view.ids.has(n.id))
    expect(shown.length).toBe(42)
    // Every arrow is an engine edge (read into the modes shown).
    for (const edge of view.data.edges.filter((e) => e.kind !== 'dangling'))
      expect(graph.edges.some((e) => e.from === edge.from)).toBe(true)
    expect(view.data.edges.filter((e) => e.kind === 'circular')).toEqual([
      {
        from: `${BRAND}.BrandA/Colors/Surface/Muted`,
        to: `${BRAND}.BrandA/Colors/Text/Muted`,
        kind: 'circular',
      },
      {
        from: `${BRAND}.BrandA/Colors/Text/Muted`,
        to: `${BRAND}.BrandA/Colors/Surface/Muted`,
        kind: 'circular',
      },
    ])
    // Unused raw values: the engine's orphans.
    const unused = view.data.layers
      .flatMap((l) => l.groups.flatMap((g) => g.nodes))
      .filter((n) => n.unused)
      .map((n) => n.id)
    expect(unused.sort()).toEqual([...graph.orphanedTokens].sort())
  })

  it('marks findings with their severity: the circular pair, and the default mode name on its layer', () => {
    expect(node(view, `${BRAND}.BrandA/Colors/Surface/Muted`)).toMatchObject({
      severity: 'error',
      problem: 'circular',
      via: ['Colors.Text.Muted'],
    })
    expect(node(view, `${BRAND}.BrandA/Colors/Text/Muted`)?.severity).toBe('error')
    expect(view.data.layers[0].findings).toEqual([
      { id: '2-0', severity: 'error', text: 'default mode name' },
    ])
    expect(view.layerFindings.get('2-0')).toEqual({ group: 2, line: 0 })
    expect(view.data.layers.map((l) => l.status?.text)).toEqual(['1 error', '1 error', undefined])
    // BrandA's view holds 2 of the 3 errors (the circle and the default mode name).
    expect(view.note.map((p) => (typeof p === 'string' ? p : p.text)).join('')).toMatch(
      /^42 tokens in BrandA · Desktop, 16 aliases; 2 of 3 errors are in this view\./,
    )
  })

  it('resolves each row in the modes shown, with its chain and a swatch for colours', () => {
    expect(node(view, `${BRAND}.BrandA/Colors/Brand/Accent`)).toMatchObject({
      group: 'Colors.Brand',
      leaf: 'Accent',
      value: '#3b8fd9',
      swatch: '#3b8fd9',
      via: ['Colors.Foundation.Sky.500'],
    })
    expect(node(view, 'Primitives.Mode 1/Dimensions/spacing/1')).toMatchObject({
      value: '4',
      unused: true,
    })
  })

  it('offers brands and breakpoints with the findings in each', () => {
    expect(view.switcher).toEqual([
      {
        id: BRAND,
        label: 'Brand',
        selected: 'BrandA',
        options: [
          { value: 'BrandA', count: '1 error', severity: 'error' },
          { value: 'BrandB', count: '1 error', severity: 'error' },
        ],
      },
      {
        id: 'ScreenType',
        label: 'Breakpoint',
        selected: 'Desktop',
        // In the model's order (the files'), as the Structure view lists them.
        options: [{ value: 'Desktop' }, { value: 'Mobile' }, { value: 'Tablet' }],
      },
    ])
  })
})

describe('graph of BrandB: the dangling alias', () => {
  const view = buildGraph(problems, { [BRAND]: 'BrandB' })

  it('ends in a missing row in the group its name shares, right after its neighbour', () => {
    const accent = node(view, `${BRAND}.BrandB/Colors/Brand/Accent`)
    expect(accent).toMatchObject({
      severity: 'error',
      problem: 'does not exist',
      via: ['Colors.Foundation.Sky.550'],
    })
    expect(view.data.edges).toContainEqual({
      from: `${BRAND}.BrandB/Colors/Brand/Accent`,
      to: 'missing:Colors.Foundation.Sky.550',
      kind: 'dangling',
    })
    const foundation = view.data.layers[0].groups[0]
    const names = foundation.nodes.map((n) => n.leaf)
    expect(names.indexOf('Sky.550')).toBe(names.indexOf('Sky.500') + 1)
    expect(foundation.nodes.find((n) => n.missing)).toMatchObject({ severity: 'error' })
    // Missing rows are drawn, not counted as tokens.
    expect(view.data.layers[0].count).toBe('26 tokens')
  })
})

describe('token details', () => {
  const view = buildGraph(problems, { [BRAND]: 'BrandA' })

  it('reads the token in every brand like dta token get, with its names and findings', () => {
    const detail = tokenDetail(problems, view, `${BRAND}.BrandA/Colors/Brand/Accent`)
    expect(detail).toMatchObject({
      kicker: 'Token · color · Brand(Alias)',
      title: 'Colors.Brand.Accent',
      scope: 'Every brand',
      shows: 'BrandA · Desktop',
      facts: [
        { label: 'CSS', value: 'var(--colors-brand-accent)' },
        { label: 'Tailwind', value: '--color-brand-accent' },
      ],
      notes: [
        {
          severity: 'error',
          kicker: 'error · no-dangling-aliases · BrandB',
          text: 'Alias {Colors.Foundation.Sky.550} references non-existent token "Colors.Foundation.Sky.550"',
        },
      ],
      lint: { group: 0, line: 0 },
      elsewhere: [{ collection: BRAND, mode: 'BrandB' }],
    })
    expect(detail?.lines).toEqual([
      {
        name: 'BrandA',
        tag: 'in view',
        detail: '#3b8fd9  Colors.Brand.Accent → Colors.Foundation.Sky.500',
        swatch: '#3b8fd9',
      },
      {
        name: 'BrandB',
        detail:
          'unresolved: "Colors.Brand.Accent" aliases "Colors.Foundation.Sky.550", which does not exist.',
        severity: 'error',
      },
    ])
  })

  it('says when the build does not write a token, in the words of dta token get', () => {
    const detail = tokenDetail(problems, view, 'ScreenType.Desktop/Spacing/Gap')
    expect(detail?.facts).toEqual([
      {
        label: 'Build',
        value:
          'Not in the build output: dta build writes ScreenType only in the modes listed in brands.',
      },
    ])
    expect(detail?.scope).toBe('Every breakpoint')
    expect(detail?.lines.map((l) => l.name)).toEqual(['Desktop', 'Mobile', 'Tablet'])
    expect(detail?.lines[0].tag).toBe('in view')
  })

  it('has one reading for a primitive and nothing for an unknown id', () => {
    const detail = tokenDetail(problems, view, 'Primitives.Mode 1/Colors/Foundation/White')
    expect(detail?.lines).toEqual([
      { name: 'every mode', tag: 'in view', detail: '#ffffff', swatch: '#ffffff' },
    ])
    expect(detail?.scope).toBeUndefined()
    expect(tokenDetail(problems, view, 'Nowhere.X/Y')).toBeUndefined()
  })
})

describe('ids and modes', () => {
  it('splits ids by the model and moves them into other modes', () => {
    const model = problems.model!
    expect(parseNodeId(model, `${BRAND}.BrandB/Colors/Brand/Accent`)).toEqual({
      collection: BRAND,
      mode: 'BrandB',
      path: 'Colors/Brand/Accent',
    })
    expect(parseNodeId(model, `${BRAND}.BrandC/Colors/Brand/Accent`)).toBeUndefined()
    expect(parseNodeId(model, `${BRAND}.BrandA/Colors/Brand/Nope`)).toBeUndefined()
    expect(idInModes(model, `${BRAND}.BrandA/Colors/Brand/Accent`, { [BRAND]: 'BrandB' })).toBe(
      `${BRAND}.BrandB/Colors/Brand/Accent`,
    )
    expect(graphModes(model, { [BRAND]: 'Nope' })[BRAND]).toBe('BrandA')
    expect(splitName(['Spacing', 'Gap'])).toEqual({ group: 'Spacing', leaf: 'Gap' })
    expect(splitName(['Colors', 'Foundation', 'Blue', '500'])).toEqual({
      group: 'Colors.Foundation',
      leaf: 'Blue.500',
    })
  })

  it('draws the clean example without findings', () => {
    const view = buildGraph(clean)
    expect(view.data.edges.every((e) => e.kind === 'alias')).toBe(true)
    expect(view.note.join('')).toMatch(/no lint findings\./)
    expect(view.data.layers.every((l) => !l.status)).toBe(true)
  })
})

describe('layout of the graph', () => {
  const view = buildGraph(problems, { [BRAND]: 'BrandA' })
  const layout = layoutGraph(view.data)
  const at = (id: string) => layout.nodes.find((p) => p.node.id === id)!

  it('orders the primitive groups by the layer that uses them and starts ScreenType level with its targets', () => {
    const labels = layout.labels.filter((l) => l.layer === 0).map((l) => l.text)
    // Brand uses colours, the font family, then effects; ScreenType spacing, sizes, radius.
    expect(labels).toEqual([
      'Colors.Foundation',
      'Typography.FontFamily',
      'Effects.opacity',
      'Effects.blur',
      'Dimensions.spacing',
      'Typography.FontSize',
      'Dimensions.radius',
    ])
    const spacing = layout.labels.find((l) => l.text === 'Dimensions.spacing')!
    const screen = layout.labels.filter((l) => l.layer === 2)
    expect(screen[0].y).toBe(spacing.y)
    expect(layout.columns).toEqual([0, 254, 508])
    expect(layout.width).toBe(716)
  })

  it('draws an arrow from an alias to the token it uses, and arcs for the circle', () => {
    const accent = at(`${BRAND}.BrandA/Colors/Brand/Accent`)
    const sky = at('Primitives.Mode 1/Colors/Foundation/Sky/500')
    const edge = layout.edges.find((e) => e.from === accent.node.id)!
    expect(edge.d.startsWith(`M ${accent.x} ${accent.y + 13}`)).toBe(true)
    expect(edge.arrow.startsWith(`${sky.x + 208},${sky.y + 13}`)).toBe(true)
    const arcs = layout.edges.filter((e) => e.kind === 'circular')
    expect(arcs).toHaveLength(2)
    expect(arcs.filter((e) => e.chip)).toHaveLength(1)
  })
})
