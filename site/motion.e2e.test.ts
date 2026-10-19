/**
 * Motion rules on the rendered site (design-system/motion, TICKET-116): under
 * `prefers-reduced-motion: reduce` the well, the floating objects and every other story have no
 * running animation, and the well's canvas is drawn once (its loop stops); the playground moves
 * nothing under reduced motion but still highlights changed values, and with motion its
 * transitions run on the motion tokens (also the detail panel's "Next finding", TICKET-113); neither the playground nor the landing page shifts its
 * layout. Same conditions as contrast.e2e.test.ts (built site, Chromium).
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const enabled = process.env.DTA_E2E === '1' || Boolean(process.env.DTA_BROWSER_PATH)
const dist = path.join(import.meta.dirname, 'dist')
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
}

/** The motion token durations in ms (site/tokens: motion.duration.*, motion.stagger). */
const TOKEN_MS = [0, 40, 120, 200, 320, 1200]

/**
 * Records every animation and transition the page starts (each frame): which properties it
 * animates, on what, how long it runs and with which delay; and how often a View Transition starts.
 */
const RECORD = `(() => {
  const motion = (window.__motion = { props: {}, timings: [], vt: 0 })
  const start = document.startViewTransition?.bind(document)
  if (start) document.startViewTransition = (...args) => { motion.vt++; return start(...args) }
  const kebab = (p) => p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
  const seen = new WeakSet()
  const tick = () => {
    for (const a of document.getAnimations()) {
      if (seen.has(a)) continue
      seen.add(a)
      const effect = a.effect
      const props = a.transitionProperty
        ? [a.transitionProperty]
        : [...new Set(effect.getKeyframes().flatMap((k) => Object.keys(k)))]
            .filter((p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p))
            .map(kebab)
      const target = effect.pseudoElement || String(effect.target?.className || effect.target?.tagName)
      for (const p of props) (motion.props[p] ??= []).push(target.split(' ')[0])
      const timing = effect.getTiming()
      motion.timings.push([target.split(' ')[0], props.join(','), timing.duration, timing.delay])
    }
    requestAnimationFrame(tick)
  }
  tick()
})()`

/** Layout shifts without recent input, summed from now on. */
const WATCH_SHIFTS = `window.__shift = 0; new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shift += entry.value
}).observe({ type: 'layout-shift', buffered: true })`

let server: http.Server
let origin: string
let browser: { newContext(o: object): Promise<any>; close(): Promise<void> }

describe.skipIf(!enabled)('motion on the rendered stories', () => {
  beforeAll(async () => {
    expect(fs.existsSync(path.join(dist, 'index.html')), 'site/dist is built').toBe(true)
    server = http.createServer((req, res) => {
      let file = path.join(dist, decodeURIComponent((req.url ?? '/').split('?')[0]))
      if (fs.existsSync(file) && fs.statSync(file).isDirectory())
        file = path.join(file, 'index.html')
      if (!fs.existsSync(file)) return void res.writeHead(404).end()
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      })
      fs.createReadStream(file).pipe(res)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    const playwright = await import('playwright-core')
    browser = await playwright.chromium.launch({
      executablePath: process.env.DTA_BROWSER_PATH || undefined,
    })
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    server?.close()
  })

  it('runs 0 animations under reduced motion, on every story', async () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dist, 'stories', 'manifest.json'), 'utf8'),
    )
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    })
    const running: Record<string, number> = {}
    try {
      for (const story of manifest.stories as Array<{ id: string; url: string }>) {
        const page = await context.newPage()
        await page.goto(`${origin}${story.url}`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(300)
        const count = await page.evaluate(
          `document.getAnimations().filter((a) => a.playState === 'running').length`,
        )
        if (count) running[story.id] = count as number
        await page.close()
      }
    } finally {
      await context.close()
    }
    expect(running).toEqual({})
  }, 300_000)

  it('draws the hero well once under reduced motion and keeps drawing otherwise', async () => {
    const frames = async (reduced: boolean) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: reduced ? 'reduce' : 'no-preference',
      })
      try {
        const page = await context.newPage()
        await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
        // the well draws through requestAnimationFrame; count the frames the page schedules
        return (await page.evaluate(`new Promise((resolve) => {
          let n = 0
          const raf = window.requestAnimationFrame
          window.requestAnimationFrame = (cb) => { n++; return raf.call(window, cb) }
          setTimeout(() => resolve(n), 600)
        })`)) as number
      } finally {
        await context.close()
      }
    }
    // the landing page's hero: one frame under reduced motion, a running loop otherwise
    expect(await frames(true)).toBe(0)
    expect(await frames(false)).toBeGreaterThan(20)
  }, 60_000)

  /** Drives the playground through every transition of TICKET-116. */
  async function playgroundFlow(page: any) {
    await page.getByRole('button', { name: 'Load example' }).click()
    await page.getByRole('table', { name: 'Structure' }).waitFor()
    await page.waitForTimeout(400)
    await page.getByRole('tab', { name: /^Lint/ }).click()
    await page.getByRole('heading', { name: 'Default rules' }).waitFor()
    await page.waitForTimeout(300)
    await page.getByRole('tab', { name: /^Structure/ }).click()
    await page.getByRole('button', { name: /^Brand\(Alias\)/ }).waitFor()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /^Brand\(Alias\)/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    const opened = await dialog.boundingBox()
    await page.waitForTimeout(400)
    const settled = await dialog.boundingBox()
    await page.getByRole('button', { name: 'Close details' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('tab', { name: /^Outputs/ }).click()
    await page.locator('.dta-outputs').waitFor()
    await page.waitForTimeout(400)
    await page.getByRole('checkbox', { name: 'CSS' }).click()
    await page.getByRole('button', { name: '7 output files' }).waitFor()
    // The changed count, right after it changed: highlighted, on the action-subtle ground.
    const highlight = await page.evaluate(`(() => {
      const probe = document.createElement('span')
      probe.style.background = 'var(--action-subtle)'
      document.body.append(probe)
      const subtle = getComputedStyle(probe).backgroundColor
      probe.remove()
      return [...document.querySelectorAll('.dta-changed[data-changed]')]
        .filter((el) => el.getAnimations().some((a) => a.playState === 'running'))
        .map((el) => [el.textContent, getComputedStyle(el).backgroundColor === subtle])
    })()`)
    await page.waitForTimeout(400)
    // A rule with findings opens (a pasted export with Figma's default mode name).
    await page.getByRole('button', { name: 'Paste JSON instead' }).click()
    await page.getByLabel('Paste JSON').fill(
      JSON.stringify({
        $extensions: { 'com.figma': { modes: {} } },
        Primitives: { Blue: { $type: 'color', $value: '#2443ac' } },
      }),
    )
    await page.getByRole('button', { name: 'Check pasted JSON' }).click()
    await page.getByRole('tab', { name: /^Lint/ }).click()
    await page.locator('summary', { hasText: 'no-default-mode-names' }).click()
    // The height of the opening rule, frame by frame.
    const opening = (await page.evaluate(`new Promise((resolve) => {
      const rule = document.querySelector('details.dta-findings__rule[open]')
      const heights = []
      const frame = () => {
        heights.push(Math.round(rule.getBoundingClientRect().height))
        if (heights.length < 20) requestAnimationFrame(frame)
        else resolve(heights)
      }
      frame()
    })`)) as number[]
    await page.waitForTimeout(400)
    return { opened, settled, highlight, opening }
  }

  it.each([1280, 390])(
    'moves nothing on the playground under reduced motion at %i px, and still highlights changed values',
    async (width) => {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
      })
      try {
        const page = await context.newPage()
        await page.goto(`${origin}/playground/`, { waitUntil: 'networkidle' })
        await page.evaluate(RECORD)
        await page.evaluate(WATCH_SHIFTS)
        const { opened, settled, highlight, opening } = await playgroundFlow(page)
        const motion = (await page.evaluate('window.__motion')) as {
          props: Record<string, string[]>
          vt: number
        }
        // The rule's lines are there at once.
        expect(new Set(opening).size).toBe(1)
        // Only colour changes: the highlight of changed values. Nothing slides, grows or turns.
        expect(Object.keys(motion.props).sort()).toEqual(['background-color', 'color'])
        expect([...new Set(Object.values(motion.props).flat())]).toEqual(['dta-changed'])
        expect(motion.vt).toBe(0)
        // The panel (or the sheet) is where it ends up at once.
        expect(opened).toEqual(settled)
        // The summary part and the Outputs tab count that changed are highlighted.
        expect(highlight).toEqual(
          expect.arrayContaining([
            ['7 output files', true],
            ['7', true],
          ]),
        )
        expect(await page.evaluate('window.__shift')).toBe(0)
      } finally {
        await context.close()
      }
    },
    90_000,
  )

  it.each([1280, 390])(
    'runs the playground transitions on the motion tokens at %i px, without layout shift',
    async (width) => {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: 'no-preference',
      })
      try {
        const page = await context.newPage()
        await page.goto(`${origin}/playground/`, { waitUntil: 'networkidle' })
        await page.evaluate(RECORD)
        await page.evaluate(WATCH_SHIFTS)
        const { opened, settled, highlight, opening } = await playgroundFlow(page)
        const motion = (await page.evaluate('window.__motion')) as {
          props: Record<string, string[]>
          timings: Array<[string, string, number, number]>
          vt: number
        }
        // A read, a tab change, the new outputs: View Transitions (Chromium has them).
        expect(motion.vt).toBeGreaterThanOrEqual(3)
        const on = (prop: string) => motion.props[prop] ?? []
        expect(on('transform')).toEqual(
          expect.arrayContaining(['dta-detail', 'dta-tabs__indicator']),
        )
        // The rule's lines open by growing (CSS ::details-content, which getAnimations misses).
        expect(opening[0]).toBeLessThan(opening[opening.length - 1])
        expect(on('opacity')).toContain('::view-transition-new(root)')
        expect(on('opacity')).toContain('::view-transition-new(pg-panel)')
        expect(on('background-color')).toContain('dta-changed')
        if (width >= 1024) expect(on('grid-template-columns')).toContain('pg-work')
        else expect(on('opacity')).toContain('::backdrop')
        // Every duration and delay is a motion token (or a sum of two, for a stagger).
        const sums = new Set(TOKEN_MS.flatMap((a) => TOKEN_MS.map((b) => a + b)))
        const off = motion.timings.filter(([, , duration, delay]) => {
          const ms = (value: number) => Math.round(value)
          return !sums.has(ms(duration)) || !(sums.has(ms(delay)) || ms(delay) % 40 === 0)
        })
        expect(off).toEqual([])
        // The panel slides in: first frame not yet where it ends.
        expect(opened).not.toEqual(settled)
        expect(highlight).toEqual(expect.arrayContaining([['7 output files', true]]))
        expect(await page.evaluate('window.__shift')).toBe(0)
      } finally {
        await context.close()
      }
    },
    90_000,
  )

  it.each([
    [1280, 'reduce'],
    [390, 'reduce'],
    [1280, 'no-preference'],
    [390, 'no-preference'],
  ] as const)(
    '"Next finding" at %i px (%s motion): the new content fades in with motion only, the position lights up',
    async (width, reducedMotion) => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion })
      try {
        const page = await context.newPage()
        await page.goto(`${origin}/playground/#lint`, { waitUntil: 'networkidle' })
        await page.getByRole('button', { name: 'Example with problems' }).click()
        await page.locator('summary', { hasText: 'no-dangling-aliases' }).click()
        await page.locator('#pg-finding-0-0').click()
        const next = page.getByRole('button', { name: 'Next finding' })
        await next.waitFor()
        await page.waitForTimeout(400)
        const opened = await page.getByRole('dialog').boundingBox()
        await page.evaluate(RECORD)
        await page.evaluate(WATCH_SHIFTS)
        await next.click()
        const lit = await page.evaluate(`(() => {
          const el = document.querySelector('.dta-detail__position .dta-changed[data-changed]')
          return Boolean(el && el.getAnimations().some((a) => a.playState === 'running'))
        })()`)
        await page.waitForTimeout(400)
        const motion = (await page.evaluate('window.__motion')) as {
          props: Record<string, string[]>
          timings: Array<[string, string, number, number]>
          vt: number
        }
        expect(lit).toBe(true)
        // The panel stays where it is (its height follows the content); no View Transition.
        const after = await page.getByRole('dialog').boundingBox()
        expect([after.x, after.width]).toEqual([opened.x, opened.width])
        if (width >= 1024) expect(after.y).toBe(opened.y)
        expect(motion.vt).toBe(0)
        if (reducedMotion === 'reduce') {
          expect(Object.keys(motion.props).sort()).toEqual(['background-color', 'color'])
          expect([...new Set(Object.values(motion.props).flat())]).toEqual(['dta-changed'])
        } else {
          expect(motion.props.opacity ?? []).toContain('dta-detail__message')
          for (const [, , duration] of motion.timings)
            expect(TOKEN_MS).toContain(Math.round(duration))
        }
        expect(await page.evaluate('window.__shift')).toBe(0)
      } finally {
        await context.close()
      }
    },
    60_000,
  )

  it.each([
    [390, 'reduce'],
    [390, 'no-preference'],
    [1280, 'reduce'],
    [1280, 'no-preference'],
  ] as const)(
    'shifts no layout on the landing page at %i px (%s motion)',
    async (width, reducedMotion) => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion })
      try {
        const page = await context.newPage()
        await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
        await page.evaluate(WATCH_SHIFTS)
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight / 2)')
        await page.waitForTimeout(500)
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        await page.waitForTimeout(500)
        expect(await page.evaluate('window.__shift')).toBe(0)
        const scroll = (await page.evaluate(
          '[document.documentElement.scrollWidth, document.documentElement.clientWidth]',
        )) as [number, number]
        expect(scroll[0]).toBeLessThanOrEqual(scroll[1])
      } finally {
        await context.close()
      }
    },
    60_000,
  )
})
