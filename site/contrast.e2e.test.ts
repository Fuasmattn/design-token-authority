/**
 * AAA on the rendered pages: every text node of the landing page and the playground (empty, the
 * paste field, after the example, the detail panel open beside the view or as the bottom sheet, a
 * lint finding open, the "Example with problems" with its rules open and a finding stepped to with
 * "Next finding" (TICKET-113), an unknown export with its docs link (TICKET-114), the build errors of
 * the example with problems (TICKET-119), after invalid input, the Outputs view, an output file's preview, a
 * copied file; both themes) and of every
 * story (each renders Light and Graphite side by side) reaches 7:1 against its effective
 * background, 4.5:1 when large (24 px, or 18.66 px bold). So does the `dta diff` report for each
 * verdict (pass, review, fail; TICKET-120 status colours). The token test checks the pairs the
 * system names; this checks what the browser paints, nesting and opacity included.
 *
 * Needs the built site (`pnpm build` → dist/) and a browser: runs when DTA_E2E=1 (CI job
 * "site") or when DTA_BROWSER_PATH points at Chromium; otherwise skipped.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { diffResultSchema, renderReportHtml } from '@dta/visual-diff'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const enabled = process.env.DTA_E2E === '1' || Boolean(process.env.DTA_BROWSER_PATH)
const dist = path.join(import.meta.dirname, 'dist')

interface Failure {
  text: string
  element: string
  fg: string
  bg: string
  size: number
  weight: number
  ratio: number
}

/** Runs in the page: text nodes → contrast over the effective background. */
const AUDIT = `(() => {
  const parse = (s) => { const m = (s.match(/[\\d.]+/g) || []).map(Number); return m.length === 3 ? [...m, 1] : m }
  const over = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)) }
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  const canvas = parse(getComputedStyle(document.body).backgroundColor)
  const bgOf = (el) => {
    let e = el, acc = null
    while (e && e !== document) {
      const bg = parse(getComputedStyle(e).backgroundColor)
      if (bg.length === 4 && bg[3] > 0) { acc = acc ? over(acc, bg) : bg; if (bg[3] >= 1) return acc }
      e = e.parentElement
    }
    return acc ? over(acc, canvas) : canvas
  }
  const opacityOf = (el) => { let o = 1, e = el; while (e && e !== document) { o *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement } return o }
  const seen = new Map()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim()
    if (!text) continue
    const el = node.parentElement
    if (!el || el.closest('script, style, [aria-hidden="true"], [data-contrast-exception]')) continue
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    const raw = parse(s.color)
    const bg = bgOf(el)
    const fg = over([raw[0], raw[1], raw[2], raw[3] * opacityOf(el)], bg)
    const size = parseFloat(s.fontSize), weight = Number(s.fontWeight)
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const r = ratio(fg, bg)
    if (r >= (large ? 4.5 : 7)) continue
    const key = [s.color, bg.map(Math.round).join(','), size, weight].join('|')
    if (seen.has(key)) continue
    seen.set(key, { text: text.slice(0, 40), element: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''), fg: s.color, bg: 'rgb(' + bg.map(Math.round).join(', ') + ')', size, weight, ratio: Math.round(r * 100) / 100 })
  }
  return [...seen.values()]
})()`

let server: http.Server
let origin: string
let browser: { newContext(o: object): Promise<any>; close(): Promise<void> }

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
}

function serve(root: string): Promise<http.Server> {
  const s = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent((req.url ?? '/').split('?')[0]))
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!fs.existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => s.listen(0, '127.0.0.1', () => resolve(s)))
}

/** Brings a page into the state to audit (the playground after an input). */
type Prepare = (page: any) => Promise<void>

async function audit(
  url: string,
  width: number,
  brand?: string,
  prepare?: Prepare,
): Promise<Failure[]> {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
    colorScheme: brand === 'graphite' ? 'dark' : 'light',
  })
  try {
    const page = await context.newPage()
    const response = await page.goto(url, { waitUntil: 'networkidle' })
    expect(response?.ok(), url).toBe(true)
    if (brand) {
      await page.evaluate(
        `document.documentElement.dataset.brand = ${JSON.stringify(brand)}; document.documentElement.dataset.theme = ${JSON.stringify(brand === 'graphite' ? 'dark' : 'light')}`,
      )
    }
    await page.evaluate('document.fonts.ready.then(() => true)')
    await prepare?.(page)
    return (await page.evaluate(AUDIT)) as Failure[]
  } finally {
    await context.close()
  }
}

describe.skipIf(!enabled)('rendered contrast (AAA)', () => {
  beforeAll(async () => {
    expect(fs.existsSync(path.join(dist, 'index.html')), 'site/dist is built').toBe(true)
    server = await serve(dist)
    const address = server.address() as { port: number }
    origin = `http://127.0.0.1:${address.port}`
    const playwright = await import('playwright-core')
    browser = await playwright.chromium.launch({
      executablePath: process.env.DTA_BROWSER_PATH || undefined,
    })
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    server?.close()
  })

  it.each([
    ['light', 1280],
    ['light', 390],
    ['graphite', 1280],
    ['graphite', 390],
  ])(
    'landing page in %s at %i px',
    async (brand, width) => {
      expect(await audit(`${origin}/`, width, brand)).toEqual([])
    },
    60_000,
  )

  const loadExample: Prepare = async (page) => {
    await page.getByRole('button', { name: 'Load example' }).click()
    await page.getByRole('table', { name: 'Structure' }).waitFor()
  }
  const PLAYGROUND: Record<string, Prepare | undefined> = {
    empty: undefined,
    'paste field': async (page) => {
      await page.getByRole('button', { name: 'Paste JSON instead' }).click()
    },
    example: loadExample,
    'panel open': async (page) => {
      await loadExample(page)
      await page.getByRole('button', { name: /^Brand\(Alias\)/ }).click()
      await page.getByRole('dialog').waitFor()
    },
    'lint finding open': async (page) => {
      // A plugin export with Figma's default mode name: one error, its rule and line opened.
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
      await page.locator('.dta-findings__line').getByRole('button').click()
      await page.getByRole('dialog').waitFor()
    },
    // TICKET-113: the example with problems, every rule open
    'example with problems, lint': async (page) => {
      await page.getByRole('button', { name: 'Example with problems' }).click()
      await page.getByRole('tab', { name: /^Lint/ }).click()
      for (const rule of await page.locator('summary').all()) await rule.click()
      await page.locator('.dta-findings__line').nth(2).waitFor()
    },
    // ...a finding stepped to with "Next finding", its position held at the highlight's start
    'next finding': async (page) => {
      await page.getByRole('button', { name: 'Example with problems' }).click()
      await page.getByRole('tab', { name: /^Lint/ }).click()
      await page.locator('summary').first().click()
      await page.locator('.dta-findings__line').first().getByRole('button').click()
      await page.getByRole('button', { name: 'Next finding' }).click()
      await page.locator('.dta-detail__position', { hasText: '2 of 3' }).waitFor()
      const held = await page.evaluate(`(() => {
        const animations = [...document.querySelectorAll('.dta-detail__position .dta-changed[data-changed]')].flatMap((el) => el.getAnimations())
        for (const a of animations) { a.pause(); a.currentTime = 0 }
        return animations.length
      })()`)
      expect(held).toBe(1)
    },
    outputs: async (page) => {
      await loadExample(page)
      await page.getByRole('tab', { name: /^Outputs/ }).click()
      await page.locator('.dta-outputs').waitFor()
    },
    'output file open': async (page) => {
      await loadExample(page)
      await page.getByRole('tab', { name: /^Outputs/ }).click()
      await page.getByRole('button', { name: 'output/css/themes/branda.css', exact: true }).click()
      await page.getByRole('dialog').waitFor()
    },
    'config open, a file copied': async (page) => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
      await loadExample(page)
      await page.getByRole('tab', { name: /^Outputs/ }).click()
      await page.getByRole('button', { name: 'Copy output/css/base.css' }).click()
      await page.getByRole('button', { name: 'dta.config.ts', exact: true }).click()
      await page.getByRole('dialog').waitFor()
    },
    // TICKET-116: changed counts held at the start of their highlight (action-subtle ground).
    'changed counts highlighted': async (page) => {
      await loadExample(page)
      await page.getByRole('tab', { name: /^Outputs/ }).click()
      await page.locator('.dta-outputs').waitFor()
      await page.getByRole('checkbox', { name: 'CSS' }).click()
      await page.getByRole('button', { name: '7 output files' }).waitFor()
      const held = await page.evaluate(`(() => {
        const animations = [...document.querySelectorAll('.dta-changed[data-changed]')].flatMap((el) => el.getAnimations())
        for (const a of animations) { a.pause(); a.currentTime = 0 }
        return animations.length
      })()`)
      expect(held).toBeGreaterThanOrEqual(2)
    },
    // TICKET-114: an export in no known format, its docs pointer a link to the website's page
    'unknown export with its docs link': async (page) => {
      await page.getByRole('button', { name: 'Paste JSON instead' }).click()
      await page.getByLabel('Paste JSON').fill('{"Colors": "not tokens"}')
      await page.getByRole('button', { name: 'Check pasted JSON' }).click()
      await page.getByRole('link', { name: 'Token files reference' }).waitFor()
    },
    // TICKET-119: the build errors of the example with problems, with their docs links
    'example with problems, build errors': async (page) => {
      await page.getByRole('button', { name: 'Example with problems' }).click()
      await page.getByRole('tab', { name: /^Outputs/ }).click()
      await page.getByRole('link', { name: 'Lint rules reference' }).first().waitFor()
    },
    'invalid input': async (page) => {
      await page.getByRole('button', { name: 'Paste JSON instead' }).click()
      await page.getByLabel('Paste JSON').fill('{"Colors": ')
      await page.getByRole('button', { name: 'Check pasted JSON' }).click()
      await page.getByRole('heading', { name: 'Input' }).waitFor()
    },
  }
  it.each(
    Object.keys(PLAYGROUND).flatMap((state) =>
      (['light', 'graphite'] as const).flatMap((brand) =>
        [1280, 390].map((width) => [state, brand, width] as const),
      ),
    ),
  )(
    'playground (%s) in %s at %i px',
    async (state, brand, width) => {
      expect(await audit(`${origin}/playground/`, width, brand, PLAYGROUND[state])).toEqual([])
    },
    60_000,
  )

  // The dta diff report (TICKET-120): each verdict in its status colours, with pass and fail chips.
  const report = (verdict: 'pass' | 'review' | 'fail') => {
    const story = (id: string, status: 'changed' | 'unchanged', explained: boolean) => ({
      id,
      title: id,
      url: `/stories/${id}/`,
      viewport: 1280,
      status,
      ratio: status === 'changed' ? 0.02 : 0,
      changedPixels: status === 'changed' ? 200 : 0,
      images: { base: `base/${id}.png`, head: `head/${id}.png`, diff: `diff/${id}.png` },
      ...(status === 'changed'
        ? {
            attribution: {
              explained,
              tokens: [],
              unexplainedPixels: explained ? 0 : 200,
              canvas: { width: 400, height: 200 },
            },
          }
        : {}),
    })
    return renderReportHtml(
      diffResultSchema.parse({
        schema: 'dta.diff/1',
        base: 'merge base with origin/main (1a2b3c4)',
        verdict,
        tokens: { counts: { changed: 0, added: 0, removed: 0, affected: 0 }, changes: [] },
        stories: [
          story('text', 'unchanged', true),
          ...(verdict === 'pass' ? [] : [story('card', 'changed', verdict === 'review')]),
        ],
      }),
    )
  }
  it.each(
    (['pass', 'review', 'fail'] as const).flatMap((verdict) =>
      (['light', 'graphite'] as const).flatMap((brand) =>
        [1280, 390].map((width) => [verdict, brand, width] as const),
      ),
    ),
  )(
    'dta diff report (%s) in %s at %i px',
    async (verdict, brand, width) => {
      const html = report(verdict)
      expect(html).toContain(`<span class="chip ${verdict}">`)
      const found = await audit(`${origin}/`, width, brand, async (page) => {
        await page.setContent(html)
        expect(await page.evaluate('document.documentElement.dataset.brand')).toBe(brand)
      })
      expect(found).toEqual([])
    },
    60_000,
  )

  it('every story, both themes', async () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dist, 'stories', 'manifest.json'), 'utf8'),
    )
    const stories: Array<{ url: string; id: string }> = manifest.stories
    const failures: Record<string, Failure[]> = {}
    for (const story of stories) {
      const found = await audit(`${origin}${story.url}`, 1280)
      if (found.length) failures[story.id] = found
    }
    expect(failures).toEqual({})
  }, 300_000)
})
