/**
 * The facts of what is loaded in one mono line that stays visible above the views (playground
 * spec decision 15): `3 collections  2 brands  3 breakpoints  42 tokens  0 lint findings`. Each
 * part with a target is a button that opens its view; parts without one are plain text.
 * It wraps on narrow screens; it never scrolls sideways. A part whose text changes (a new read,
 * other output formats) is highlighted briefly (Changed), so the new numbers are noticed.
 *
 * A Preact component (the playground island renders it); stories render it to static HTML.
 */
import Changed from './Changed'
import './SummaryLine.css'

export interface SummaryPart {
  text: string
  /** The view this part opens (a tab id); plain text without one. */
  target?: string
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
        <li key={index} class="dta-summary__part">
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
