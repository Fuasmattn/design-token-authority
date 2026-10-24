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
 * Motion (design-system/motion): once the script runs, the outline is one indicator that moves to
 * the selected tab (measured, `motion.duration.base`); a tab's own outline is the no-script look.
 * A tab change is a View Transition of type `dta-tabs` where the browser has one: only the panel
 * crossfades (and its height eases to the new content), the rest of the page stays live. A count
 * that changes is highlighted (Changed).
 *
 * A Preact component (the playground island renders it); stories render it to static HTML.
 */
import type { ComponentChildren } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'
import Changed from './Changed'
import { transition } from './motion'
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

  // The indicator follows the selected tab: its box is measured into custom properties, again
  // whenever a tab's size changes (fonts, counts, wrapping). Before that, the tab draws its own.
  useLayoutEffect(() => {
    const element = list.current
    if (!element) return
    const place = () => {
      const tab = element.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!tab) return
      element.style.setProperty('--dta-tab-x', `${tab.offsetLeft}px`)
      element.style.setProperty('--dta-tab-y', `${tab.offsetTop}px`)
      element.style.setProperty('--dta-tab-w', `${tab.offsetWidth}px`)
      element.style.setProperty('--dta-tab-h', `${tab.offsetHeight}px`)
      element.dataset.indicator = ''
    }
    place()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(place)
    observer.observe(element)
    for (const tab of element.querySelectorAll('[role="tab"]')) observer.observe(tab)
    return () => observer.disconnect()
  }, [selected, tabs])

  const choose = (id: string) => {
    if (id === selected) return
    transition(() => onSelect?.(id), 'dta-tabs')
  }

  const move = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length]
    choose(next.id)
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
      <div class="dta-tabs__bar" style={{ viewTransitionName: `${idPrefix}-bar` }}>
        <div
          ref={list}
          class="dta-tabs__list"
          role="tablist"
          aria-label={label}
          onKeyDown={onKeyDown}
        >
          <span class="dta-tabs__indicator" aria-hidden="true" />
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
                onClick={() => choose(tab.id)}
              >
                {tab.label}
                <span class="dta-tabs__count">
                  {tab.count !== undefined && ' · '}
                  <Changed value={tab.count ?? ''}>{tab.count}</Changed>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div
        class="dta-tabs__panel"
        role="tabpanel"
        id={`${idPrefix}-panel`}
        style={{ viewTransitionName: `${idPrefix}-panel` }}
        aria-labelledby={tabId(idPrefix, selected)}
      >
        {children}
      </div>
    </div>
  )
}
