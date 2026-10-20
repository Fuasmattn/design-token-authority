/**
 * The facts of what is loaded in one mono line that stays visible above the views (playground
 * spec decision 15): `3 collections  2 brands  3 breakpoints  42 tokens  0 lint findings`. Each
 * part with a target is a button that opens its view; parts without one are plain text.
 * It wraps on narrow screens; it never scrolls sideways. A part whose text changes (a new read,
 * other output formats) is highlighted briefly (Changed), so the new numbers are noticed.
 *
 * A part with a `tone` is a status count (TICKET-120): its marker shape before the words (a
 * filled square for errors, an open ring for warnings, the pass dot for a clean result) and the
 * words in the status text colour; never colour alone, never signal.
 *
 * A Preact component (the playground island renders it); stories render it to static HTML.
 */
import Changed from './Changed'
import './SummaryLine.css'

export type SummaryTone = 'error' | 'warning' | 'success'

export interface SummaryPart {
  text: string
  /** The view this part opens (a tab id); plain text without one. */
  target?: string
  /** A status count: `1 error, 2 warnings` (error), `0 lint findings` (success), `build failed`. */
  tone?: SummaryTone
}

export interface SummaryLineProps {
  /** Accessible name of the line. */
  label?: string
  parts: readonly SummaryPart[]
  onSelect?: (target: string) => void
}

export default function SummaryLine({ label = 'Summary', parts, onSelect }: SummaryLineProps) {
  return (
    <ul class="dta-summary" aria-label={label}>
      {parts.map((part, index) => (
        <li key={index} class="dta-summary__part" data-tone={part.tone}>
          {part.tone && <span class="dta-summary__marker" aria-hidden="true" />}
          {part.target ? (
            <button
              type="button"
              class="dta-summary__button"
              onClick={() => part.target && onSelect?.(part.target)}
            >
              <Changed>{part.text}</Changed>
            </button>
          ) : (
            <Changed>{part.text}</Changed>
          )}
        </li>
      ))}
    </ul>
  )
}
