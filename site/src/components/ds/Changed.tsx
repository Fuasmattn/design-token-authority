/**
 * A value that briefly lights up when it changes (design-system/motion: a changed value is
 * highlighted, so nobody misses it). Wraps a short inline text, a count or a summary part: on
 * the first render it is plain; each time `value` changes afterwards it gets an `action-subtle`
 * ground and `action-text` ink that fade back over `motion.duration.highlight`.
 *
 * The highlight is colour, not movement, so it stays under `prefers-reduced-motion`. It adds no
 * width: the padding that gives the tint room is taken back by a negative margin.
 *
 * A Preact component (the playground's SummaryLine and Tabs use it); stories render the
 * highlighted look with `highlighted`.
 */
import type { ComponentChildren } from 'preact'
import { useChanged } from './motion'
import './Changed.css'

export interface ChangedProps {
  /** What is watched: a change of it starts the highlight (defaults to the text itself). */
  value?: string | number
  children?: ComponentChildren
  /** Shows the highlight without a change (stories, docs). */
  highlighted?: boolean
}

export default function Changed({ value, children, highlighted = false }: ChangedProps) {
  const changes = useChanged(value ?? (typeof children === 'string' ? children : undefined))
  return (
    <span
      key={changes}
      class="dta-changed"
      data-changed={changes > 0 ? '' : undefined}
      data-highlighted={highlighted ? '' : undefined}
    >
      {children}
    </span>
  )
}
