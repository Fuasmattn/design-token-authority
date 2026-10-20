/**
 * Which modes the graph shows (TICKET-078, board decision 2): one control per multi-mode
 * collection, "Brand" and "Breakpoint" in the playground. On wide screens each is a segmented
 * well like the detail panel's mode switch (`aria-pressed` buttons in a labelled group); on phones
 * (up to 760 px, the site's break, where the playground's graph is a list) it is a native select
 * in a labelled box (no custom list to learn on a phone). An option may carry its findings, e.g. `BrandB ■ 1 error` (marker + word in the status
 * colours; in the select's text `BrandB · 1 error`). A note under the controls says what is in
 * view; a part of it may carry a status (`2 of 3 errors`), and `narrowNote` replaces it on
 * phones (where the graph is a list).
 *
 * A Preact component; stories render it to static HTML.
 */
import type { GraphSeverity } from './graph-layout'
import './GraphSwitcher.css'

export interface SwitcherOption {
  value: string
  /** Findings in this mode, e.g. `1 error`. */
  count?: string
  severity?: GraphSeverity
}

export interface SwitcherGroup {
  /** Passed back to `onChange` (a collection name). */
  id: string
  /** `Brand`, `Breakpoint`. */
  label: string
  options: readonly SwitcherOption[]
  selected: string
}

export type NotePart = string | { text: string; severity: GraphSeverity }

export interface GraphSwitcherProps {
  idPrefix?: string
  groups: readonly SwitcherGroup[]
  onChange?: (group: string, value: string) => void
  note?: readonly NotePart[]
  /** Said instead of `note` on phones. */
  narrowNote?: string
}

const optionText = (option: SwitcherOption) =>
  option.count ? `${option.value} · ${option.count}` : option.value

function Count({ option }: { option: SwitcherOption }) {
  if (!option.count) return null
  return (
    <span class="dta-switcher__count" data-severity={option.severity}>
      <span class="dta-switcher__marker" aria-hidden="true" />
      {option.count}
    </span>
  )
}

export default function GraphSwitcher({
  idPrefix = 'dta-switcher',
  groups,
  onChange,
  note,
  narrowNote,
}: GraphSwitcherProps) {
  return (
    <div class="dta-switcher">
      <div class="dta-switcher__controls">
        {groups.map((group, g) => {
          const labelId = `${idPrefix}-${g}-label`
          const shown = group.options.find((option) => option.value === group.selected)
          return (
            <div class="dta-switcher__group" key={group.id}>
              <div class="dta-switcher__wide">
                <span class="dta-switcher__label" id={labelId}>
                  {group.label}
                </span>
                <div class="dta-switcher__segments" role="group" aria-labelledby={labelId}>
                  {group.options.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      class="dta-switcher__option"
                      aria-pressed={option.value === group.selected}
                      onClick={() => onChange?.(group.id, option.value)}
                    >
                      {option.value}
                      <Count option={option} />
                    </button>
                  ))}
                </div>
              </div>
              <label class="dta-switcher__narrow">
                <span class="dta-switcher__label">{group.label}</span>
                <span class="dta-switcher__shown" aria-hidden="true">
                  <span class="dta-switcher__value">{group.selected}</span>
                  {shown && <Count option={shown} />}
                </span>
                <select
                  class="dta-switcher__select"
                  value={group.selected}
                  onChange={(event) => onChange?.(group.id, event.currentTarget.value)}
                >
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {optionText(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )
        })}
      </div>
      {note && note.length > 0 && (
        <p class="dta-switcher__note" data-narrow={narrowNote ? 'replaced' : undefined}>
          {note.map((part, index) =>
            typeof part === 'string' ? (
              part
            ) : (
              <span key={index} class="dta-switcher__status" data-severity={part.severity}>
                {part.text}
              </span>
            ),
          )}
        </p>
      )}
      {narrowNote && <p class="dta-switcher__note dta-switcher__note--narrow">{narrowNote}</p>}
    </div>
  )
}
