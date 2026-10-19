/**
 * The playground on the built site (TICKET-077 and TICKET-115, spec docs/specs/playground.md):
 * the workspace with the real components in Chromium (input → source bar, summary, tabs, detail
 * panel), no request after load, Preact on this page only, the tabs' keyboard and URL hash, the
 * panel's focus and Escape (side panel and bottom sheet), no horizontal scroll at 390 and 1280 px
 * and no layout shift in both themes, and the JavaScript the page transfers. AAA contrast is
 * checked in contrast.e2e.test.ts.
 *
 * Same conditions as contrast.e2e.test.ts: needs the built site (`pnpm build` → dist/) and a
 * browser (DTA_E2E=1 in the CI job "site", or DTA_BROWSER_PATH); otherwise skipped.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const enabled = process.env.DTA_E2E === '1' || Boolean(process.env.DTA_BROWSER_PATH)
const dist = path.join(import.meta.dirname, 'dist')
const fixture = path.join(import.meta.dirname, '..', 'test', 'fixtures', 'brand-ab', 'tokens')
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
}
/** gzip bytes of the JavaScript the playground page loads (measured 2026-10-19: see TICKET-077). */
const JS_BUDGET_GZIP = 60_000

let server: http.Server
let origin: string
let browser: { newContext(o: object): Promise<any>; close(): Promise<void> }

/** Every HTML page of the built site, relative to dist. */
function htmlPages(dir = dist): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return htmlPages(full)
    return entry.name.endsWith('.html') ? [path.relative(dist, full)] : []
  })
}

async function open(width: number, theme: 'light' | 'dark') {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: theme,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error: Error) => errors.push(error.message))
  const response = await page.goto(`${origin}/playground/`, { waitUntil: 'networkidle' })
  expect(response?.ok()).toBe(true)
  await page.evaluate('document.fonts.ready.then(() => true)')
  return { context, page, errors }
}

/**
 * Elements that reach past the viewport's right edge (what would scroll sideways), unless an
 * ancestor inside the viewport clips them (overflow other than visible). The body itself hides
 * horizontal overflow, so the page's scroll width alone would not tell.
 */
const OVERFLOW = `(() => {
  const width = document.documentElement.clientWidth
  const clipped = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (getComputedStyle(a).overflowX !== 'visible' && a.getBoundingClientRect().right <= width + 0.5) return true
    }
    return false
  }
  return [...document.body.querySelectorAll('*')]
    .filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.right > width + 0.5 && !el.closest('[aria-hidden="true"]') && !clipped(el)
    })
    .map((el) => el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0])
})()`

describe.skipIf(!enabled)('playground on the built site', () => {
  beforeAll(async () => {
    expect(fs.existsSync(path.join(dist, 'playground', 'index.html')), 'site/dist is built').toBe(
      true,
    )
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

  it('hydrates Preact on the playground page only', () => {
    const islands = htmlPages().filter((page) =>
      fs.readFileSync(path.join(dist, page), 'utf8').includes('<astro-island'),
    )
    expect(islands).toEqual([path.join('playground', 'index.html')])
    // No other page references the island's renderer or component chunk.
    const html = fs.readFileSync(path.join(dist, 'playground', 'index.html'), 'utf8')
    const chunks = [...html.matchAll(/(?:component|renderer)-url="([^"]+)"/g)].map((m) => m[1])
    expect(chunks.length).toBe(2)
    for (const page of htmlPages()) {
      if (page === path.join('playground', 'index.html')) continue
      const source = fs.readFileSync(path.join(dist, page), 'utf8')
      for (const chunk of chunks)
        expect(source.includes(chunk), `${page} loads ${chunk}`).toBe(false)
    }
  })

  it('reads the example, files from the picker, a plugin export and invalid JSON, with no request after load', async () => {
    const { context, page, errors } = await open(1280, 'light')
    try {
      const requests: string[] = []
      page.on('request', (request: { url(): string }) => {
        // Chromium looks at the tab icon again when the URL hash changes (the selected tab); that
        // is the browser, not the page, and the icon is cached.
        if (new URL(request.url()).pathname !== '/favicon.svg') requests.push(request.url())
      })

      // Before loading: the drop area takes the page; the paste field is behind a button
      expect(await page.getByLabel('Paste JSON').count()).toBe(0)
      await page.getByRole('button', { name: 'Paste JSON instead' }).click()
      await expect.poll(() => page.evaluate('document.activeElement?.id')).toBe('pg-paste')
      await page.getByRole('button', { name: 'Choose files instead' }).click()
      expect(await page.getByLabel('Paste JSON').count()).toBe(0)

      // Load example: the source bar, the summary, the structure and its clean lint
      await page.getByRole('button', { name: 'Load example' }).click()
      await page.getByRole('table', { name: 'Structure' }).waitFor()
      expect(await page.getByRole('status').textContent()).toMatch(
        /^Loaded brand-ab example 6 files: Brand\(Alias\)\.BrandA\.json/,
      )
      expect(
        await page.getByRole('list', { name: 'Summary' }).getByRole('listitem').allTextContents(),
      ).toEqual(['3 collections', '2 brands', '3 breakpoints', '42 tokens', '0 lint findings'])
      expect(await page.locator('.dta-structure__name').allTextContents()).toEqual([
        'Brand(Alias) ›',
        'Primitives ›',
        'ScreenType ›',
      ])
      expect(await page.locator('.dta-structure__role').allTextContents()).toEqual([
        'brand',
        'primitives',
        'dimension',
      ])
      await page.getByRole('button', { name: '0 lint findings' }).click()
      expect(await page.getByRole('tab', { selected: true }).textContent()).toBe('Lint · 0')
      expect(await page.locator('.dta-findings__summary').textContent()).toBe(
        'No lint violations found.',
      )
      expect(await page.locator('.dta-findings__rule-row').allTextContents()).toEqual([
        'no-dangling-aliasesno findings',
        'no-circular-aliasesno findings',
        'no-default-mode-namesno findings',
      ])

      // "Replace files" opens a multi-file chooser
      const files = fs.readdirSync(fixture).filter((name) => name.startsWith('ScreenType'))
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: 'Replace files' }).click(),
      ])
      expect(chooser.isMultiple()).toBe(true)
      await chooser.setFiles(files.map((name) => path.join(fixture, name)))
      await page.getByRole('status').filter({ hasText: 'Your files 3 files' }).waitFor()
      await page.getByRole('tab', { name: 'Structure' }).click()
      expect(await page.locator('.dta-structure__name').allTextContents()).toEqual(['ScreenType ›'])

      // A pasted plugin export is converted like `dta pull --from-file` and linted
      const primitives = JSON.parse(
        fs.readFileSync(path.join(fixture, 'Primitives.Value.json'), 'utf8'),
      )
      const tokenHaus = { $extensions: { 'com.figma': { modes: {} } }, Primitives: primitives }
      await page.getByRole('button', { name: 'Paste JSON instead' }).click()
      await page.getByLabel('Paste JSON').fill(JSON.stringify(tokenHaus))
      await page.getByRole('button', { name: 'Check pasted JSON' }).click()
      await page
        .getByRole('status')
        .filter({ hasText: 'tokenhaus export converted into 1 token file' })
        .waitFor()
      await page.getByRole('tab', { name: 'Lint · 1' }).click()
      expect(await page.locator('.dta-findings__summary').textContent()).toBe(
        '1 error found. Lint failed.',
      )
      const rule = page.locator('summary', { hasText: 'no-default-mode-names' })
      expect(await rule.textContent()).toBe('no-default-mode-names1 error')
      await rule.click()
      const line = page.locator('.dta-findings__line')
      expect(await line.textContent()).toBe(
        'error Mode name "Mode 1" is a Figma default — rename to something meaningfulPrimitives.Mode 1.json',
      )
      // A lint line opens the panel with the full line as the CLI prints it
      await line.getByRole('button').click()
      const panel = page.getByRole('dialog')
      await panel.waitFor()
      expect(await panel.locator('.dta-detail__message').textContent()).toBe(
        'error Mode name "Mode 1" is a Figma default — rename to something meaningful [no-default-mode-names]',
      )

      // Invalid JSON: the CLI's diagnostic, nothing else
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Paste JSON instead' }).click()
      await page.getByLabel('Paste JSON').fill('{"Colors": ')
      await page.getByLabel('File name').fill('Brand.BrandA.json')
      await page.getByRole('button', { name: 'Check pasted JSON' }).click()
      const input = page.locator('section.dta-findings', {
        has: page.getByRole('heading', { name: 'Input' }),
      })
      await input.waitFor()
      expect(await input.locator('.dta-findings__line').textContent()).toMatch(
        /^error \[invalid-json\] "Brand\.BrandA\.json" is not valid JSON: .+ \(Brand\.BrandA\.json\)$/,
      )
      expect(await page.getByRole('tablist').count()).toBe(0)
      expect(await page.getByRole('table', { name: 'Structure' }).count()).toBe(0)

      expect(requests).toEqual([])
      expect(errors).toEqual([])
    } finally {
      await context.close()
    }
  }, 60_000)

  it('moves between the tabs with the arrow keys and keeps the selected one in the URL hash', async () => {
    const { context, page, errors } = await open(1280, 'light')
    try {
      await page.getByRole('button', { name: 'Load example' }).click()
      const selected = () => page.getByRole('tab', { selected: true }).textContent()
      const focused = () => page.evaluate('document.activeElement?.textContent')
      const tab = page.getByRole('tab', { name: 'Structure' })
      expect(await tab.getAttribute('tabindex')).toBe('0')
      expect(await page.getByRole('tab', { name: 'Graph' }).getAttribute('tabindex')).toBe('-1')
      expect(await page.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(
        await tab.getAttribute('id'),
      )
      await tab.focus()
      await page.keyboard.press('ArrowRight')
      expect(await selected()).toBe('Lint · 0')
      expect(await focused()).toBe('Lint · 0')
      expect(new URL(page.url()).hash).toBe('#lint')
      await page.keyboard.press('End')
      expect(await selected()).toBe('Outputs')
      expect(await page.getByRole('tabpanel').textContent()).toMatch(/TICKET-079/)
      await page.keyboard.press('ArrowRight')
      expect(await selected()).toBe('Structure')
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('Home')
      expect(await selected()).toBe('Structure')
      await page.keyboard.press('ArrowLeft')
      expect(await selected()).toBe('Outputs')
      expect(new URL(page.url()).hash).toBe('#outputs')

      // A reload (or a shared link) keeps the view
      await page.goto('about:blank')
      await page.goto(`${origin}/playground/#graph`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Load example' }).click()
      expect(await selected()).toBe('Graph')
      expect(await page.getByRole('tabpanel').textContent()).toMatch(/TICKET-078/)
      expect(errors).toEqual([])
    } finally {
      await context.close()
    }
  }, 60_000)

  it.each([
    [1280, false],
    [390, true],
  ] as const)(
    'at %i px the detail panel opens from a row (modal: %s), focus moves in, Escape returns it',
    async (width, modal) => {
      const { context, page, errors } = await open(width, 'light')
      try {
        await page.getByRole('button', { name: 'Load example' }).click()
        const row = page.getByRole('button', { name: /^Brand\(Alias\)/ })
        await row.focus()
        await page.keyboard.press('Enter')
        const panel = page.getByRole('dialog', { name: 'Brand(Alias)' })
        await panel.waitFor()
        expect(await panel.evaluate((el: Element) => el.matches(':modal'))).toBe(modal)
        expect(await page.evaluate('document.activeElement?.id')).toBe('pg-detail-title')
        expect(
          await row.evaluate((el: Element) => el.closest('tr')?.getAttribute('aria-current')),
        ).toBe('true')
        // The collection's tokens with alias chains and resolved values, per mode
        const tokens = panel.getByRole('list', { name: 'Tokens of Brand(Alias) in BrandA' })
        const primary = tokens.getByRole('listitem').filter({ hasText: 'Colors.Brand.Primary' })
        const inA = await primary.first().textContent()
        expect(inA).toMatch(/^Colors\.Brand\.Primary→ \{Colors\.Foundation\.[^}]+\}  #[0-9a-f]{6}$/)
        await panel.getByRole('button', { name: 'BrandB' }).click()
        const inB = await panel
          .getByRole('list', { name: 'Tokens of Brand(Alias) in BrandB' })
          .getByRole('listitem')
          .filter({ hasText: 'Colors.Brand.Primary' })
          .first()
          .textContent()
        expect(inB).not.toBe(inA)
        expect(
          await panel.getByRole('button', { name: 'BrandB' }).getAttribute('aria-pressed'),
        ).toBe('true')

        await page.keyboard.press('Escape')
        await expect.poll(() => panel.isVisible()).toBe(false)
        await expect
          .poll(() => page.evaluate('document.activeElement?.textContent'))
          .toBe('Brand(Alias) ›')

        // The close button closes it too, and focus returns again
        await page.getByRole('button', { name: /^ScreenType/ }).click()
        await page.getByRole('button', { name: 'Close details' }).click()
        await expect.poll(() => page.getByRole('dialog').isVisible()).toBe(false)
        await expect
          .poll(() => page.evaluate('document.activeElement?.textContent'))
          .toBe('ScreenType ›')
        expect(errors).toEqual([])
      } finally {
        await context.close()
      }
    },
    60_000,
  )

  it.each([
    [390, 'light'],
    [390, 'dark'],
    [1280, 'light'],
    [1280, 'dark'],
  ] as const)(
    'at %i px in %s: no layout shift on load, nothing wider than the screen in any state',
    async (width, theme) => {
      const { context, page } = await open(width, theme)
      try {
        await page.waitForTimeout(300)
        const shift = (await page.evaluate(`new Promise((resolve) => {
          let sum = 0
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) if (!entry.hadRecentInput) sum += entry.value
          }).observe({ type: 'layout-shift', buffered: true })
          setTimeout(() => resolve(sum), 200)
        })`)) as number
        expect(shift).toBe(0)
        expect(await page.evaluate(OVERFLOW), 'empty').toEqual([])
        await page.getByRole('button', { name: 'Paste JSON instead' }).click()
        expect(await page.evaluate(OVERFLOW), 'paste field').toEqual([])
        await page.getByRole('button', { name: 'Load example' }).click()
        await page.getByRole('table', { name: 'Structure' }).waitFor()
        expect(await page.evaluate(OVERFLOW), 'loaded').toEqual([])
        await page.getByRole('button', { name: /^Brand\(Alias\)/ }).click()
        await page.getByRole('dialog').waitFor()
        expect(await page.evaluate(OVERFLOW), 'panel open').toEqual([])
        await page.getByRole('button', { name: 'Close details' }).click()
        await page.getByRole('tab', { name: /^Lint/ }).click()
        expect(await page.evaluate(OVERFLOW), 'lint').toEqual([])
        await page.getByRole('button', { name: 'Paste JSON instead' }).click()
        await page.getByLabel('Paste JSON').fill('{"Colors": ')
        await page.getByRole('button', { name: 'Check pasted JSON' }).click()
        await page.getByRole('heading', { name: 'Input' }).waitFor()
        expect(await page.evaluate(OVERFLOW), 'invalid').toEqual([])
      } finally {
        await context.close()
      }
    },
    60_000,
  )

  it('keeps the tab bar at the top of a phone screen while the view scrolls', async () => {
    const { context, page } = await open(390, 'light')
    try {
      await page.getByRole('button', { name: 'Load example' }).click()
      await page.getByRole('table', { name: 'Structure' }).waitFor()
      await page.evaluate('window.scrollTo(0, 700)')
      const top = (await page
        .getByRole('tablist')
        .evaluate((el: Element) => el.getBoundingClientRect().top)) as number
      expect(top).toBeGreaterThanOrEqual(0)
      expect(top).toBeLessThan(24)
    } finally {
      await context.close()
    }
  }, 60_000)

  it('keeps the JavaScript the page transfers within its budget', async () => {
    const { context, page } = await open(1280, 'light')
    try {
      const scripts = (await page.evaluate(
        `performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.js')).map((e) => new URL(e.name).pathname)`,
      )) as string[]
      expect(scripts.length).toBeGreaterThan(0)
      const bytes = scripts.map((script) => fs.readFileSync(path.join(dist, script)))
      const raw = bytes.reduce((sum, b) => sum + b.length, 0)
      const gzip = bytes.reduce((sum, b) => sum + zlib.gzipSync(b).length, 0)
      console.log(`playground JS: ${scripts.length} files, ${raw} B minified, ${gzip} B gzip`)
      expect(gzip).toBeLessThanOrEqual(JS_BUDGET_GZIP)
      // Outputs (Style Dictionary) are not part of the first load (spec decision 9).
      expect(bytes.some((b) => b.includes('style-dictionary'))).toBe(false)
    } finally {
      await context.close()
    }
  }, 60_000)
})
