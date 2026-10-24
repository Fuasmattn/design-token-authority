/**
 * The token dependency graph (playground spec decisions 3 and 5, TICKET-078; board
 * docs/specs/playground/prototypes/Graph.dc.html): one column per layer (Primitives · Brand ·
 * ScreenType, each in the mode shown), every token a row under its group label, and an arrow from
 * each alias to the token it uses. Positions come from `layoutGraph` (graph-layout.ts).
 *
 * Look: rows are ink outlines on the canvas (no cards, no shadows): the leaf name, then the value
 * with a swatch for colours, or `· unused` for a raw value no alias uses. Findings keep shape +
 * word + colour (Status colours): an error row is tinted `status-error-subtle` inside a complete
 * 2px marker outline with the filled square and "error"; a warning has the ring and "warn"; a
 * circular pair gets two error arcs and a "circular" chip; a dangling alias points at a dashed
 * "missing" row; a file finding sits on its layer's header (a button: `onFinding`). Selection is
 * blueprint: the selected row and every row on its chain on `action-subtle` with a 2px `action-bg`
 * outline, the chain's arrows in `action-bg` and thicker. A selected error keeps its marker and
 * word (TICKET-121). Never `signal`: nothing here is a change.
 *
 * Keyboard: one row is in the tab order (roving tabindex); ↑/↓ move within a column, ← follows
 * the alias to the token it uses, → goes back to a token that uses it, Home/End to the column's
 * ends, Enter or Space selects (`onSelect`). A row's accessible name is its full token name and
 * what it shows (`Colors.Brand.Accent` and its value), then what it uses and why it does not resolve.
 *
 * Motion (design-system/motion): rows and arrows change their tint over `motion.duration.fast`
 * when the selection moves; `reveal` scrolls the selected row into view (smoothly unless reduced
 * motion). Under reduced motion the highlight is there at once.
 *
 * A Preact component (the playground renders it from a lazily loaded chunk); stories render it to
 * static HTML. The canvas has a fixed drawing width; a narrower view scrolls it in its own box.
 */
import { useEffect, useMemo, useState } from 'preact/hooks'
import {
  chainOf,
  edgeKey,
  GUTTER,
  layoutGraph,
  moveFocus,
  NODE_WIDTH,
  ROW_HEIGHT,
  type GraphData,
  type GraphKey,
  type GraphNodeData,
  type GraphSeverity,
} from './graph-layout'
import './GraphCanvas.css'

export interface GraphCanvasProps {
  idPrefix?: string
  /** Accessible name of the drawing, e.g. `Dependency graph, BrandA · Desktop`. */
  label: string
  data: GraphData
  /** The selected row's id; its chain is highlighted. */
  selected?: string
  onSelect?: (id: string, element: HTMLElement) => void
  /** A layer's file finding was chosen (its `id`). */
  onFinding?: (id: string) => void
  /** Changes when the selected row should be scrolled into view (a selection from elsewhere). */
  reveal?: number
  /** Leaves out the legend (stories that show it once). */
  hideLegend?: boolean
}

const KEYS = new Set<string>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'])
const WORD: Record<GraphSeverity, string> = { error: 'error', warning: 'warn' }

/**
 * A row's accessible name: the full token name and what the row shows after it (so the visible
 * text, the leaf and the value, is part of it), then what it uses and why it does not resolve.
 */
export function nodeName(node: GraphNodeData): string {
  const shown = node.missing
    ? 'missing'
    : node.severity
      ? WORD[node.severity]
      : `${node.value ?? '–'}${node.unused ? ' · unused' : ''}`
  const parts: string[] = []
  if (node.via?.length) parts.push(`uses ${node.via[0]}`)
  if (node.problem && !node.missing) parts.push(node.problem)
  return `${node.name} ${shown}${parts.length ? `, ${parts.join(', ')}` : ''}`
}

export default function GraphCanvas({
  idPrefix = 'dta-graph',
  label,
  data,
  selected,
  onSelect,
  onFinding,
  reveal,
  hideLegend = false,
}: GraphCanvasProps) {
  const layout = useMemo(() => layoutGraph(data), [data])
  const chain = useMemo(() => chainOf(data.edges, selected), [data, selected])
  const indexOf = useMemo(
    () => new Map(layout.nodes.map((placed, index) => [placed.node.id, index])),
    [layout],
  )
  const first = layout.nodes.find((placed) => !placed.node.missing)?.node.id
  const [focus, setFocus] = useState<string | undefined>(selected)
  const nodeId = (id: string) => `${idPrefix}-node-${indexOf.get(id) ?? 0}`
  // The row in the tab order: the one last focused if it is still drawn, else the selection.
  const current = focus !== undefined && indexOf.has(focus) ? focus : (selected ?? first)

  useEffect(() => {
    if (selected !== undefined) setFocus(selected)
  }, [selected])

  // A selection made elsewhere ("Show in graph", a brand switch): bring the row into view.
  useEffect(() => {
    if (reveal === undefined || !selected) return
    const element = document.getElementById(nodeId(selected))
    if (!element) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() =>
      element.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: reduce ? 'auto' : 'smooth',
      }),
    )
  }, [reveal])

  const onKeyDown = (event: KeyboardEvent) => {
    if (!KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return
    const from = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-node]')?.dataset
      .node
    if (!from) return
    const next = moveFocus(layout, data.edges, from, event.key as GraphKey)
    event.preventDefault()
    if (!next) return
    setFocus(next)
    document.getElementById(nodeId(next))?.focus()
  }

  const layers = data.layers
  const headStyle = {
    gridTemplateColumns: `repeat(${layers.length}, ${NODE_WIDTH}px)`,
    columnGap: `${GUTTER}px`,
  }
  const edges = [...layout.edges].sort(
    (a, b) => Number(chain.edges.has(edgeKey(a))) - Number(chain.edges.has(edgeKey(b))),
  )

  return (
    <figure class="dta-graph">
      <div class="dta-graph__scroll">
        <div class="dta-graph__sheet" style={{ width: `${layout.width}px` }}>
          <div class="dta-graph__heads" style={headStyle}>
            {layers.map((layer) => (
              <div class="dta-graph__head" key={layer.collection}>
                <p class="dta-graph__kicker">{layer.collection}</p>
                <p class="dta-graph__layer">
                  <span class="dta-graph__mode">{layer.mode}</span>{' '}
                  <span class="dta-graph__count">{layer.count}</span>
                </p>
                {layer.findings?.map((finding) => {
                  const content = (
                    <>
                      <span class="dta-graph__marker" aria-hidden="true" />
                      <span>
                        {WORD[finding.severity]} · {finding.text}
                      </span>
                    </>
                  )
                  return onFinding ? (
                    <button
                      type="button"
                      key={finding.id}
                      class="dta-graph__finding"
                      data-severity={finding.severity}
                      aria-label={`${WORD[finding.severity]}: ${finding.text} in ${layer.collection}.${layer.mode}. Show in lint`}
                      onClick={() => onFinding(finding.id)}
                    >
                      {content}
                    </button>
                  ) : (
                    <span
                      key={finding.id}
                      class="dta-graph__finding"
                      data-severity={finding.severity}
                    >
                      {content}
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
          <div
            class="dta-graph__drawing"
            role="group"
            aria-label={label}
            style={{ height: `${layout.height}px` }}
            onKeyDown={onKeyDown}
          >
            <svg
              class="dta-graph__edges"
              aria-hidden="true"
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
            >
              {edges.map((edge) => {
                const on = chain.edges.has(edgeKey(edge)) ? '' : undefined
                return (
                  <g
                    key={edgeKey(edge)}
                    class="dta-graph__edge"
                    data-kind={edge.kind}
                    data-chain={on}
                  >
                    <path d={edge.d} />
                    <polygon points={edge.arrow} />
                  </g>
                )
              })}
            </svg>
            {layout.labels.map((placed) => (
              <p
                key={`${placed.layer}-${placed.text}`}
                class="dta-graph__group"
                style={{ left: `${placed.x}px`, top: `${placed.y}px` }}
              >
                {placed.text}
              </p>
            ))}
            {layout.edges
              .filter((edge) => edge.chip)
              .map((edge) => (
                <span
                  key={`chip-${edgeKey(edge)}`}
                  class="dta-graph__chip"
                  style={{ left: `${edge.chip?.x}px`, top: `${(edge.chip?.y ?? 0) - 11}px` }}
                >
                  <span class="dta-graph__marker" aria-hidden="true" />
                  circular
                </span>
              ))}
            {layout.nodes.map((placed) => {
              const { node } = placed
              const style = {
                left: `${placed.x}px`,
                top: `${placed.y}px`,
                width: `${NODE_WIDTH}px`,
                height: `${ROW_HEIGHT}px`,
              }
              const end = node.missing ? (
                <span class="dta-graph__status">
                  <span class="dta-graph__marker" aria-hidden="true" />
                  missing
                </span>
              ) : node.severity ? (
                <span class="dta-graph__status">
                  <span class="dta-graph__marker" aria-hidden="true" />
                  {WORD[node.severity]}
                </span>
              ) : (
                <span class="dta-graph__value">
                  {node.swatch && (
                    <span
                      class="dta-graph__swatch"
                      aria-hidden="true"
                      style={{ background: node.swatch }}
                    />
                  )}
                  {node.value ?? '–'}
                  {node.unused && <span class="dta-graph__unused">{'\u00a0· unused'}</span>}
                </span>
              )
              if (node.missing) {
                return (
                  <div
                    key={node.id}
                    class="dta-graph__node"
                    role="img"
                    aria-label={nodeName(node)}
                    data-missing=""
                    data-severity="error"
                    data-chain={chain.nodes.has(node.id) ? '' : undefined}
                    style={style}
                  >
                    <span class="dta-graph__name">{node.leaf}</span>
                    {end}
                  </div>
                )
              }
              const isSelected = node.id === selected
              return (
                <button
                  type="button"
                  key={node.id}
                  id={nodeId(node.id)}
                  class="dta-graph__node"
                  data-node={node.id}
                  data-severity={node.severity}
                  data-chain={chain.nodes.has(node.id) && !isSelected ? '' : undefined}
                  data-unused={node.unused ? '' : undefined}
                  aria-current={isSelected ? 'true' : undefined}
                  aria-label={nodeName(node)}
                  tabIndex={node.id === current ? 0 : -1}
                  style={style}
                  onClick={(event) => {
                    setFocus(node.id)
                    onSelect?.(node.id, event.currentTarget)
                  }}
                >
                  <span class="dta-graph__name">{node.leaf}</span>
                  {end}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {!hideLegend && (
        <figcaption class="dta-graph__legend">
          <span class="dta-graph__key">
            <svg
              class="dta-graph__glyph"
              aria-hidden="true"
              width="32"
              height="10"
              viewBox="0 0 32 10"
            >
              <g class="dta-graph__edge" data-kind="alias">
                <path d="M 32 5 L 7 5" />
                <polygon points="0,5 7,1 7,9" />
              </g>
            </svg>
            alias → the token it uses
          </span>
          <span class="dta-graph__key">
            <svg
              class="dta-graph__glyph"
              aria-hidden="true"
              width="32"
              height="10"
              viewBox="0 0 32 10"
            >
              <g class="dta-graph__edge" data-kind="alias" data-chain="">
                <path d="M 32 5 L 7 5" />
                <polygon points="0,5 7,1 7,9" />
              </g>
            </svg>
            selected chain
          </span>
          <span class="dta-graph__key" data-severity="error">
            <span class="dta-graph__marker" aria-hidden="true" />
            <span class="dta-graph__word">error</span> dangling or circular alias
          </span>
          <span class="dta-graph__key" data-severity="warning">
            <span class="dta-graph__marker" aria-hidden="true" />
            <span class="dta-graph__word">warning</span> (a config's rules)
          </span>
          <span class="dta-graph__key">
            <span class="dta-graph__unused">· unused</span> raw value no alias uses
          </span>
        </figcaption>
      )}
    </figure>
  )
}
