/**
 * A token's detail panel (TICKET-078; board Graph.dc.html): its readings in every mode as
 * `dta token get` gives them (the one the graph shows tagged `in view`), its CSS and Tailwind
 * names, its findings, and the ways on: "Show in lint" (its first finding, one in view first)
 * and "Show <mode>" for findings in a mode the graph does not show. The playground and the
 * detail panel's story both render it from `tokenDetail` (graph.ts).
 */
import type { DetailPanelProps } from '../components/ds/DetailPanel'
import type { FindingRef, TokenDetail } from './graph'

export interface TokenPanelActions {
  onLint?: (ref: FindingRef) => void
  onMode?: (collection: string, mode: string) => void
}

export function tokenPanelContent(
  detail: TokenDetail,
  { onLint, onMode }: TokenPanelActions = {},
): Omit<DetailPanelProps, 'open'> {
  const lint = detail.lint
  return {
    kicker: detail.kicker,
    title: detail.title,
    meta: (
      <>
        {detail.scope ? `${detail.scope}, as ` : 'As '}
        <code>dta token get</code> reads it
        {detail.shows ? `; the graph shows ${detail.shows}.` : '.'}
      </>
    ),
    lines: detail.lines,
    linesLabel: `Readings of ${detail.title}`,
    facts: detail.facts,
    notes: detail.notes,
    links:
      lint || detail.elsewhere.length > 0 ? (
        <>
          {lint && (
            <button type="button" class="dta-button outline" onClick={() => onLint?.(lint)}>
              Show in lint
            </button>
          )}
          {detail.elsewhere.map((other) => (
            <button
              type="button"
              key={`${other.collection}.${other.mode}`}
              class="dta-button outline"
              onClick={() => onMode?.(other.collection, other.mode)}
            >
              Show {other.mode}
            </button>
          ))}
        </>
      ) : undefined,
  }
}
