/**
 * What is loaded, in one line, once something is (playground spec decision 15): the input shrinks
 * to this bar and the views take the page. "Loaded", what it is (`brand-ab example`,
 * `tokenhaus export`), a mono detail (`6 files`), then "Replace files" (opens the file picker,
 * several files) and "Paste JSON instead" (the page opens the paste field under the bar).
 *
 * The bar is a status region, so a screen reader hears what was read; `focusKey` moves focus to
 * it after a new read (the button that loaded it is gone by then).
 *
 * Motion: the bar is the view-transition part `dta-source`, shared with TokenInput's drop area,
 * so the input collapses into it when the page loads something inside `transition()`.
 *
 * A Preact component (the playground island renders it); stories render it to static HTML.
 * Buttons use the shared Button.css, so they look like Button.
 */
import { useEffect, useRef } from 'preact/hooks'
import { readFiles, type TokenInputFile } from './TokenInput'
import './Button.css'
import './SourceBar.css'

export interface SourceBarProps {
  /** What is loaded, a few words. */
  label: string
  /** Mono detail after it, e.g. `6 files` or `converted into 1 token file`. */
  detail?: string
  /** The file names, read out with the label (visually the detail stands for them). */
  files?: readonly string[]
  /** Whether the paste field is open under the bar (the button says so). */
  pasting?: boolean
  /** Changes on every new read; focus moves to the bar when it does (not on the first render). */
  focusKey?: number
  onFiles?: (files: TokenInputFile[]) => void
  onPaste?: () => void
}

export default function SourceBar({
  label,
  detail,
  files,
  pasting = false,
  focusKey,
  onFiles,
  onPaste,
}: SourceBarProps) {
  const picker = useRef<HTMLInputElement>(null)
  const status = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (focusKey) status.current?.focus()
  }, [focusKey])

  return (
    <section class="dta-source" aria-label="Loaded files">
      <p class="dta-source__status" role="status" tabIndex={-1} ref={status}>
        <span class="dta-source__kicker">Loaded</span>{' '}
        <span class="dta-source__label">{label}</span>{' '}
        {detail && <span class="dta-source__detail">{detail}</span>}
        {files && files.length > 0 && <span class="dta-source__files">: {files.join(', ')}</span>}
      </p>
      <div class="dta-source__actions">
        <button type="button" class="dta-button outline" onClick={() => picker.current?.click()}>
          Replace files
        </button>
        <button
          type="button"
          class="dta-button link"
          aria-expanded={pasting}
          onClick={() => onPaste?.()}
        >
          Paste JSON instead
        </button>
      </div>
      <input
        ref={picker}
        class="dta-source__picker"
        type="file"
        accept=".json,application/json"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const input = event.currentTarget
          void readFiles(input.files).then((read) => {
            input.value = ''
            if (read.length > 0) onFiles?.(read)
          })
        }}
      />
    </section>
  )
}
