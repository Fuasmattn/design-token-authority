import { describe, expect, it } from 'vitest'
import {
  ARROW,
  chainOf,
  GUTTER,
  LABEL_HEIGHT,
  layoutGraph,
  moveFocus,
  NODE_WIDTH,
  orderGroups,
  ROW_HEIGHT,
  ROW_STEP,
  type GraphData,
  type GraphNodeData,
} from './graph-layout'

const row = (id: string, extra: Partial<GraphNodeData> = {}): GraphNodeData => ({
  id,
  name: id,
  group: id.split('.')[0],
  leaf: id.split('.').slice(1).join('.'),
  ...extra,
})

/**
 * Three layers: primitives (two groups, the second used first), a brand layer with a circle,
 * and a dimension layer that aliases the second primitive group.
 */
const data: GraphData = {
  layers: [
    {
      collection: 'Base',
      mode: 'Value',
      count: '4 tokens',
      groups: [
        { label: 'size', nodes: [row('size.s'), row('size.m')] },
        { label: 'color', nodes: [row('color.blue'), row('color.grey')] },
      ],
    },
    {
      collection: 'Brand',
      mode: 'A',
      count: '3 tokens',
      groups: [
        {
          label: 'brand',
          nodes: [
            row('brand.primary'),
            row('brand.one', { severity: 'error' }),
            row('brand.two', { severity: 'error' }),
          ],
        },
      ],
    },
    {
      collection: 'Screen',
      mode: 'Desktop',
      count: '1 token',
      groups: [{ label: 'gap', nodes: [row('gap.m')] }],
    },
  ],
  edges: [
    { from: 'brand.primary', to: 'color.blue', kind: 'alias' },
    { from: 'brand.one', to: 'brand.two', kind: 'circular' },
    { from: 'brand.two', to: 'brand.one', kind: 'circular' },
    { from: 'gap.m', to: 'size.m', kind: 'alias' },
  ],
}

describe('layoutGraph', () => {
  const layout = layoutGraph(data)
  const at = (id: string) => layout.nodes.find((placed) => placed.node.id === id)!

  it('puts the groups the next layers use first, in the order they use them', () => {
    expect(orderGroups(data, 0).map((g) => g.label)).toEqual(['color', 'size'])
    expect(orderGroups(data, 2).map((g) => g.label)).toEqual(['gap'])
  })

  it('places columns side by side and rows under their group label', () => {
    expect(layout.columns).toEqual([0, NODE_WIDTH + GUTTER, 2 * (NODE_WIDTH + GUTTER)])
    expect(layout.width).toBe(3 * NODE_WIDTH + 2 * GUTTER)
    expect(at('color.blue')).toMatchObject({ layer: 0, x: 0, y: LABEL_HEIGHT })
    expect(at('color.grey').y).toBe(LABEL_HEIGHT + ROW_STEP)
    expect(at('brand.primary')).toMatchObject({ layer: 1, x: NODE_WIDTH + GUTTER, y: LABEL_HEIGHT })
  })

  it('starts a later layer level with the topmost group it points into', () => {
    const size = layout.labels.find((label) => label.text === 'size')!
    const gap = layout.labels.find((label) => label.text === 'gap')!
    expect(gap.y).toBe(size.y)
    expect(size.y).toBeGreaterThan(0)
  })

  it('draws right-to-left arrows to the target edge, arcs for a circle with one chip', () => {
    const primary = layout.edges.find((edge) => edge.from === 'brand.primary')!
    const blue = at('color.blue')
    const mid = blue.y + ROW_HEIGHT / 2
    expect(primary.d).toMatch(new RegExp(`^M ${NODE_WIDTH + GUTTER} ${mid} C `))
    expect(primary.d.endsWith(`${NODE_WIDTH + ARROW} ${mid}`)).toBe(true)
    expect(primary.arrow).toBe(
      `${NODE_WIDTH},${mid} ${NODE_WIDTH + ARROW},${mid - 4} ${NODE_WIDTH + ARROW},${mid + 4}`,
    )
    const arcs = layout.edges.filter((edge) => edge.kind === 'circular')
    expect(arcs).toHaveLength(2)
    expect(arcs.every((arc) => arc.d.startsWith(`M ${2 * NODE_WIDTH + GUTTER} `))).toBe(true)
    expect(arcs.filter((arc) => arc.chip)).toHaveLength(1)
  })

  it('draws an alias into a layer further right from left to right', () => {
    const backwards = layoutGraph({
      layers: data.layers,
      edges: [{ from: 'size.s', to: 'brand.primary', kind: 'alias' }],
    })
    const edge = backwards.edges[0]
    expect(edge.d.startsWith(`M ${NODE_WIDTH} `)).toBe(true)
    expect(edge.arrow.startsWith(`${NODE_WIDTH + GUTTER},`)).toBe(true)
  })

  it('leaves out arrows to rows that are not drawn', () => {
    const lost = layoutGraph({
      layers: data.layers,
      edges: [{ from: 'x', to: 'y', kind: 'alias' }],
    })
    expect(lost.edges).toEqual([])
    expect(layoutGraph({ layers: [], edges: [] })).toMatchObject({ width: 0, height: 0 })
  })
})

describe('chainOf', () => {
  it('follows the arrows from a token and stops at a circle', () => {
    expect([...chainOf(data.edges, 'brand.primary').nodes]).toEqual(['brand.primary', 'color.blue'])
    const circle = chainOf(data.edges, 'brand.one')
    expect([...circle.nodes]).toEqual(['brand.one', 'brand.two'])
    expect([...circle.edges]).toEqual(['brand.one→brand.two', 'brand.two→brand.one'])
    expect(chainOf(data.edges, undefined).nodes.size).toBe(0)
  })
})

describe('moveFocus', () => {
  const layout = layoutGraph(data)
  const move = (from: string, key: Parameters<typeof moveFocus>[3]) =>
    moveFocus(layout, data.edges, from, key)

  it('moves up and down a column, and to its ends', () => {
    expect(move('color.blue', 'ArrowDown')).toBe('color.grey')
    expect(move('color.grey', 'ArrowDown')).toBe('size.s')
    expect(move('color.blue', 'ArrowUp')).toBeUndefined()
    expect(move('color.grey', 'End')).toBe('size.m')
    expect(move('size.m', 'Home')).toBe('color.blue')
  })

  it('follows the alias to the left and comes back to a user on the right', () => {
    expect(move('brand.primary', 'ArrowLeft')).toBe('color.blue')
    expect(move('color.blue', 'ArrowRight')).toBe('brand.primary')
    expect(move('gap.m', 'ArrowLeft')).toBe('size.m')
    expect(move('size.m', 'ArrowRight')).toBe('gap.m')
    // No alias: the nearest row in the next column.
    expect(move('color.grey', 'ArrowRight')).toBe('brand.one')
    expect(move('color.blue', 'ArrowLeft')).toBeUndefined()
  })

  it('skips rows that are not focusable (missing targets) and starts at the first row', () => {
    const withMissing: GraphData = {
      layers: [
        {
          ...data.layers[0],
          groups: [
            {
              label: 'color',
              nodes: [row('color.blue'), row('color.gone', { missing: true }), row('color.grey')],
            },
          ],
        },
      ],
      edges: [],
    }
    const missingLayout = layoutGraph(withMissing)
    expect(moveFocus(missingLayout, [], 'color.blue', 'ArrowDown')).toBe('color.grey')
    expect(moveFocus(missingLayout, [], 'nowhere', 'ArrowDown')).toBe('color.blue')
  })
})
