/**
 * Details of what was selected in a view (playground spec decision 15), so the view behind stays
 * in place: a side panel next to the view from 1024px of viewport width, a bottom sheet below.
 * One native `<dialog>`: shown non-modal beside the view, modal as the sheet (focus stays in it,
 * the page behind is inert, Escape and the backdrop close it). Opening moves focus to the
 * panel's title; closing returns it to the element that opened the panel (`opener`).
 *
 * Motion (design-system/motion): the side panel fades in from the right, the sheet slides up from
 * the bottom and its backdrop fades; both leave the way they came (CSS only: `@starting-style`
 * and discrete `display`/`overlay` transitions). The page keeps the last content while it leaves.
 *
 * Content: a kicker (for a finding with its severity: the marker shape and the word in the
 * status colours, TICKET-120) and a title, a meta line, optional actions (Copy and Download of a file), an
 * optional mode switch, an optional message (the full finding, mono), a list of lines (a token
 * name, then its alias chain and value, with a swatch for colours) or a file's text (`code`, an
 * output file's preview). The list and the code scroll inside the panel. With `next`, a step row at
 * the end ("Next finding", "2 of 3") moves through a list without closing the panel (TICKET-113):
 * focus stays on the button, the new content fades in, the position lights up (Changed) and a
 * polite status says what is shown now.
 *
 * A Preact component (the playground island renders it); stories render it to static HTML with
 * `presentation` and `staticOpen`.
 */
import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import Changed from './Changed'
import './Button.css'
import './DetailPanel.css'

export interface DetailLine {
  /** First line, mono: a token name. */
  name: string
  /** Second line, mono and muted: the alias chain and value. */
  detail?: string
  /** A CSS colour for a small swatch (decoration; the value is in `detail`). */
  swatch?: string
}

export type DetailPresentation = 'side' | 'sheet'

export interface DetailPanelProps {
  idPrefix?: string
  open: boolean
  /** Mono line above the title, e.g. `Collection · brand · 0.94`. */
  kicker?: string
  /** A finding's severity: the kicker gets its marker and status text colour. */
  kickerSeverity?: 'error' | 'warning'
  title: string
  meta?: ComponentChildren
  /** A mode switch above the lines (a collection's modes). */
  modes?: { label: string; options: readonly string[]; selected: string }
  onMode?: (mode: string) => void
  /** A message shown in full, mono (a finding as the CLI prints it). */
  message?: string
  lines?: readonly DetailLine[]
  /** Accessible name of the scrolling list. */
  linesLabel?: string
  /** Buttons under the meta line (a file's Copy and Download). */
  actions?: ComponentChildren
  /** A file's text, shown as it is (mono, lines kept whole, scrolls inside its own box). */
  code?: string
  /** Accessible name of the code region. */
  codeLabel?: string
  /** What is shown (a finding's id); a new key is new content. Defaults to the title. */
  contentKey?: string
  /** A step to the next item of a list: the button's label, where we are (`2 of 3`). */
  next?: { label: string; position: string; onNext: () => void }
  onClose?: () => void
  /** The element that opened the panel; focus returns to it on close. */
  opener?: HTMLElement | null
  /** Forces a presentation (stories); otherwise side from 1024px, sheet below. */
  presentation?: DetailPresentation
  /** Renders the panel open without script (stories). */
  staticOpen?: boolean
}

/** A path with a line-break opportunity after each `/`, so it wraps between folders. */
export function breakable(text: string): ComponentChildren {
  const parts = text.split('/')
  return parts.map((part, index) => (index < parts.length - 1 ? [part, '/', <wbr />] : part))
}

/** The width from which the panel sits beside the view. */
export const SIDE_PANEL_QUERY = '(min-width: 1024px)'

export default function DetailPanel({
  idPrefix = 'dta-detail',
  open,
  kicker,
  kickerSeverity,
  title,
  meta,
  modes,
  onMode,
  message,
  lines,
  linesLabel = 'Lines',
  actions,
  code,
  codeLabel = 'Preview',
  contentKey,
  next,
  onClose,
  opener,
  presentation,
  staticOpen = false,
}: DetailPanelProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [wide, setWide] = useState(true)
  const shown = useRef(false)
  // A step with "Next": focus stays on the button; the status says what is shown now.
  const nextButton = useRef<HTMLButtonElement>(null)
  const [stepped, setStepped] = useState(0)
  const key = contentKey ?? title
  const mode: DetailPresentation = presentation ?? (wide ? 'side' : 'sheet')

  useEffect(() => {
    if (presentation) return
    const query = window.matchMedia(SIDE_PANEL_QUERY)
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [presentation])

  // Show and hide imperatively: show() beside the view, showModal() as the sheet.
  useEffect(() => {
    const element = dialog.current
    if (!element || staticOpen) return
    if (!open) {
      if (element.open) element.close()
      if (shown.current) {
        shown.current = false
        if (opener?.isConnected) opener.focus()
      }
      return
    }
    const modal = mode === 'sheet'
    if (element.open && element.matches(':modal') !== modal) element.close()
    if (!element.open) {
      if (modal) element.showModal()
      else element.show()
    }
    shown.current = true
    // New content moves focus to its title, unless the visitor is stepping with "Next".
    if (!nextButton.current || document.activeElement !== nextButton.current) {
      heading.current?.focus()
    }
  }, [open, mode, key, staticOpen])

  // A new opening starts without a step (no fade, nothing to announce).
  useEffect(() => {
    if (!open) setStepped(0)
  }, [open])

  // Closing from inside (×, Escape, the backdrop): hide and return focus at once, then tell the
  // owner, so focus never falls back to the page in between.
  const dismiss = () => {
    const element = dialog.current
    if (element?.open) element.close()
    if (shown.current) {
      shown.current = false
      if (opener?.isConnected) opener.focus()
    }
    onClose?.()
  }

  // Escape also closes the side panel (a modal sheet gets it from the dialog's cancel event).
  useEffect(() => {
    if (!open || mode !== 'side' || staticOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select')) return
      event.preventDefault()
      dismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const titleId = `${idPrefix}-title`
  return (
    <dialog
      ref={dialog}
      class="dta-detail"
      data-presentation={mode}
      data-static={staticOpen ? '' : undefined}
      aria-labelledby={titleId}
      open={staticOpen || undefined}
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
      onClick={(event) => {
        // A click on the dialog itself is a click on the sheet's backdrop.
        if (event.target === event.currentTarget && mode === 'sheet') dismiss()
      }}
    >
      <span class="dta-detail__handle" aria-hidden="true" />
      <div class="dta-detail__head">
        <div class="dta-detail__titles">
          {kicker && (
            <p class="dta-detail__kicker" data-severity={kickerSeverity}>
              {kickerSeverity && <span class="dta-detail__marker" aria-hidden="true" />}
              {kicker}
            </p>
          )}
          <h2 class="dta-detail__title" id={titleId} ref={heading} tabIndex={-1}>
            {breakable(title)}
          </h2>
        </div>
        <button
          type="button"
          class="dta-detail__close"
          aria-label="Close details"
          onClick={dismiss}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div class="dta-detail__body">
        <div class="dta-detail__content" key={key} data-stepped={stepped > 0 ? '' : undefined}>
          {meta && <p class="dta-detail__meta">{meta}</p>}
          {actions && <div class="dta-detail__actions">{actions}</div>}
          {modes && modes.options.length > 1 && (
            <div class="dta-detail__modes" role="group" aria-label={modes.label}>
              {modes.options.map((option) => (
                <button
                  type="button"
                  key={option}
                  class="dta-detail__mode"
                  aria-pressed={option === modes.selected}
                  onClick={() => onMode?.(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          {message && <p class="dta-detail__message">{message}</p>}
          {lines && lines.length > 0 && (
            <ul class="dta-detail__lines" tabIndex={0} aria-label={linesLabel}>
              {lines.map((line, index) => (
                <li class="dta-detail__line" key={`${line.name}-${index}`}>
                  <span class="dta-detail__name">{line.name}</span>
                  {line.detail && (
                    <span class="dta-detail__value">
                      {line.swatch && (
                        <span
                          class="dta-detail__swatch"
                          aria-hidden="true"
                          style={{ background: line.swatch }}
                        />
                      )}
                      {line.detail}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {code !== undefined && (
            <pre class="dta-detail__code" tabIndex={0} role="region" aria-label={codeLabel}>
              <code>{code}</code>
            </pre>
          )}
        </div>
        {next && (
          <div class="dta-detail__step">
            <button
              ref={nextButton}
              type="button"
              class="dta-button outline"
              onClick={() => {
                setStepped((count) => count + 1)
                next.onNext()
              }}
            >
              {next.label}
            </button>
            <span class="dta-detail__position">
              <Changed value={next.position}>{next.position}</Changed>
            </span>
          </div>
        )}
        <p class="dta-detail__status" role="status">
          {stepped > 0 && next ? `${next.position}: ${title}` : ''}
        </p>
      </div>
    </dialog>
  )
}
