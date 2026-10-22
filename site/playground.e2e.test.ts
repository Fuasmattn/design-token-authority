/**
 * The playground on the built site (TICKET-077 and TICKET-115, spec docs/specs/playground.md):
 * the workspace with the real components in Chromium (input → source bar, summary, tabs, detail
 * panel), no request after load, Preact on this page only, the tabs' keyboard and URL hash, the
 * panel's focus and Escape (side panel and bottom sheet), the "Example with problems" and the
 * panel's "Next finding" (TICKET-113), the dependency graph (TICKET-078: a token selected, its
 * chain and readings, "Show in graph" and "Show in lint" both ways with the hash, the brand switch,
 * the keyboard, the phone's list and sheet, the graph's chunk loaded lazily), no horizontal scroll
 * at 390 and 1280 px and no layout shift in both themes, and the JavaScript the page transfers:
 * a first load without `@dta/*` and a budget per lazy chunk (TICKET-124: the analysis loads when
 * the browser is idle or on the first input; input before it is read once it is there).
 * AAA contrast is checked in contrast.e2e.test.ts.
 *
 * Same conditions as contrast.e2e.test.ts: needs the built site (`pnpm build` → dist/) and a
 * browser (DTA_E2E=1 in the CI job "site", or DTA_BROWSER_PATH); otherwise skipped.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'
import { strFromU8, unzipSync } from 'fflate'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const enabled = process.env.DTA_E2E === '1' || Boolean(process.env.DTA_BROWSER_PATH)
const dist = path.join(import.meta.dirname, 'dist')
const fixture = path.join(import.meta.dirname, '..', 'test', 'fixtures', 'brand-ab', 'tokens')
/** What `dta build` writes for brand-ab (the CLI reference snapshot). */
const snapshot = path.join(
  import.meta.dirname,
  '..',
  'test',
  'snapshots',
  'brand-ab',
  'build',
  'files',
)
/**
 * The snapshot's files without the ScreenType blocks: the fixture's config has `breakpoints`
 * (TICKET-091), the playground's generated config does not (it cannot know the media queries).
 */
const snapshotFiles = (dir = snapshot): Record<string, string> =>
  Object.fromEntries(
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return Object.entries(snapshotFiles(full))
      const content = fs.readFileSync(full, 'utf8').split(/\n(?=\/\* ScreenType[ :·])/)[0]
      return [[path.relative(snapshot, full).split(path.sep).join('/'), content]]
    }),
  )
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
}
/**
 * gzip bytes of the playground's JavaScript, per part (TICKET-124: measured 2026-10-21 and rounded
 * up to the next 5 KB; the numbers are in the ticket's outcome). Growth shows up in the part that
 * grew: the first load, or the lazy chunks of the analysis, the Graph tab or the Outputs tab.
 */
const BUDGET = {
  /** The page's module scripts and the island with what they import statically. */
  firstLoad: 25_000,
  /** `@dta/core`, `@dta/figma`, `@dta/lint`, zod: idle after the first render, or on input. */
  analysis: 40_000,
  /** The Graph tab (graph-engine). */
  graph: 10_000,
  /** The Outputs tab: its UI and `@dta/build` with Style Dictionary and the zip code. */
  outputs: 610_000,
}
/** A string each heavy package's code contains, to find it in a chunk (TICKET-124). */
const MARKERS: Record<string, string> = {
  '@dta/core': 'Invalid color format',
  '@dta/figma': 'Could not recognise the export format',
  '@dta/lint': 'is a Figma default',
  zod: 'ZodError',
  'style-dictionary': 'style-dictionary',
}
/** The analysis chunk has arrived (its request is complete). */
const ANALYSIS_LOADED = `performance.getEntriesByType('resource').some((e) => /\\/_astro\\/analyse\\.[\\w-]+\\.js$/.test(e.name))`

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

/**
 * The playground's first load, from the built page: its module scripts and the island's
 * component and renderer, with every chunk they import statically (not `import()`).
 */
function firstLoad(): string[] {
  const html = fs.readFileSync(path.join(dist, 'playground', 'index.html'), 'utf8')
  const roots = [
    ...[...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/(?:component|renderer)-url="([^"]+)"/g)].map((m) => m[1]),
  ]
  const seen = new Set<string>()
  const visit = (url: string) => {
    if (seen.has(url)) return
    seen.add(url)
    const code = fs.readFileSync(path.join(dist, url), 'utf8')
    for (const m of code.matchAll(/(?:from|import)\s*"(\.\/[^"]+\.js)"/g))
      visit(path.posix.join(path.posix.dirname(url), m[1]))
  }
  roots.forEach(visit)
  return [...seen]
}

const gzipOf = (urls: readonly string[]) =>
  urls.reduce(
    (sum, url) =>
      sum + zlib.gzipSync(fs.readFileSync(path.join(dist, new URL(url, origin).pathname))).length,
    0,
  )
const contains = (urls: readonly string[], text: string) =>
  urls.some((url) =>
    fs.readFileSync(path.join(dist, new URL(url, origin).pathname), 'utf8').includes(text),
  )

/**
 * The playground, loaded and with its analysis chunk fetched (the browser was idle), so a test's
 * own requests start after it. `loaded`: every request after the page's HTML, kept up to date.
 */
async function open(width: number, theme: 'light' | 'dark') {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: theme,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors: string[] = []
  const loaded: string[] = []
  page.on('pageerror', (error: Error) => errors.push(error.message))
  page.on('request', (request: { url(): string; resourceType(): string }) => {
    // The page itself and the tab icon (see the first flow test) are not what is counted.
    if (request.resourceType() === 'document') return
    if (new URL(request.url()).pathname !== '/favicon.svg') loaded.push(request.url())
  })
  const response = await page.goto(`${origin}/playground/`, { waitUntil: 'networkidle' })
  expect(response?.ok()).toBe(true)
  await page.waitForFunction(ANALYSIS_LOADED)
  await page.evaluate('document.fonts.ready.then(() => true)')
  return { context, page, errors, loaded }
}

/**
 * The playground with its analysis chunks (the module and its facade) held back until
 * `release()` (TICKET-124: input that arrives before them). `requests()`: how often each was
 * requested, the most.
 */
async function openHeld(width: number, theme: 'light' | 'dark', hash = '') {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: theme,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error: Error) => errors.push(error.message))
  let release = () => {}
  const released = new Promise<void>((resolve) => (release = resolve))
  const analysisRequests = new Map<string, number>()
  await page.route(
    /\/_astro\/analyse\.[\w-]+\.js$/,
    async (route: { continue(): Promise<void>; request(): { url(): string } }) => {
      const url = route.request().url()
      analysisRequests.set(url, (analysisRequests.get(url) ?? 0) + 1)
      await released
      await route.continue()
    },
  )
  const response = await page.goto(`${origin}/playground/${hash}`, { waitUntil: 'load' })
  expect(response?.ok()).toBe(true)
  await page.locator('astro-island:not([ssr])').waitFor({ state: 'attached' })
  await page.evaluate('document.fonts.ready.then(() => true)')
  const requests = () => Math.max(0, ...analysisRequests.values())
  return { context, page, errors, release, requests }
}

/**
 * Elements that reach past the viewport's right edge (what would scroll sideways), unless an
 * ancestor inside the viewport clips them (overflow other than visible). The body itself hides
 * horizontal overflow, so the page's scroll width alone would not tell.
 */
interface Segments {
  /** Words (between spaces and hyphens) that run over more than one line inside a segment. */
  broken: string[]
  /** Paths that wrap: a line ends after a separator inside a run of text without spaces. */
  paths: number
}
/**
 * Every word of the element's visible text (split at spaces and after hyphens) inside one text
 * node: the components cut paths into text nodes at their breaks (a <wbr> after each `/` or
 * `.`), so a word that covers more than one line has broken inside a segment.
 */
const SEGMENTS = (root: Element) => {
  const broken: string[] = []
  let paths = 0
  const lineOf = (range: Range) =>
    [...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let last: { node: Text; top: number } | undefined
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    for (const match of node.data.matchAll(/[^\s-]+-?/g)) {
      const at = match.index ?? 0
      const range = document.createRange()
      range.setStart(node, at)
      range.setEnd(node, at + match[0].length)
      const tops = new Set(lineOf(range))
      if (tops.size > 1) broken.push(match[0])
      if (tops.size === 0) continue
      const top = Math.min(...tops)
      // A text node that starts its word right after a <wbr> on a new line: a path wrapped there
      if (
        at === 0 &&
        last &&
        last.top < top &&
        node.previousSibling?.nodeName === 'WBR' &&
        !/\s$/.test(last.node.data)
      )
        paths++
      last = { node, top: Math.max(...tops) }
    }
  }
  return { broken, paths }
}

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
    const { context, page, errors, loaded } = await open(1280, 'light')
    try {
      // After the first load only the analysis's lazy chunks, fetched while the browser was idle
      // (TICKET-124): same origin, built JS, carrying @dta/core, @dta/figma, @dta/lint and zod.
      const first = new Set(firstLoad())
      const lazy = loaded.filter((url) => url.endsWith('.js') && !first.has(new URL(url).pathname))
      expect(lazy.length).toBeGreaterThan(0)
      for (const url of lazy) {
        expect(url.startsWith(`${origin}/_astro/`) && url.endsWith('.js'), url).toBe(true)
      }
      for (const name of ['@dta/core', '@dta/figma', '@dta/lint', 'zod'])
        expect(contains(lazy, MARKERS[name]), name).toBe(true)
      expect(contains(lazy, MARKERS['style-dictionary'])).toBe(false)
      // The rest of what loaded is the page's own: its first-load scripts, styles and fonts.
      for (const url of loaded.filter((u) => !lazy.includes(u))) {
        const { pathname } = new URL(url)
        expect(url.startsWith(origin), url).toBe(true)
        if (pathname.endsWith('.js')) expect(first.has(pathname), pathname).toBe(true)
      }
      const lazyCount = lazy.length
      const loadedCount = loaded.length

      // From here on nothing more is fetched: everything below runs on what is loaded.
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
      ).toEqual([
        '3 collections',
        '2 brands',
        '3 breakpoints',
        '42 tokens',
        '0 lint findings',
        'build outputs',
      ])
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

      // An export in no known format: the CLI's line, but the docs pointer is a link to the
      // website's page, not the repository path the CLI prints (TICKET-114)
      await page.getByRole('button', { name: 'Paste JSON instead' }).click()
      await page.getByLabel('Paste JSON').fill('{"Colors": "not tokens"}')
      await page.getByRole('button', { name: 'Check pasted JSON' }).click()
      await input.getByText('[unknown-format]').waitFor()
      expect(await input.locator('.dta-findings__line').textContent()).toBe(
        "error [unknown-format] Could not recognise the export format. Supported: tokenhaus, and DTA's own per-mode files. See the Token files reference.",
      )
      const docs = input.getByRole('link', { name: 'Token files reference' })
      expect(await docs.getAttribute('href')).toBe('/reference/token-files/')
      expect(await input.textContent()).not.toContain('docs/token-files')

      expect(requests, 'no request after load').toEqual([])
      expect(loaded.length, `only the ${lazyCount} lazy chunks of the analysis`).toBe(loadedCount)
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
      expect(await selected()).toMatch(/^Outputs/)
      await page.getByRole('heading', { name: 'Take it to the CLI' }).waitFor()
      await page.keyboard.press('ArrowRight')
      expect(await selected()).toBe('Structure')
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('Home')
      expect(await selected()).toBe('Structure')
      await page.keyboard.press('ArrowLeft')
      // The count joins the tab once the outputs are built (the engine loaded on the first visit)
      await expect.poll(selected).toBe('Outputs · 11')
      expect(new URL(page.url()).hash).toBe('#outputs')

      // A reload (or a shared link) keeps the view
      await page.goto('about:blank')
      await page.goto(`${origin}/playground/#graph`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Load example' }).click()
      expect(await selected()).toBe('Graph')
      await page.getByRole('group', { name: 'Dependency graph, BrandA · Desktop' }).waitFor()
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
    [1280, false],
    [390, true],
  ] as const)(
    'at %i px the example with problems shows a finding per default rule, and the panel steps through them (modal: %s)',
    async (width, modal) => {
      const { context, page, errors } = await open(width, 'light')
      try {
        const requests: string[] = []
        page.on('request', (request: { url(): string }) => {
          // The tab icon: see the first flow test.
          if (new URL(request.url()).pathname !== '/favicon.svg') requests.push(request.url())
        })
        // Both examples sit under the drop area, each with what it loads
        const button = page.getByRole('button', { name: 'Example with problems' })
        expect(await button.getAttribute('aria-describedby')).toBe('pg-example-brand-ab-problems')
        expect(await page.locator('#pg-example-brand-ab-problems').textContent()).toBe(
          'brand-ab with a broken alias, a circular alias and a default mode name',
        )
        await button.click()
        await page.getByRole('table', { name: 'Structure' }).waitFor()
        expect(await page.getByRole('status').first().textContent()).toMatch(
          /^Loaded brand-ab-problems example 6 files: Brand\(Alias\)\.BrandA\.json/,
        )
        expect(
          await page.getByRole('list', { name: 'Summary' }).getByRole('listitem').allTextContents(),
        ).toEqual([
          '3 collections',
          '2 brands',
          '3 breakpoints',
          '42 tokens',
          '3 errors',
          'build outputs',
        ])
        await page.getByRole('button', { name: '3 errors' }).click()
        expect(await page.getByRole('tab', { selected: true }).textContent()).toBe('Lint · 3')
        expect(await page.locator('.dta-findings__summary').textContent()).toBe(
          '3 errors found. Lint failed.',
        )
        expect(await page.locator('.dta-findings__rule-row').allTextContents()).toEqual([
          'no-dangling-aliases1 error',
          'no-circular-aliases1 error',
          'no-default-mode-names1 error',
        ])

        // The first finding opens the panel: 1 of 3
        await page.locator('summary', { hasText: 'no-dangling-aliases' }).click()
        await page.locator('#pg-finding-0-0').click()
        const panel = page.getByRole('dialog')
        await panel.waitFor()
        expect(await panel.evaluate((el: Element) => el.matches(':modal'))).toBe(modal)
        expect(await panel.locator('.dta-detail__kicker').textContent()).toBe(
          'error · no-dangling-aliases',
        )
        expect(await panel.locator('.dta-detail__title').textContent()).toBe('Colors.Brand.Accent')
        expect(await panel.locator('.dta-detail__position').textContent()).toBe('1 of 3')

        // "Next finding": the next rule's finding, its rule opens, focus stays on the button
        const next = panel.getByRole('button', { name: 'Next finding' })
        await next.click()
        expect(await panel.locator('.dta-detail__kicker').textContent()).toBe(
          'error · no-circular-aliases',
        )
        expect(await panel.locator('.dta-detail__title').textContent()).toBe('Colors.Surface.Muted')
        expect(await panel.locator('.dta-detail__position').textContent()).toBe('2 of 3')
        expect(await panel.locator('.dta-detail__message').textContent()).toMatch(
          /^error Circular alias chain: /,
        )
        expect(await panel.getByRole('status').textContent()).toBe('2 of 3: Colors.Surface.Muted')
        expect(await page.evaluate('document.activeElement?.textContent')).toBe('Next finding')
        // The rule opens and the row is marked after the next render: wait for it
        await expect
          .poll(() =>
            page
              .locator('details', { hasText: 'no-circular-aliases' })
              .evaluate((el: Element) => (el as HTMLDetailsElement).open),
          )
          .toBe(true)
        await expect
          .poll(() =>
            page
              .locator('#pg-finding-1-0')
              .evaluate((el: Element) => el.closest('li')?.getAttribute('aria-current')),
          )
          .toBe('true')

        // By keyboard to the third, then round to the first
        await page.keyboard.press('Enter')
        expect(await panel.locator('.dta-detail__title').textContent()).toBe(
          'Primitives.Mode 1.json',
        )
        expect(await panel.locator('.dta-detail__position').textContent()).toBe('3 of 3')
        await page.keyboard.press('Enter')
        expect(await panel.locator('.dta-detail__position').textContent()).toBe('1 of 3')
        await page.keyboard.press('Enter')
        await panel.locator('.dta-detail__position', { hasText: '2 of 3' }).waitFor()

        // Closing returns focus to the row of the finding shown last
        await page.keyboard.press('Escape')
        await expect.poll(() => panel.isVisible()).toBe(false)
        await expect.poll(() => page.evaluate('document.activeElement?.id')).toBe('pg-finding-1-0')

        expect(requests).toEqual([])
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
        // The example with problems: every rule open, a finding stepped to (TICKET-113)
        await page.goto('about:blank')
        await page.goto(`${origin}/playground/#lint`, { waitUntil: 'networkidle' })
        await page.getByRole('button', { name: 'Example with problems' }).click()
        for (const rule of await page.locator('summary').all()) await rule.click()
        expect(await page.evaluate(OVERFLOW), 'problems, rules open').toEqual([])
        await page.locator('#pg-finding-0-0').click()
        await page.getByRole('button', { name: 'Next finding' }).click()
        await page.locator('.dta-detail__position', { hasText: '2 of 3' }).waitFor()
        expect(await page.evaluate(OVERFLOW), 'next finding').toEqual([])
        await page.getByRole('button', { name: 'Close details' }).click()
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

  it.each([1280, 390] as const)(
    'at %i px the Outputs tab shows the build errors of the example with problems, and no files (TICKET-119)',
    async (width) => {
      const { context, page, errors } = await open(width, 'light')
      try {
        await page.getByRole('button', { name: 'Example with problems' }).click()
        await page.getByRole('table', { name: 'Structure' }).waitFor()
        await page.getByRole('button', { name: 'build outputs' }).click()
        const build = page.locator('.dta-findings', {
          has: page.getByRole('heading', { name: 'Build', level: 3 }),
        })
        await build.waitFor()
        expect(await page.getByRole('tab', { selected: true }).textContent()).toBe('Outputs · 0')
        expect(
          await page.getByRole('list', { name: 'Summary' }).getByRole('listitem').allTextContents(),
        ).toContain('build failed')
        expect(await build.locator('.dta-findings__summary').textContent()).toBe(
          'The build has errors: dta build writes no files until they are fixed.',
        )
        expect(await build.locator('.dta-findings__summary').getAttribute('data-outcome')).toBe(
          'failed',
        )
        // The lines dta build prints, with the website's link instead of the repository path
        expect(await build.locator('.dta-findings__line').allTextContents()).toEqual([
          'error [dangling-alias] Alias {Colors.Foundation.Sky.550} references non-existent token "Colors.Foundation.Sky.550". (Brand(Alias).BrandB.json) See the Lint rules reference.',
          'error [circular-alias] Circular alias chain: Brand(Alias).BrandA/Colors/Surface/Muted → Brand(Alias).BrandA/Colors/Text/Muted → Brand(Alias).BrandA/Colors/Surface/Muted. (Brand(Alias).BrandA.json) See the Lint rules reference.',
        ])
        const links = build.getByRole('link', { name: 'Lint rules reference' })
        expect(await links.count()).toBe(2)
        expect(await links.first().getAttribute('href')).toBe('/reference/lint-rules/')
        // No files and nothing to download: dta build writes none either
        expect(await page.locator('.dta-outputs__file').count()).toBe(0)
        expect(await page.getByRole('button', { name: 'Download all (.zip)' }).count()).toBe(0)
        expect(await page.evaluate(OVERFLOW), 'build errors').toEqual([])
        expect(errors).toEqual([])
      } finally {
        await context.close()
      }
    },
    60_000,
  )

  it.each([1280, 390] as const)(
    'at %i px token paths break between their segments, never inside one (TICKET-121)',
    async (width) => {
      const { context, page, errors } = await open(width, 'light')
      try {
        await page.getByRole('button', { name: 'Example with problems' }).click()
        await page.getByRole('table', { name: 'Structure' }).waitFor()

        // The status banner: the build's circular alias names Brand(Alias).BrandA/Colors/Surface/Muted
        await page.getByRole('button', { name: 'build outputs' }).click()
        const banner = page.locator('.dta-findings--banner', {
          has: page.getByRole('heading', { name: 'Build', level: 3 }),
        })
        await banner.waitFor()
        const inBanner = (await banner.evaluate(SEGMENTS)) as Segments
        expect(inBanner.broken, 'banner').toEqual([])
        // Beside the side panel (the config's preview) the banner is narrower on a wide screen too
        await page.getByRole('button', { name: 'dta.config.ts', exact: true }).click()
        await page.getByRole('dialog', { name: 'dta.config.ts' }).waitFor()
        const beside = (await banner.evaluate(SEGMENTS)) as Segments
        expect(beside.broken, 'banner beside the panel').toEqual([])
        // Whether it wraps there at 1280 depends on font metrics (it did locally, not in CI), so
        // the non-vacuous check is made where it always wraps: the phone.
        if (width === 390) expect(beside.paths, 'the banner wraps a long path').toBeGreaterThan(0)
        await page.getByRole('button', { name: 'Close details' }).click()

        // The lint panel: every rule open, every line and its file
        await page.getByRole('tab', { name: /^Lint/ }).click()
        for (const rule of await page.locator('summary').all()) await rule.click()
        const lint = (await page.locator('.dta-findings').evaluate(SEGMENTS)) as Segments
        expect(lint.broken, 'lint panel').toEqual([])

        // The detail panel of the circular alias: title, message and the alias chain
        await page.locator('#pg-finding-1-0').click()
        const panel = page.getByRole('dialog')
        await panel.waitFor()
        expect(await panel.locator('.dta-detail__title').textContent()).toBe('Colors.Surface.Muted')
        const detail = (await panel.evaluate(SEGMENTS)) as Segments
        expect(detail.broken, 'detail panel').toEqual([])
        expect(detail.paths, 'the panel wraps a long path').toBeGreaterThan(0)
        expect(errors).toEqual([])
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

  it('builds the outputs when the tab opens: the same files as dta build, copy, downloads and zips, only the lazy chunks requested', async () => {
    const { context, page, errors } = await open(1280, 'light')
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin })
      const requests: string[] = []
      page.on('request', (request: { url(): string }) => {
        const url = new URL(request.url())
        // Downloads are blob: URLs made in the page; the tab icon: see the test above.
        if (url.protocol === 'blob:' || url.pathname === '/favicon.svg') return
        requests.push(request.url())
      })
      await page.getByRole('button', { name: 'Load example' }).click()
      await page.getByRole('table', { name: 'Structure' }).waitFor()
      expect(requests, 'nothing before the Outputs view opens').toEqual([])

      // The summary offers to build; that opens the Outputs tab, which loads @dta/build
      await page.getByRole('button', { name: 'build outputs' }).click()
      await page.getByRole('button', { name: '11 output files' }).waitFor()
      expect(await page.getByRole('tab', { selected: true }).textContent()).toBe('Outputs · 11')
      // Only the page's own lazy chunks: same origin, built JS, among them Style Dictionary.
      expect(requests.length).toBeGreaterThan(0)
      for (const url of requests) {
        expect(url.startsWith(`${origin}/_astro/`) && url.endsWith('.js'), url).toBe(true)
      }
      const lazy = requests.map((url) => fs.readFileSync(path.join(dist, new URL(url).pathname)))
      expect(lazy.some((bytes) => bytes.includes('style-dictionary'))).toBe(true)
      // The Outputs tab's own budget: its UI and the build engine (TICKET-124).
      const outputsGzip = gzipOf(requests)
      console.log(`lazy outputs: ${requests.length} files, ${outputsGzip} B gzip`)
      expect(outputsGzip).toBeLessThanOrEqual(BUDGET.outputs)
      const lazyCount = requests.length

      // The files, grouped, equal the CLI's reference snapshot of `dta build`
      const expected = snapshotFiles()
      expect(await page.locator('.dta-outputs__name').allTextContents()).toEqual([
        'CSS',
        'Tailwind',
        'JS',
      ])
      expect((await page.locator('.dta-outputs__path').allTextContents()).sort()).toEqual(
        Object.keys(expected).sort(),
      )
      // The Tailwind group says which file is v4 and which v3; CSS and JS rows say nothing more
      const tagged = (await page
        .locator('.dta-outputs__file')
        .evaluateAll((rows: Element[]) =>
          rows.map((row) => [
            row.querySelector('.dta-outputs__path')?.textContent,
            row.querySelector('.dta-outputs__tag')?.textContent ?? null,
          ]),
        )) as Array<[string, string | null]>
      for (const [file, tag] of tagged) {
        expect(tag, file).toBe(
          file.endsWith('/tailwind.css')
            ? 'Tailwind v4'
            : file.endsWith('/tailwind.tokens.ts')
              ? 'Tailwind v3'
              : null,
        )
      }

      // A file's preview in the side panel shows the whole file
      await page.getByRole('button', { name: 'output/css/themes/branda.css', exact: true }).click()
      const panel = page.getByRole('dialog', { name: 'output/css/themes/branda.css' })
      await panel.waitFor()
      expect(await panel.locator('.dta-detail__kicker').textContent()).toBe('Output · CSS · 743 B')
      expect(await panel.getByRole('region', { name: /^Preview of/ }).textContent()).toBe(
        expected['output/css/themes/branda.css'],
      )
      await page.keyboard.press('Escape')

      // Copy puts the file on the clipboard and says so
      const copy = page.getByRole('button', { name: 'Copy output/css/base.css' })
      await copy.click()
      await expect.poll(() => copy.getAttribute('data-state')).toBe('copied')
      expect(await page.evaluate('navigator.clipboard.readText()')).toBe(
        expected['output/css/base.css'],
      )

      const download = async (name: string | RegExp) => {
        const [file] = await Promise.all([
          page.waitForEvent('download'),
          page.getByRole('button', { name, exact: typeof name === 'string' }).click(),
        ])
        const bytes = fs.readFileSync(await file.path())
        return { name: file.suggestedFilename() as string, bytes }
      }
      const unzip = (bytes: Buffer) =>
        Object.fromEntries(
          Object.entries(unzipSync(new Uint8Array(bytes))).map(([name, data]) => [
            name,
            strFromU8(data),
          ]),
        )

      // One file, one group, everything
      const single = await download('Download output/tailwind/branda/tailwind.tokens.ts')
      expect(single.name).toBe('tailwind.tokens.ts')
      expect(single.bytes.toString('utf8')).toBe(
        expected['output/tailwind/branda/tailwind.tokens.ts'],
      )
      const css = await download('Download CSS (.zip)')
      expect(css.name).toBe('dta-css.zip')
      expect(unzip(css.bytes)).toEqual(
        Object.fromEntries(Object.entries(expected).filter(([p]) => p.startsWith('output/css/'))),
      )
      const all = await download('Download all (.zip)')
      expect(all.name).toBe('dta-outputs.zip')
      const everything = unzip(all.bytes)
      const config = everything['dta.config.ts']
      expect(config).toContain("brands: ['BrandA', 'BrandB']")
      expect(config).toContain("formats: ['css', 'tailwind-v4', 'tailwind-v3', 'js']")
      delete everything['dta.config.ts']
      expect(everything).toEqual(expected)
      const configFile = await download('Download dta.config.ts')
      expect(configFile.name).toBe('dta.config.ts')
      expect(configFile.bytes.toString('utf8')).toBe(config)

      // The command to run, never `npx dta`; the page says the package is not on npm yet
      expect(await page.locator('.dta-cli .dta-command__text').allTextContents()).toEqual([
        'npx design-token-authority build',
      ])
      expect(await page.locator('.dta-cli__note').textContent()).toMatch(/not on npm yet/)

      // Fewer outputs: the files, the count, the zip and the config follow
      await page.getByRole('checkbox', { name: 'CSS' }).uncheck()
      await page.getByRole('button', { name: '7 output files' }).waitFor()
      expect(await page.locator('.dta-outputs__name').allTextContents()).toEqual(['Tailwind', 'JS'])
      const fewer = unzip((await download('Download all (.zip)')).bytes)
      expect(fewer['dta.config.ts']).toContain("formats: ['tailwind-v4', 'tailwind-v3', 'js']")
      expect(Object.keys(fewer).filter((p) => p.startsWith('output/css/'))).toEqual([])
      expect(Object.keys(fewer).length).toBe(8)

      expect(requests.length, 'no request after the lazy chunks').toBe(lazyCount)
      expect(errors).toEqual([])
    } finally {
      await context.close()
    }
  }, 90_000)

  it.each([
    [390, 'light'],
    [1280, 'dark'],
  ] as const)(
    'at %i px in %s the Outputs view shifts nothing while it builds and has nothing wider than the screen',
    async (width, theme) => {
      const { context, page } = await open(width, theme)
      try {
        await page.getByRole('button', { name: 'Load example' }).click()
        await page.getByRole('table', { name: 'Structure' }).waitFor()
        await page.evaluate(`window.__shift = 0; new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shift += entry.value
        }).observe({ type: 'layout-shift' })`)
        await page.getByRole('tab', { name: /^Outputs/ }).click()
        await page.locator('.dta-outputs').waitFor()
        await page.waitForTimeout(300)
        expect(await page.evaluate('window.__shift')).toBe(0)
        expect(await page.evaluate(OVERFLOW), 'outputs').toEqual([])
        await page
          .getByRole('button', { name: 'output/tailwind/branda/tailwind.tokens.ts', exact: true })
          .click()
        await page.getByRole('dialog').waitFor()
        expect(await page.evaluate(OVERFLOW), 'preview').toEqual([])
        // The preview keeps every line whole (`var(--…)` never breaks) and scrolls inside its
        // own box (TICKET-114): a theme file has the longest lines.
        await page.getByRole('button', { name: 'Close details' }).click()
        await page
          .getByRole('button', { name: 'output/css/themes/branda.css', exact: true })
          .click()
        await page.getByRole('dialog').waitFor()
        expect(await page.evaluate(OVERFLOW), 'long lines').toEqual([])
        const code = page.getByRole('region', { name: /^Preview of/ })
        const box = (await code.evaluate((el: Element) => ({
          whiteSpace: getComputedStyle(el).whiteSpace,
          overflowX: getComputedStyle(el).overflowX,
          wider: el.scrollWidth > el.clientWidth,
          right: el.getBoundingClientRect().right,
          lineHeight: parseFloat(getComputedStyle(el).lineHeight),
          lines: (el.textContent ?? '').split('\n').length,
          height: el.scrollHeight,
        }))) as Record<string, number | string | boolean>
        expect(box.whiteSpace).toBe('pre')
        expect(box.overflowX).toBe('auto')
        expect(box.right as number).toBeLessThanOrEqual(width)
        // no line wraps: the content is as tall as its lines (plus the box's padding)
        expect(box.height as number).toBeLessThan(
          ((box.lines as number) + 2) * (box.lineHeight as number),
        )
        if (width < 1024) expect(box.wider).toBe(true)
        await page.getByRole('button', { name: 'Close details' }).click()
        await page.getByRole('button', { name: 'dta.config.ts', exact: true }).click()
        await page.getByRole('dialog', { name: 'dta.config.ts' }).waitFor()
        expect(await page.evaluate(OVERFLOW), 'config preview').toEqual([])
      } finally {
        await context.close()
      }
    },
    60_000,
  )

  /** The example with problems, on the Graph view (its chunk loaded). */
  async function problemsGraph(page: any, width: number) {
    await page.getByRole('button', { name: 'Example with problems' }).click()
    await page.getByRole('table', { name: 'Structure' }).waitFor()
    await page.getByRole('tab', { name: 'Graph' }).click()
    await page.locator(width < 761 ? '.dta-graph-list' : '.dta-graph').waitFor()
  }
  const hashOf = (page: any) => decodeURI(new URL(page.url()).hash)

  it('selects a token on the graph: its chain, its readings, Show BrandB, Show in lint and Show in graph back, with the hash', async () => {
    const { context, page, errors } = await open(1280, 'light')
    try {
      const requests: string[] = []
      page.on('request', (request: { url(): string }) => {
        if (new URL(request.url()).pathname !== '/favicon.svg') requests.push(request.url())
      })
      await problemsGraph(page, 1280)
      // Only the graph's own lazy chunks were fetched for the view: not the outputs' engine (Style
      // Dictionary), and small (its names in code come from @dta/build's pure helpers).
      expect(requests.length).toBeGreaterThan(0)
      for (const url of requests) expect(url.startsWith(`${origin}/_astro/`), url).toBe(true)
      expect(requests.some((url) => url.includes('outputs-engine'))).toBe(false)
      // The Graph tab's own budget (TICKET-124).
      const graphGzip = gzipOf(requests)
      console.log(`lazy graph: ${requests.length} files, ${graphGzip} B gzip`)
      expect(graphGzip).toBeLessThanOrEqual(BUDGET.graph)
      expect(hashOf(page)).toBe('#graph')

      // Three layer columns in the modes shown; the switcher says what is in view
      const graph = page.getByRole('group', { name: 'Dependency graph, BrandA · Desktop' })
      expect(await page.locator('.dta-graph__kicker').allTextContents()).toEqual([
        'Primitives',
        'Brand(Alias)',
        'ScreenType',
      ])
      expect(await page.locator('.dta-graph__layer').allTextContents()).toEqual([
        'Mode 1 26 tokens',
        'BrandA 11 tokens',
        'Desktop 5 tokens',
      ])
      const brand = page.getByRole('group', { name: 'Brand' })
      expect(await brand.getByRole('button', { pressed: true }).textContent()).toBe('BrandA1 error')
      expect(await page.locator('.dta-switcher__note').first().textContent()).toMatch(
        /^42 tokens in BrandA · Desktop, 16 aliases; 2 of 3 errors are in this view\./,
      )
      // Findings: the circular pair as errors with two arcs and a chip; the file finding on its header
      expect(
        await graph
          .getByRole('button', { name: /^Colors\.Surface\.Muted error/ })
          .getAttribute('data-severity'),
      ).toBe('error')
      expect(
        await page.locator('.dta-graph__edges .dta-graph__edge[data-kind="circular"]').count(),
      ).toBe(2)
      expect(await page.locator('.dta-graph__chip').textContent()).toBe('circular')
      expect(await page.locator('.dta-graph__finding').textContent()).toBe(
        'error · default mode name',
      )

      // Selecting a token: the side panel with every brand, the chain highlighted, the hash
      const accent = graph.getByRole('button', { name: /^Colors\.Brand\.Accent / })
      const box = await page.locator('.dta-graph').boundingBox()
      await accent.click()
      const panel = page.getByRole('dialog', { name: 'Colors.Brand.Accent' })
      await panel.waitFor()
      expect(await panel.evaluate((el: Element) => el.matches(':modal'))).toBe(false)
      // The graph stays where it was behind the panel.
      expect(await page.locator('.dta-graph').boundingBox()).toEqual(
        expect.objectContaining({ x: box.x, y: box.y }),
      )
      expect(await accent.getAttribute('aria-current')).toBe('true')
      expect(
        await graph
          .getByRole('button', { name: /^Colors\.Foundation\.Sky\.500 / })
          .getAttribute('data-chain'),
      ).toBe('')
      expect(await page.locator('.dta-graph__edges .dta-graph__edge[data-chain]').count()).toBe(1)
      expect(hashOf(page)).toBe('#graph/Brand(Alias).BrandA/Colors/Brand/Accent')
      expect(await panel.locator('.dta-detail__kicker').first().textContent()).toBe(
        'Token · color · Brand(Alias)',
      )
      expect(await panel.locator('.dta-detail__line').allTextContents()).toEqual([
        'BrandA · in view#3b8fd9  Colors.Brand.Accent → Colors.Foundation.Sky.500',
        'BrandBunresolved: "Colors.Brand.Accent" aliases "Colors.Foundation.Sky.550", which does not exist.',
      ])
      expect(await panel.locator('.dta-detail__fact').allTextContents()).toEqual([
        'CSSvar(--colors-brand-accent)',
        'Tailwind--color-brand-accent',
      ])
      expect(await panel.locator('.dta-detail__note .dta-detail__kicker').textContent()).toBe(
        'error · no-dangling-aliases · BrandB',
      )

      // "Show BrandB": the graph switches, the token follows, the dangling arrow ends in a missing row
      await panel.getByRole('button', { name: 'Show BrandB' }).click()
      await page.getByRole('group', { name: 'Dependency graph, BrandB · Desktop' }).waitFor()
      expect(hashOf(page)).toBe('#graph/Brand(Alias).BrandB/Colors/Brand/Accent')
      expect(await brand.getByRole('button', { pressed: true }).textContent()).toBe('BrandB1 error')
      const missing = page.getByRole('img', { name: /^Colors\.Foundation\.Sky\.550 missing/ })
      expect(await missing.getAttribute('data-chain')).toBe('')
      expect(
        await page.locator('.dta-graph__edges .dta-graph__edge[data-kind="dangling"]').count(),
      ).toBe(1)
      expect(
        await page
          .getByRole('button', { name: /^Colors\.Brand\.Accent error/ })
          .getAttribute('aria-current'),
      ).toBe('true')
      expect(await panel.locator('.dta-detail__tag').textContent()).toBe(' · in view')
      expect(
        await panel
          .locator('.dta-detail__line', { hasText: 'BrandB' })
          .locator('.dta-detail__tag')
          .count(),
      ).toBe(1)

      // "Show in lint": the Lint view with that finding open
      await panel.getByRole('button', { name: 'Show in lint' }).click()
      await expect
        .poll(() => page.getByRole('tab', { selected: true }).textContent())
        .toBe('Lint · 3')
      expect(hashOf(page)).toBe('#lint')
      const finding = page.getByRole('dialog')
      await expect
        .poll(() => finding.locator('.dta-detail__kicker').first().textContent())
        .toBe('error · no-dangling-aliases')
      await expect
        .poll(() =>
          page
            .locator('#pg-finding-0-0')
            .evaluate((el: Element) => el.closest('li')?.getAttribute('aria-current')),
        )
        .toBe('true')

      // ...and "Show in graph" back: BrandB, the token selected and in view
      await finding.getByRole('button', { name: 'Show in graph' }).click()
      await page.getByRole('group', { name: 'Dependency graph, BrandB · Desktop' }).waitFor()
      expect(await page.getByRole('tab', { selected: true }).textContent()).toBe('Graph')
      expect(hashOf(page)).toBe('#graph/Brand(Alias).BrandB/Colors/Brand/Accent')
      const row = page.getByRole('button', { name: /^Colors\.Brand\.Accent error/ })
      await expect.poll(() => row.getAttribute('aria-current')).toBe('true')
      await page.getByRole('dialog', { name: 'Colors.Brand.Accent' }).waitFor()
      await expect
        .poll(() =>
          row.evaluate((el: Element) => {
            const r = el.getBoundingClientRect()
            return r.top >= 0 && r.bottom <= window.innerHeight
          }),
        )
        .toBe(true)
      // Closing returns focus to the row; the hash keeps the view
      await page.keyboard.press('Escape')
      await expect.poll(() => page.getByRole('dialog').isVisible()).toBe(false)
      await expect
        .poll(() => page.evaluate('document.activeElement?.dataset.node'))
        .toBe('Brand(Alias).BrandB/Colors/Brand/Accent')
      expect(hashOf(page)).toBe('#graph')

      // A circular finding's "Show in graph" goes to BrandA, the circle in view
      await page.getByRole('tab', { name: /^Lint/ }).click()
      await page.locator('summary', { hasText: 'no-circular-aliases' }).click()
      await page.locator('#pg-finding-1-0').click()
      await page.getByRole('button', { name: 'Show in graph' }).click()
      await page.getByRole('group', { name: 'Dependency graph, BrandA · Desktop' }).waitFor()
      expect(hashOf(page)).toBe('#graph/Brand(Alias).BrandA/Colors/Surface/Muted')

      // A shared link opens the token once the tokens are read
      await page.goto('about:blank')
      await page.goto(
        `${origin}/playground/#graph/${encodeURI('Brand(Alias).BrandB/Colors/Brand/Accent')}`,
        {
          waitUntil: 'networkidle',
        },
      )
      await page.getByRole('button', { name: 'Example with problems' }).click()
      await page.getByRole('dialog', { name: 'Colors.Brand.Accent' }).waitFor()
      expect(await page.getByRole('tab', { selected: true }).textContent()).toBe('Graph')
      await page.getByRole('group', { name: 'Dependency graph, BrandB · Desktop' }).waitFor()
      expect(errors).toEqual([])
    } finally {
      await context.close()
    }
  }, 90_000)

  it('moves along the graph with the arrow keys and opens a token with Enter', async () => {
    const { context, page, errors } = await open(1280, 'light')
    try {
      await problemsGraph(page, 1280)
      const graph = page.getByRole('group', { name: /^Dependency graph/ })
      // One row in the tab order: the first, until another is focused or selected
      expect(await graph.locator('button[tabindex="0"]').count()).toBe(1)
      const focused = () => page.evaluate('document.activeElement?.dataset.node')
      await graph.getByRole('button', { name: /^Colors\.Brand\.Accent / }).focus()
      await page.keyboard.press('ArrowLeft')
      expect(await focused()).toBe('Primitives.Mode 1/Colors/Foundation/Sky/500')
      await page.keyboard.press('ArrowRight')
      expect(await focused()).toBe('Brand(Alias).BrandA/Colors/Brand/Accent')
      await page.keyboard.press('ArrowDown')
      expect(await focused()).toBe('Brand(Alias).BrandA/Colors/Surface/Default')
      await page.keyboard.press('ArrowUp')
      await page.keyboard.press('Home')
      expect(await focused()).toBe('Brand(Alias).BrandA/Colors/Brand/Primary')
      await page.keyboard.press('End')
      expect(await focused()).toBe('Brand(Alias).BrandA/Effects/shadow/Blur')
      // The row that has focus is the one in the tab order
      expect(await graph.locator('button[tabindex="0"]').getAttribute('data-node')).toBe(
        'Brand(Alias).BrandA/Effects/shadow/Blur',
      )
      await page.keyboard.press('ArrowLeft')
      expect(await focused()).toBe('Primitives.Mode 1/Effects/blur/md')
      await page.keyboard.press('Enter')
      const panel = page.getByRole('dialog', { name: 'Effects.blur.md' })
      await panel.waitFor()
      expect(await page.evaluate('document.activeElement?.id')).toBe('pg-detail-title')
      await page.keyboard.press('Escape')
      await expect.poll(focused).toBe('Primitives.Mode 1/Effects/blur/md')
      // The brand switch by keyboard: the segments are buttons
      await page
        .getByRole('group', { name: 'Brand' })
        .getByRole('button', { name: /^BrandB/ })
        .focus()
      await page.keyboard.press('Enter')
      await page.getByRole('group', { name: 'Dependency graph, BrandB · Desktop' }).waitFor()
      expect(errors).toEqual([])
    } finally {
      await context.close()
    }
  }, 60_000)

  it('at 390 px the graph is a list with selects; a row opens the sheet, Show in lint and Show in graph lead both ways', async () => {
    const { context, page, errors } = await open(390, 'light')
    try {
      await problemsGraph(page, 390)
      expect(await page.locator('.dta-graph').isVisible()).toBe(false)
      const list = page.getByRole('group', { name: 'Dependency graph, BrandA · Desktop' })
      expect(await list.isVisible()).toBe(true)
      // Summaries first: the brand layer open, the others closed, each with its findings
      expect(
        await page
          .locator('.dta-graph-list__layer')
          .evaluateAll((all: Element[]) => all.map((el) => (el as HTMLDetailsElement).open)),
      ).toEqual([false, true, false])
      expect(await page.locator('.dta-graph-list__status').allTextContents()).toEqual([
        '1 error',
        '1 error',
      ])
      // Native selects for brand and breakpoint
      await page.getByRole('combobox', { name: 'Brand' }).selectOption('BrandB')
      await page.getByRole('group', { name: 'Dependency graph, BrandB · Desktop' }).waitFor()
      const row = page.getByRole('button', { name: /^Colors\.Brand\.Accent/ })
      expect(await row.textContent()).toBe(
        'Colors.Brand.Accent→ Colors.Foundation.Sky.550 does not existerror',
      )
      await row.click()
      const sheet = page.getByRole('dialog', { name: 'Colors.Brand.Accent' })
      await sheet.waitFor()
      expect(await sheet.evaluate((el: Element) => el.matches(':modal'))).toBe(true)
      expect(hashOf(page)).toBe('#graph/Brand(Alias).BrandB/Colors/Brand/Accent')
      await sheet.getByRole('button', { name: 'Show in lint' }).click()
      await expect
        .poll(() => page.getByRole('tab', { selected: true }).textContent())
        .toBe('Lint · 3')
      const finding = page.getByRole('dialog')
      await expect
        .poll(() => finding.locator('.dta-detail__title').textContent())
        .toBe('Colors.Brand.Accent')
      await finding.getByRole('button', { name: 'Show in graph' }).click()
      await page.getByRole('group', { name: 'Dependency graph, BrandB · Desktop' }).waitFor()
      await expect
        .poll(() =>
          page
            .locator('.dta-graph-list__row[aria-current="true"] [data-node]')
            .getAttribute('data-node'),
        )
        .toBe('Brand(Alias).BrandB/Colors/Brand/Accent')
      await page.getByRole('dialog', { name: 'Colors.Brand.Accent' }).waitFor()
      await page.getByRole('button', { name: 'Close details' }).click()
      await expect.poll(() => page.getByRole('dialog').isVisible()).toBe(false)
      // A row in a closed layer opens it when selected from elsewhere (the circle in BrandA)
      await page.getByRole('tab', { name: /^Lint/ }).click()
      await page.locator('summary', { hasText: 'no-circular-aliases' }).click()
      await page.locator('#pg-finding-1-0').click()
      await page.getByRole('button', { name: 'Show in graph' }).click()
      await page.getByRole('group', { name: 'Dependency graph, BrandA · Desktop' }).waitFor()
      expect(await page.getByRole('combobox', { name: 'Brand' }).inputValue()).toBe('BrandA')
      expect(errors).toEqual([])
    } finally {
      await context.close()
    }
  }, 60_000)

  it.each([
    [390, 'light'],
    [390, 'dark'],
    [1280, 'light'],
    [1280, 'dark'],
  ] as const)(
    'at %i px in %s the graph shifts nothing and has nothing wider than the screen',
    async (width, theme) => {
      const { context, page } = await open(width, theme)
      try {
        await page.getByRole('button', { name: 'Example with problems' }).click()
        await page.getByRole('table', { name: 'Structure' }).waitFor()
        await page.evaluate(`window.__shift = 0; new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shift += entry.value
        }).observe({ type: 'layout-shift' })`)
        await page.getByRole('tab', { name: 'Graph' }).click()
        await page.locator(width < 761 ? '.dta-graph-list' : '.dta-graph').waitFor()
        await page.waitForTimeout(300)
        expect(await page.evaluate('window.__shift')).toBe(0)
        expect(await page.evaluate(OVERFLOW), 'graph').toEqual([])
        await page.getByRole('button', { name: /^Colors\.Brand\.Accent/ }).click()
        await page.getByRole('dialog').waitFor()
        await page.waitForTimeout(400)
        expect(await page.evaluate(OVERFLOW), 'token open').toEqual([])
        expect(await page.evaluate('window.__shift')).toBe(0)
        // Paths in the panel break between segments
        const detail = (await page.getByRole('dialog').evaluate(SEGMENTS)) as Segments
        expect(detail.broken, 'token panel').toEqual([])
        await page.getByRole('button', { name: 'Show BrandB' }).click()
        await page.getByRole('group', { name: /BrandB · Desktop$/ }).waitFor()
        await page.waitForTimeout(400)
        expect(await page.evaluate(OVERFLOW), 'BrandB').toEqual([])
        expect(await page.evaluate('window.__shift')).toBe(0)
      } finally {
        await context.close()
      }
    },
    60_000,
  )

  it('keeps the first load free of @dta/* and zod, and each part of the JavaScript within its budget', async () => {
    // The first load, from the built page (TICKET-124): no @dta/core, @dta/figma, @dta/lint, zod
    // or Style Dictionary; none of the lazy chunks.
    const first = firstLoad()
    expect(first.length).toBeGreaterThan(0)
    for (const [name, marker] of Object.entries(MARKERS))
      expect(contains(first, marker), `${name} in the first load`).toBe(false)
    for (const chunk of ['analyse', 'graph-engine', 'outputs-ui', 'outputs-engine'])
      expect(
        first.some((url) => path.basename(url).startsWith(`${chunk}.`)),
        chunk,
      ).toBe(false)
    const firstGzip = gzipOf(first)
    console.log(`playground first load: ${first.length} files, ${firstGzip} B gzip`)
    expect(firstGzip).toBeLessThanOrEqual(BUDGET.firstLoad)

    // What the browser fetches: the first load, then (idle) the analysis's chunks, nothing else.
    const { context, loaded } = await open(1280, 'light')
    try {
      const scripts = loaded.filter((url) => url.endsWith('.js'))
      for (const url of first) expect(scripts.map((u) => new URL(u).pathname)).toContain(url)
      const analysis = scripts.filter((url) => !first.includes(new URL(url).pathname))
      expect(analysis.some((url) => /\/analyse\.[\w-]+\.js$/.test(url))).toBe(true)
      for (const name of ['@dta/core', '@dta/figma', '@dta/lint', 'zod'])
        expect(contains(analysis, MARKERS[name]), name).toBe(true)
      expect(contains(analysis, MARKERS['style-dictionary'])).toBe(false)
      const analysisGzip = gzipOf(analysis)
      console.log(`lazy analysis: ${analysis.length} files, ${analysisGzip} B gzip`)
      expect(analysisGzip).toBeLessThanOrEqual(BUDGET.analysis)
    } finally {
      await context.close()
    }
  }, 60_000)

  // TICKET-124: the analysis loads when the browser is idle, or at once on input or a hash.
  it('loads the analysis when the browser is idle, and without idle time at once on input or a view in the hash', async () => {
    const analysisRequested = async (hash: string, act?: (page: any) => Promise<void>) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
      try {
        const page = await context.newPage()
        // A browser that is never idle: only input or the hash can ask for the analysis.
        await page.addInitScript(
          'window.requestIdleCallback = () => 0; window.cancelIdleCallback = () => {}',
        )
        let requested = 0
        page.on('request', (request: { url(): string }) => {
          if (/\/_astro\/analyse\.[\w-]+\.js$/.test(request.url())) requested++
        })
        await page.goto(`${origin}/playground/${hash}`, { waitUntil: 'networkidle' })
        await act?.(page)
        await page.waitForTimeout(500)
        return requested
      } finally {
        await context.close()
      }
    }
    expect(await analysisRequested(''), 'never idle, no input').toBe(0)
    expect(await analysisRequested('#lint'), 'a view in the hash').toBeGreaterThan(0)
    expect(
      await analysisRequested('', async (page) => {
        await page.getByRole('button', { name: 'Load example' }).click()
        await page.getByRole('table', { name: 'Structure' }).waitFor()
      }),
      'input',
    ).toBeGreaterThan(0)
  }, 60_000)

  it.each([
    [390, 'light'],
    [390, 'dark'],
    [1280, 'light'],
    [1280, 'dark'],
  ] as const)(
    'at %i px in %s input before the analysis shows "Reading…", shifts nothing, and is read once it arrives',
    async (width, theme) => {
      const { context, page, errors, release, requests } = await openHeld(width, theme)
      try {
        await page.evaluate(`window.__shift = 0; new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shift += entry.value
        }).observe({ type: 'layout-shift' })`)
        await page.getByRole('button', { name: 'Load example' }).click()
        // What was given, at once; the summary reads it, as a status, in words
        const summary = page.getByRole('list', { name: 'Summary' })
        await summary.waitFor()
        expect(await summary.getAttribute('aria-busy')).toBe('true')
        expect(await summary.getByRole('status').textContent()).toBe('Reading 6 files…')
        expect(await page.getByRole('status').first().textContent()).toMatch(
          /^Loaded brand-ab example 6 files: Brand\(Alias\)\.BrandA\.json/,
        )
        expect(await page.getByRole('tablist').count()).toBe(0)
        expect(await page.evaluate(OVERFLOW), 'reading').toEqual([])
        // The footer waits out of sight, so it does not jump when the views arrive
        expect(
          await page.locator('.foot').evaluate((el: Element) => getComputedStyle(el).visibility),
        ).toBe('hidden')
        const box = async () =>
          (await summary.evaluate((el: Element) => {
            const r = el.getBoundingClientRect()
            return [Math.round(r.top), Math.round(r.left)]
          })) as number[]
        const before = await box()
        // Outside the input window (500 ms), so the arrival is not excused as caused by input
        await page.waitForTimeout(700)
        release()
        await page.getByRole('table', { name: 'Structure' }).waitFor()
        await page.waitForTimeout(400)
        expect(await summary.getByRole('listitem').allTextContents()).toEqual([
          '3 collections',
          '2 brands',
          '3 breakpoints',
          '42 tokens',
          '0 lint findings',
          'build outputs',
        ])
        expect(await summary.getAttribute('aria-busy')).toBe(null)
        expect(await box()).toEqual(before)
        expect(await page.evaluate('window.__shift')).toBe(0)
        expect(await page.evaluate(OVERFLOW), 'read').toEqual([])
        expect(
          await page.locator('.foot').evaluate((el: Element) => getComputedStyle(el).visibility),
        ).toBe('visible')
        expect(requests()).toBe(1)
        expect(errors).toEqual([])
      } finally {
        release()
        await context.close()
      }
    },
    60_000,
  )

  it('reads only the last input given before the analysis, once, and follows a deep link', async () => {
    // A view in the hash: the analysis is asked for at once; the input that follows waits for it
    const held = await openHeld(1280, 'light', '#lint')
    try {
      const { page, errors, release, requests } = held
      await expect.poll(requests).toBe(1)
      await page.getByRole('button', { name: 'Load example' }).click()
      await page.getByRole('list', { name: 'Summary' }).getByRole('status').waitFor()
      // Replaced before the analysis arrived: the example with problems is what gets read
      await page.getByRole('button', { name: 'Paste JSON instead' }).click()
      await page.getByLabel('Paste JSON').fill('{"Colors": ')
      await page.getByLabel('File name').fill('Brand.BrandA.json')
      await page.getByRole('button', { name: 'Check pasted JSON' }).click()
      expect(await page.getByRole('status').first().textContent()).toMatch(
        /^Loaded Brand\.BrandA\.json 1 file/,
      )
      expect(
        await page.getByRole('list', { name: 'Summary' }).getByRole('status').textContent(),
      ).toBe('Reading 1 file…')
      release()
      await page.getByRole('heading', { name: 'Input' }).waitFor()
      expect(await page.locator('.dta-findings__line').textContent()).toMatch(
        /^error \[invalid-json\]/,
      )
      expect(await page.getByRole('list', { name: 'Summary' }).count()).toBe(0)
      expect(requests()).toBe(1)
      expect(errors).toEqual([])
    } finally {
      held.release()
      await held.context.close()
    }

    // A shared link to a token on the graph: the example chosen before the analysis opens it
    const id = 'Brand(Alias).BrandB/Colors/Brand/Accent'
    const graph = await openHeld(1280, 'light', `#graph/${encodeURI(id)}`)
    try {
      const { page, errors, release } = graph
      await page.getByRole('button', { name: 'Example with problems' }).click()
      await page.getByRole('list', { name: 'Summary' }).getByRole('status').waitFor()
      release()
      await page.getByRole('dialog', { name: 'Colors.Brand.Accent' }).waitFor()
      expect(await page.getByRole('tab', { selected: true }).textContent()).toBe('Graph')
      await page.getByRole('group', { name: 'Dependency graph, BrandB · Desktop' }).waitFor()
      expect(decodeURI(new URL(page.url()).hash)).toBe(`#graph/${id}`)
      // "Show in lint" and "Show in graph" lead both ways, as without the wait
      await page.getByRole('dialog').getByRole('button', { name: 'Show in lint' }).click()
      await expect
        .poll(() => page.getByRole('tab', { selected: true }).textContent())
        .toBe('Lint · 3')
      await page.getByRole('dialog').getByRole('button', { name: 'Show in graph' }).click()
      await page.getByRole('group', { name: 'Dependency graph, BrandB · Desktop' }).waitFor()
      expect(errors).toEqual([])
    } finally {
      graph.release()
      await graph.context.close()
    }
  }, 60_000)

  it('says so when the analysis cannot load', async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
      reducedMotion: 'reduce',
    })
    try {
      const page = await context.newPage()
      await page.route(/\/_astro\/analyse\.[\w-]+\.js$/, (route: { abort(): Promise<void> }) =>
        route.abort(),
      )
      await page.goto(`${origin}/playground/`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Load example' }).click()
      const summary = page.getByRole('list', { name: 'Summary' })
      await summary.getByText('The analysis did not load. Reload the page to try again.').waitFor()
      // The error tone: its marker shape before the words, never colour alone
      expect(await summary.locator('[data-tone="error"] .dta-summary__marker').count()).toBe(1)
      expect(await page.evaluate(OVERFLOW)).toEqual([])
    } finally {
      await context.close()
    }
  }, 60_000)
})
