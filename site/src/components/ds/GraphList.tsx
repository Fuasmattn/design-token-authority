/**
 * The dependency graph as a list, for phones (TICKET-078; board Graph.dc.html, "Phone 390"): the
 * same data as GraphCanvas, no pinch-zoom needed. Each layer is a native disclosure (summaries
 * first: the collection, its mode and count, and its worst finding as marker + word); open, it
 * lists every token with its alias chain on a second line (`→ Colors.Foundation.Navy.500` and the
 * value with a swatch), or why it does not resolve (`does not exist`, in the status text). A row
 * with a finding ends in its marker and word; a file finding sits under the layer's summary.
 *
 * Each token row is a button (`onSelect`, the playground opens the bottom sheet); the selected
 * row is tinted `action-subtle` (`aria-current`) and keeps its marker and word (TICKET-121).
 * When the selection moves into a closed layer, that layer opens (it never closes one). Paths
 * break between their segments (TokenPath).
 *
 * Motion: a layer opens by growing (`::details-content`, `motion.duration.base`), its chevron
 * turns; a selected row tints over `fast`. Under reduced motion both happen at once.
 *
 * A Preact component; stories render it to static HTML.
 */
import { useEffect, useRef } from 'preact/hooks'
import type { GraphData, GraphNodeData, GraphSeverity } from './graph-layout'
import { breakPaths } from './TokenPath'
import './GraphList.css'

export interface GraphListProps {
  idPrefix?: string
  /** Accessible name of the list, e.g. `Dependency graph, BrandB · Desktop`. */
  label: string
  data: GraphData
  selected?: string
  onSelect?: (id: string, element: HTMLElement) => void
  onFinding?: (id: string) => void
  /** Layers (collection names) open at first; the selected row's layer always opens. */
  open?: readonly string[]
}

const WORD: Record<GraphSeverity, string> = { error: 'error', warning: 'warn' }

/** The second line: the chain after the token, then its value, or why it does not resolve. */
function ChainLine({ node }: { node: GraphNodeData }) {
  const via = node.via?.length ? `→ ${node.via.join(' → ')}` : ''
  return (
    <span class="dta-graph-list__chain">
      {via && <span>{breakPaths(via)} </span>}
      {node.problem ? (
        <span class="dta-graph-list__problem">{node.problem}</span>
      ) : (
        <span class="dta-graph-list__value">
          {node.swatch && (
            <span
              class="dta-graph-list__swatch"
              aria-hidden="true"
              style={{ background: node.swatch }}
            />
          )}
          {node.value ?? '–'}
          {node.unused && ' · unused'}
        </span>
      )}
    </span>
  )
}

export default function GraphList({
  idPrefix = 'dta-graph-list',
  label,
  data,
  selected,
  onSelect,
  onFinding,
  open = [],
}: GraphListProps) {
  const root = useRef<HTMLDivElement>(null)

  // The selected row is never hidden in a closed layer: its layer opens.
  useEffect(() => {
    if (!selected) return
    const row = root.current?.querySelector(`[aria-current="true"]`)
    const layer = row?.closest('details')
    if (layer instanceof HTMLDetailsElement && !layer.open) layer.open = true
  }, [selected, data])

  return (
    <div class="dta-graph-list" ref={root} role="group" aria-label={label}>
      {data.layers.map((layer, l) => {
        const nodes = layer.groups.flatMap((group) => group.nodes).filter((node) => !node.missing)
        return (
          <details
            class="dta-graph-list__layer"
            key={layer.collection}
            open={open.includes(layer.collection)}
          >
            <summary class="dta-graph-list__summary">
              <span class="dta-graph-list__titles">
                <span class="dta-graph-list__kicker">{layer.collection}</span>
                <span class="dta-graph-list__title">
                  {layer.mode} <span class="dta-graph-list__count">{layer.count}</span>
                </span>
              </span>
              {layer.status && (
                <span class="dta-graph-list__status" data-severity={layer.status.severity}>
                  <span class="dta-graph-list__marker" aria-hidden="true" />
                  {layer.status.text}
                </span>
              )}
            </summary>
            {layer.findings?.map((finding) => (
              <p class="dta-graph-list__file" key={finding.id} data-severity={finding.severity}>
                {onFinding ? (
                  <button
                    type="button"
                    class="dta-graph-list__finding"
                    onClick={() => onFinding(finding.id)}
                  >
                    <span class="dta-graph-list__marker" aria-hidden="true" />
                    {WORD[finding.severity]} · {finding.text}
                    <span class="dta-graph-list__hidden">. Show in lint</span>
                  </button>
                ) : (
                  <>
                    <span class="dta-graph-list__marker" aria-hidden="true" />
                    {WORD[finding.severity]} · {finding.text}
                  </>
                )}
              </p>
            ))}
            <ul class="dta-graph-list__tokens">
              {nodes.map((node, n) => {
                const current = node.id === selected
                return (
                  <li
                    class="dta-graph-list__row"
                    key={node.id}
                    data-severity={node.severity}
                    aria-current={current ? 'true' : undefined}
                  >
                    <button
                      type="button"
                      id={`${idPrefix}-${l}-${n}`}
                      class="dta-graph-list__token"
                      data-node={node.id}
                      onClick={(event) => onSelect?.(node.id, event.currentTarget)}
                    >
                      <span class="dta-graph-list__text">
                        <span class="dta-graph-list__name">{breakPaths(node.name)}</span>
                        <ChainLine node={node} />
                      </span>
                      {node.severity && (
                        <span class="dta-graph-list__word">
                          <span class="dta-graph-list__marker" aria-hidden="true" />
                          {WORD[node.severity]}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </details>
        )
      })}
    </div>
  )
}
