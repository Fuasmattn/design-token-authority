/**
 * The choices that shape what is built, in one row above the result (playground spec decision 3,
 * TICKET-079): a mono label ("Outputs"), one checkbox per choice (CSS, Tailwind v4, Tailwind v3,
 * JS), and the row's actions at the end ("Download all"). A named group of native checkboxes,
 * each with a 44 px hit area; it wraps on narrow screens and the actions take the full width
 * there.
 *
 * A Preact component (the playground island renders it); stories render it to static HTML.
 */
import type { ComponentChildren } from 'preact'
import './OutputOptions.css'

export interface OutputOption {
  value: string
  label: string
}

export interface OutputOptionsProps {
  idPrefix?: string
  /** The group's name, shown as its label. */
  label?: string
  options: readonly OutputOption[]
  /** The values that are checked. */
  selected: readonly string[]
  /** The new selection, in the order of `options`. */
  onChange?: (selected: string[]) => void
  /** Actions at the end of the row (a primary download). */
  children?: ComponentChildren
}

export default function OutputOptions({
  idPrefix = 'dta-options',
  label = 'Outputs',
  options,
  selected,
  onChange,
  children,
}: OutputOptionsProps) {
  const labelId = `${idPrefix}-label`
  const toggle = (value: string, checked: boolean) =>
    onChange?.(
      options
        .map((option) => option.value)
        .filter((v) => (v === value ? checked : selected.includes(v))),
    )
  return (
    <div class="dta-options">
      <div class="dta-options__group" role="group" aria-labelledby={labelId}>
        <span class="dta-options__label" id={labelId}>
          {label}
        </span>
        {options.map((option) => (
          <label class="dta-options__choice" key={option.value}>
            <input
              type="checkbox"
              class="dta-options__box"
              value={option.value}
              checked={selected.includes(option.value)}
              onChange={(event) => toggle(option.value, event.currentTarget.checked)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {children && <div class="dta-options__actions">{children}</div>}
    </div>
  )
}
