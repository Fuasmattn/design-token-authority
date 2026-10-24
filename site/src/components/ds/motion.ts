/**
 * Motion helpers of the design system (design-system/motion: the rule against change
 * blindness). Durations and easings live in the motion tokens (`--motion-*`); these helpers
 * only decide *whether* and *how* a change is animated:
 *
 * - `transition(update, type)` runs a state change inside a View Transition where the browser
 *   has one (`document.startViewTransition`), so the old view crossfades into the new one and
 *   named elements move to their new place. Without the API, or under
 *   `prefers-reduced-motion: reduce`, it runs the change at once (the components' own CSS
 *   transitions still crossfade where they can).
 * - `useChanged(value)` counts how often a value has changed since the component mounted; the
 *   Changed component uses it to highlight a value briefly when it changes (not on first render).
 */
import { useRef } from 'preact/hooks'

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(REDUCED_MOTION_QUERY).matches
}

interface ViewTransitionDocument {
  startViewTransition?: (
    options: { update: () => Promise<void> | void; types?: string[] } | (() => Promise<void>),
  ) => { finished: Promise<void> }
}

/** Resolves once Preact has rendered what the update scheduled (it renders in a microtask). */
const rendered = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * Runs `update` (a state change) as a View Transition of the given type, or at once where that
 * is not possible or not wanted. The type lets CSS style one kind of transition
 * (`html:active-view-transition-type(dta-tabs)`).
 */
export function transition(update: () => void, type?: string): void {
  const doc = (typeof document === 'undefined' ? undefined : document) as
    (Document & ViewTransitionDocument) | undefined
  if (!doc?.startViewTransition || prefersReducedMotion()) {
    update()
    return
  }
  const run = async () => {
    update()
    await rendered()
  }
  try {
    doc.startViewTransition({ update: run, types: type ? [type] : [] })
  } catch {
    // Browsers before transition types take only a callback.
    try {
      doc.startViewTransition(run)
    } catch {
      update()
    }
  }
}

/** What `useChanged` remembers between renders. */
export interface ChangeState<T> {
  value: T
  count: number
}

/** Counts a change of `value` against the remembered one (pure; `useChanged` keeps the state). */
export function countChange<T>(state: ChangeState<T>, value: T): number {
  if (!Object.is(state.value, value)) {
    state.value = value
    state.count += 1
  }
  return state.count
}

/**
 * How often `value` has changed since the first render (0 until it changes). Use it as a `key`
 * to restart a highlight, and its being above 0 to show one only after a real change.
 */
export function useChanged<T>(value: T): number {
  const state = useRef<ChangeState<T>>({ value, count: 0 })
  return countChange(state.current, value)
}
