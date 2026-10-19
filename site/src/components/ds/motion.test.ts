import { afterEach, describe, expect, it, vi } from 'vitest'
import { countChange, prefersReducedMotion, transition } from './motion'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A window whose `prefers-reduced-motion` answers `reduced`. */
const stubWindow = (reduced: boolean) =>
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) })

describe('countChange', () => {
  it('counts nothing until the value changes, then each change', () => {
    const state = { value: '6 files', count: 0 }
    expect(countChange(state, '6 files')).toBe(0)
    expect(countChange(state, '3 files')).toBe(1)
    expect(countChange(state, '3 files')).toBe(1)
    expect(countChange(state, '6 files')).toBe(2)
  })

  it('treats a count that appears as a change', () => {
    const state = { value: '' as string, count: 0 }
    expect(countChange(state, '11')).toBe(1)
  })
})

describe('transition', () => {
  it('runs the update at once without a document (server rendering)', () => {
    const update = vi.fn()
    transition(update)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('runs the update at once where the browser has no View Transitions', () => {
    stubWindow(false)
    vi.stubGlobal('document', {})
    const update = vi.fn()
    transition(update, 'dta-tabs')
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('starts a typed View Transition that runs the update', async () => {
    stubWindow(false)
    const calls: Array<{ update: () => Promise<void>; types?: string[] }> = []
    vi.stubGlobal('document', {
      startViewTransition: (options: { update: () => Promise<void>; types?: string[] }) => {
        calls.push(options)
        return { finished: Promise.resolve() }
      },
    })
    const update = vi.fn()
    transition(update, 'dta-tabs')
    expect(update).not.toHaveBeenCalled()
    expect(calls[0].types).toEqual(['dta-tabs'])
    await calls[0].update()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('falls back to the callback form in browsers before transition types', async () => {
    stubWindow(false)
    const callbacks: Array<() => Promise<void>> = []
    vi.stubGlobal('document', {
      startViewTransition: (argument: unknown) => {
        if (typeof argument !== 'function') throw new TypeError('not a callback')
        callbacks.push(argument as () => Promise<void>)
        return { finished: Promise.resolve() }
      },
    })
    const update = vi.fn()
    transition(update, 'dta-read')
    await callbacks[0]()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('changes at once under prefers-reduced-motion, with no View Transition', () => {
    stubWindow(true)
    const start = vi.fn()
    vi.stubGlobal('document', { startViewTransition: start })
    const update = vi.fn()
    expect(prefersReducedMotion()).toBe(true)
    transition(update, 'dta-tabs')
    expect(update).toHaveBeenCalledTimes(1)
    expect(start).not.toHaveBeenCalled()
  })
})
