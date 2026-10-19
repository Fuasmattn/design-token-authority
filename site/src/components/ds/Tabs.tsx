/**
 * Views of one thing, one at a time (playground spec decision 15: Structure · Lint · Graph ·
 * Outputs). A WAI-ARIA tablist with automatic activation: arrow keys move between the tabs and
 * select them, Home and End go to the first and last; only the selected tab is in the tab order.
 * The panel of the selected tab follows the list (children); the other panels are not rendered.
 *
 * The list is a `bg-subtle` well; the selected tab sits on the surface with a 2px ink outline.
 * Below 560px of container width the tabs share the row equally, and with `sticky` the list stays
 * at the top of the screen while the panel scrolls.
 *
 * A Preact component (the playground island renders it); stories render it to static HTML.
 */
import type { ComponentChildren } from 'preact'
import { useRef } from 'preact/hooks'
import './Tabs.css'

export interface Tab {
  id: string
  label: string
  /** A short count after the label, e.g. `3` (`Lint · 3`). */
  count?: string
}

export interface TabsProps {
  idPrefix?: string
  /** Accessible name of the tablist. */
  label: string
  tabs: readonly Tab[]
  selected: string
  onSelect?: (id: string) => void
  /** Keep the list at the top of the screen on narrow containers. */
  sticky?: boolean
  children?: ComponentChildren
}

export const tabId = (idPrefix: string, id: string) => `${idPrefix}-tab-${id}`

export default function Tabs({
  idPrefix = 'dta-tabs',
  label,
  tabs,
  selected,
  onSelect,
  sticky = false,
  children,
}: TabsProps) {
  const list = useRef<HTMLDivElement>(null)

  const move = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length]
    onSelect?.(next.id)
    list.current
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(idPrefix, next.id))}`)
      ?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.id === selected)
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    }
    if (!(event.key in keys)) return
    event.preventDefault()
    move(keys[event.key])
  }

  return (
    <div class="dta-tabs" data-sticky={sticky ? '' : undefined}>
      <div class="dta-tabs__bar">
        <div
          ref={list}
          class="dta-tabs__list"
          role="tablist"
          aria-label={label}
          onKeyDown={onKeyDown}
        >
          {tabs.map((tab) => {
            const on = tab.id === selected
            return (
              <button
                type="button"
                role="tab"
                key={tab.id}
                id={tabId(idPrefix, tab.id)}
                class="dta-tabs__tab"
                aria-selected={on}
                aria-controls={on ? `${idPrefix}-panel` : undefined}
                tabIndex={on ? 0 : -1}
                onClick={() => onSelect?.(tab.id)}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span class="dta-tabs__count">{` · ${tab.count}`}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div
        class="dta-tabs__panel"
        role="tabpanel"
        id={`${idPrefix}-panel`}
        aria-labelledby={tabId(idPrefix, selected)}
      >
        {children}
      </div>
    </div>
  )
}
