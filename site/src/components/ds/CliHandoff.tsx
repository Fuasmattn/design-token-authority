/**
 * "Take it to the CLI" (playground spec decision 3, TICKET-079): how to get the same result on
 * your own machine. A title, the generated config as a file row (its name opens a preview, with
 * its size, Copy and Download, like an output file), the steps in order, each command as the
 * site's command chip (CommandButton.css: `$`, the command, a copy icon that turns into a tick),
 * and an optional note (what the steps assume).
 *
 * Commands are shown as `npx design-token-authority …`, never `npx dta` (that npm name belongs
 * to another package). The component reports; saving the config is the page's (`onDownload`).
 * It is a view-transition part named after its heading id, so it moves to its new place when the
 * output files above it change inside `transition()`.
 *
 * A Preact component (the playground island renders it); stories render it to static HTML.
 */
import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import CopyButton from './CopyButton'
import { breakPaths } from './TokenPath'
import './Button.css'
import './CommandButton.css'
import './CliHandoff.css'

export interface CliHandoffStep {
  text: string
  command?: string
}

export interface CliHandoffProps {
  idPrefix?: string
  title?: string
  /** One sentence above the config. */
  intro?: ComponentChildren
  config: { name: string; size: string; content: string }
  /** Whether the config's preview is open (its row is marked). */
  configOpen?: boolean
  steps: readonly CliHandoffStep[]
  /** A line under the steps, e.g. what they assume (the package installed). */
  note?: ComponentChildren
  onOpenConfig?: (button: HTMLButtonElement) => void
  onDownload?: () => void
}

/** A command chip that copies its command (the CommandButton's look and behaviour, in Preact). */
function Command({ command }: { command: string }) {
  const [copied, setCopied] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = async () => {
    let text = 'copied'
    try {
      await navigator.clipboard.writeText(command)
    } catch {
      text = 'select to copy'
    }
    setCopied(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(''), 1600)
  }
  return (
    <button
      type="button"
      class="dta-command dta-cli__command"
      aria-label={`Copy: ${command}`}
      title="Copy command"
      data-copied={copied ? '' : undefined}
      onClick={() => void copy()}
    >
      <span class="dta-command__prompt" aria-hidden="true">
        $
      </span>
      <span class="dta-command__text">{breakPaths(command)}</span>
      <svg class="dta-command__icon dta-command__copy" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="9" y="9" width="12" height="12" rx="2"></rect>
        <path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"></path>
      </svg>
      <svg class="dta-command__icon dta-command__tick" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12.5l5 5L20 6.5"></path>
      </svg>
      <span class="dta-command__status" aria-live="polite">
        {copied}
      </span>
    </button>
  )
}

export default function CliHandoff({
  idPrefix = 'dta-cli',
  title = 'Take it to the CLI',
  intro,
  config,
  configOpen = false,
  steps,
  note,
  onOpenConfig,
  onDownload,
}: CliHandoffProps) {
  const headingId = `${idPrefix}-title`
  return (
    <section class="dta-cli" aria-labelledby={headingId} style={{ viewTransitionName: headingId }}>
      <h3 class="dta-cli__title" id={headingId}>
        {title}
      </h3>
      {intro && <p class="dta-cli__intro">{intro}</p>}
      <div class="dta-cli__config" aria-current={configOpen ? 'true' : undefined}>
        <button
          type="button"
          class="dta-cli__name"
          onClick={(event) => onOpenConfig?.(event.currentTarget)}
        >
          {breakPaths(config.name)}
        </button>
        <span class="dta-cli__size">{config.size}</span>
        <span class="dta-cli__actions">
          <CopyButton text={config.content} accessibleLabel={`Copy ${config.name}`} />
          <button
            type="button"
            class="dta-button quiet"
            aria-label={`Download ${config.name}`}
            onClick={() => onDownload?.()}
          >
            Download
          </button>
        </span>
      </div>
      <ol class="dta-cli__steps">
        {steps.map((step, index) => (
          <li class="dta-cli__step" key={index}>
            <span class="dta-cli__text">{breakPaths(step.text)}</span>
            {step.command && <Command command={step.command} />}
          </li>
        ))}
      </ol>
      {note && <p class="dta-cli__note">{note}</p>}
    </section>
  )
}
