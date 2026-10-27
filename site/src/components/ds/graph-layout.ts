/**
 * Where the dependency graph draws things (GraphCanvas, TICKET-078; board
 * docs/specs/playground/prototypes/Graph.dc.html). Not a component: pure geometry on plain data,
 * so it renders the same in a story (static HTML) and in the playground, and is tested alone.
 *
 * - **Layers as columns**, left to right in the order given (Primitives · Brand · ScreenType).
 *   Arrows run from an alias to the token it uses, so a chain reads right to left.
 * - **Few crossings without a layout engine.** A layer's groups are ordered by the layers to its
 *   right that use them (in the order those use them; unused groups last), and every layer after
 *   the first starts level with the topmost group it points into, so the ScreenType column starts
 *   beside the spacing it uses and its arrows pass under the Brand column.
 * - **Fixed drawing size**: a column is `NODE_WIDTH` wide with `GUTTER` between columns (three
 *   columns fit beside the detail panel at 1280 px); a narrower view scrolls the canvas inside
 *   its own box. Phones get the list (GraphList) instead.
 */

export type GraphSeverity = 'error' | 'warning'

/** One token in one mode, as a row of the graph. */
export interface GraphNodeData {
  /** Graph id: `Collection.Mode/Group/Token` (`@dta/core`'s `analyzeGraph`), or `missing:<name>`. */
  id: string
  /** Full name, dot form: `Colors.Brand.Accent`. */
  name: string
  /** The group label the row sits under (`Colors.Brand`) and its own part (`Accent`). */
  group: string
  leaf: string
  /** The value it resolves to in the modes shown (`#3b8fd9`, `16`); none when it does not. */
  value?: string
  /** A CSS colour for a swatch (decoration; the value says it). */
  swatch?: string
  /** The alias chain after the token, names in dot form (`Colors.Foundation.Sky.500`). */
  via?: readonly string[]
  /** Why it does not resolve, short (`does not exist`, `circular`). */
  problem?: string
  /** The worst lint finding on it. */
  severity?: GraphSeverity
  /** A raw value no alias uses. */
  unused?: boolean
  /** The target of a dangling alias: drawn so the broken arrow has somewhere to point. */
  missing?: boolean
}

/** A finding about a whole layer (a file), shown on its header. */
export interface GraphLayerFinding {
  /** Passed back to `onFinding`. */
  id: string
  severity: GraphSeverity
  /** Short, after the word: `default mode name`. */
  text: string
}

export interface GraphGroupData {
  label: string
  nodes: readonly GraphNodeData[]
}

/** One collection in one mode: a column. */
export interface GraphLayerData {
  /** The collection's name, the column's kicker. */
  collection: string
  /** The mode shown. */
  mode: string
  /** `26 tokens`. */
  count: string
  findings?: readonly GraphLayerFinding[]
  /** The layer's worst finding and its count, for the list's summary (`1 error`). */
  status?: { severity: GraphSeverity; text: string }
  groups: readonly GraphGroupData[]
}

export type GraphEdgeKind = 'alias' | 'circular' | 'dangling'

/** From an alias to the token it uses. */
export interface GraphEdgeData {
  from: string
  to: string
  kind: GraphEdgeKind
}

export interface GraphData {
  layers: readonly GraphLayerData[]
  edges: readonly GraphEdgeData[]
}

/** Column width and the space between columns, in px (three columns: 716 px). */
export const NODE_WIDTH = 208
export const GUTTER = 46
/** A row's height, the step from row to row, a group label's line and the space after a group. */
export const ROW_HEIGHT = 26
export const ROW_STEP = 30
export const LABEL_HEIGHT = 22
const GROUP_GAP = 12
/** Length of an arrowhead and how far a same-column arc swings out (down, up). */
export const ARROW = 7
const ARC_DOWN = 24
const ARC_UP = 38

export interface PlacedNode {
  node: GraphNodeData
  layer: number
  x: number
  y: number
}

export interface PlacedLabel {
  text: string
  layer: number
  x: number
  y: number
}

export interface PlacedEdge extends GraphEdgeData {
  /** SVG path from the alias to the arrowhead's base. */
  d: string
  /** The arrowhead (SVG polygon points), its tip on the target's edge. */
  arrow: string
  /** Where a circular pair's chip sits (its middle left), once per pair. */
  chip?: { x: number; y: number }
}

export interface GraphLayout {
  width: number
  height: number
  /** Left edge of each column. */
  columns: number[]
  /** Every row, layer by layer, top to bottom (the order the arrow keys walk). */
  nodes: PlacedNode[]
  labels: PlacedLabel[]
  edges: PlacedEdge[]
}

const columnX = (layer: number) => layer * (NODE_WIDTH + GUTTER)

/**
 * A layer's groups in drawing order: groups the layers to its right use come first, in the
 * order they use them (layer by layer, row by row); groups nothing to the right uses keep their
 * order after them.
 */
export function orderGroups(data: GraphData, layer: number): GraphGroupData[] {
  const groups = data.layers[layer]?.groups ?? []
  const groupOf = new Map<string, number>()
  groups.forEach((group, index) => {
    for (const node of group.nodes) groupOf.set(node.id, index)
  })
  const targets = new Map<string, string[]>()
  for (const edge of data.edges)
    targets.set(edge.from, [...(targets.get(edge.from) ?? []), edge.to])
  const used: number[] = []
  for (const later of data.layers.slice(layer + 1)) {
    for (const group of later.groups) {
      for (const node of group.nodes) {
        for (const to of targets.get(node.id) ?? []) {
          const index = groupOf.get(to)
          if (index !== undefined && !used.includes(index)) used.push(index)
        }
      }
    }
  }
  const rest = groups.map((_, index) => index).filter((index) => !used.includes(index))
  return [...used, ...rest].map((index) => groups[index])
}

/** Places the layers, groups, rows and arrows of a graph. */
export function layoutGraph(data: GraphData): GraphLayout {
  const nodes: PlacedNode[] = []
  const labels: PlacedLabel[] = []
  const at = new Map<string, PlacedNode>()
  const labelOf = new Map<string, number>()
  const targets = new Map<string, string[]>()
  for (const edge of data.edges)
    targets.set(edge.from, [...(targets.get(edge.from) ?? []), edge.to])
  let height = 0

  data.layers.forEach((_, layer) => {
    const x = columnX(layer)
    const groups = orderGroups(data, layer)
    // Start level with the topmost group this layer points into (to its left), else at the top.
    let top = Infinity
    for (const group of groups) {
      for (const node of group.nodes) {
        for (const to of targets.get(node.id) ?? []) {
          const target = at.get(to)
          if (target && target.layer < layer) top = Math.min(top, labelOf.get(to) ?? target.y)
        }
      }
    }
    let y = Number.isFinite(top) ? top : 0
    for (const group of groups) {
      labels.push({ text: group.label, layer, x, y })
      const labelY = y
      y += LABEL_HEIGHT
      for (const node of group.nodes) {
        const placed = { node, layer, x, y }
        nodes.push(placed)
        at.set(node.id, placed)
        labelOf.set(node.id, labelY)
        y += ROW_STEP
      }
      y += GROUP_GAP
    }
    height = Math.max(height, y - GROUP_GAP)
  })

  const edges: PlacedEdge[] = []
  const pairs = new Set<string>()
  for (const edge of data.edges) {
    const from = at.get(edge.from)
    const to = at.get(edge.to)
    if (!from || !to) continue
    const y1 = from.y + ROW_HEIGHT / 2
    const y2 = to.y + ROW_HEIGHT / 2
    if (from.layer === to.layer) {
      // An arc on the right of the column; the two arcs of a pair swing out by different amounts.
      const right = from.x + NODE_WIDTH
      const swing = y2 > y1 ? ARC_DOWN : ARC_UP
      const end = right + ARROW
      const key = [edge.from, edge.to].sort().join('|')
      const chip = edge.kind === 'circular' && !pairs.has(key)
      pairs.add(key)
      edges.push({
        ...edge,
        d: `M ${right} ${y1} C ${right + swing} ${y1}, ${right + swing} ${y2}, ${end} ${y2}`,
        arrow: arrowLeft(right, y2),
        ...(chip ? { chip: { x: right + ARC_UP + 4, y: (y1 + y2) / 2 } } : {}),
      })
      continue
    }
    if (from.layer > to.layer) {
      // Right to left: from the alias's left edge to the target's right edge.
      const x1 = from.x
      const tip = to.x + NODE_WIDTH
      const x2 = tip + ARROW
      const bend = Math.max(GUTTER / 2, (x1 - x2) / 2)
      edges.push({
        ...edge,
        d: `M ${x1} ${y1} C ${x1 - bend} ${y1}, ${x2 + bend} ${y2}, ${x2} ${y2}`,
        arrow: arrowLeft(tip, y2),
      })
      continue
    }
    // Left to right (an alias into a layer further right).
    const x1 = from.x + NODE_WIDTH
    const tip = to.x
    const x2 = tip - ARROW
    const bend = Math.max(GUTTER / 2, (x2 - x1) / 2)
    edges.push({
      ...edge,
      d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
      arrow: arrowRight(tip, y2),
    })
  }

  const count = data.layers.length
  return {
    width: count === 0 ? 0 : count * NODE_WIDTH + (count - 1) * GUTTER,
    height,
    columns: data.layers.map((_, layer) => columnX(layer)),
    nodes,
    labels,
    edges,
  }
}

const arrowLeft = (tip: number, y: number) =>
  `${tip},${y} ${tip + ARROW},${y - 4} ${tip + ARROW},${y + 4}`
const arrowRight = (tip: number, y: number) =>
  `${tip},${y} ${tip - ARROW},${y - 4} ${tip - ARROW},${y + 4}`

/**
 * A token's alias chain as drawn: the token, then each node its arrows lead to, and the arrows
 * on the way (stops at a node it has passed, so a circle ends).
 */
export function chainOf(
  edges: readonly GraphEdgeData[],
  start: string | undefined,
): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>()
  const used = new Set<string>()
  if (!start) return { nodes, edges: used }
  const next = new Map(edges.map((edge) => [edge.from, edge.to]))
  for (let id: string | undefined = start; id !== undefined && !nodes.has(id); id = next.get(id)) {
    nodes.add(id)
    const to = next.get(id)
    if (to !== undefined) used.add(edgeKey({ from: id, to }))
  }
  return { nodes, edges: used }
}

export const edgeKey = (edge: { from: string; to: string }) => `${edge.from}→${edge.to}`

export type GraphKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'

/**
 * Where a key moves the focus from a row: up and down within the column; left along the alias
 * to the token it uses (else the nearest row in the column to the left); right back to a token
 * that uses it (else the nearest row to the right); Home and End to the column's first and last.
 * Missing targets are drawn but not focusable. Returns the id, or undefined to stay.
 */
export function moveFocus(
  layout: GraphLayout,
  edges: readonly GraphEdgeData[],
  from: string,
  key: GraphKey,
): string | undefined {
  const focusable = layout.nodes.filter((placed) => !placed.node.missing)
  const here = focusable.find((placed) => placed.node.id === from)
  if (!here) return focusable[0]?.node.id
  const column = (layer: number) => focusable.filter((placed) => placed.layer === layer)
  const own = column(here.layer)
  const index = own.indexOf(here)
  const nearest = (candidates: PlacedNode[]) =>
    candidates.reduce<PlacedNode | undefined>(
      (best, placed) =>
        !best || Math.abs(placed.y - here.y) < Math.abs(best.y - here.y) ? placed : best,
      undefined,
    )?.node.id
  const ids = new Set(focusable.map((placed) => placed.node.id))
  switch (key) {
    case 'ArrowUp':
      return own[index - 1]?.node.id
    case 'ArrowDown':
      return own[index + 1]?.node.id
    case 'Home':
      return own[0]?.node.id
    case 'End':
      return own[own.length - 1]?.node.id
    case 'ArrowLeft': {
      const target = edges.find((edge) => edge.from === from && ids.has(edge.to))
      if (target) return target.to
      return nearest(column(here.layer - 1))
    }
    case 'ArrowRight': {
      const users = new Set(edges.filter((edge) => edge.to === from).map((edge) => edge.from))
      const back = focusable.filter((placed) => users.has(placed.node.id))
      return nearest(back) ?? nearest(column(here.layer + 1))
    }
  }
}
