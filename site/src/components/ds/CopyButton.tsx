/**
 * Copies a text to the clipboard and says so: the label turns into "Copied" with the pass dot
 * for a moment, or "Not copied" with the error square when the browser refuses (shape and word,
 * not colour alone), and a polite live region tells a screen reader. All three labels share one
 * grid cell, so the button is as wide as the widest from the start and nothing moves.
 *
 * It is the Button (Button.css), quiet by default: the small action repeated on every row of a
 * list (an output file, the generated config). `accessibleLabel` names what is copied
 * (`Copy output/css/base.css`); it starts with the visible label.
 *
 * A Preact component (the playground island renders it); stories render it to static HTML.
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import './Button.css'
import './CopyButton.css'

export interface CopyButtonProps {
  /** What is copied. */
  text: string
  /** Visible label (default `Copy`). */
  label?: string
  /** Accessible name when the label alone does not say what is copied. */
  accessibleLabel?: string
  variant?: 'quiet' | 'outline'
  /** Shows the copied or failed state without script (stories). */
  staticState?: 'copied' | 'failed'
}

const RESET_MS = 1600

export default function CopyButton({
  text,
  label = 'Copy',
  accessibleLabel,
  variant = 'quiet',
  staticState,
}: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>(staticState ?? 'idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const done = (next: 'copied' | 'failed') => {
    setState(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), RESET_MS)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      done('copied')
    } catch {
      done('failed')
    }
  }

  return (
    <button
      type="button"
      class={`dta-button ${variant} dta-copy`}
      aria-label={accessibleLabel}
      data-state={state}
      onClick={() => void copy()}
    >
      <span class="dta-copy__face">
        <span class="dta-copy__label">{label}</span>
        <span class="dta-copy__done" aria-hidden="true">
          Copied
        </span>
        <span class="dta-copy__failed" aria-hidden="true">
          Not copied
        </span>
      </span>
      <span class="dta-copy__status" aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Not copied: select the text' : ''}
      </span>
    </button>
  )
}
