/**
 * The site's frame and the landing page's strip on the built site (TICKET-114): the nav marks the
 * page you are on (`aria-current="page"` and a visible underline; none on the landing page, whose
 * links are sections), in the row and in the phone menu; the docs mark theirs in Starlight's
 * sidebar; the workflow's eyebrows stay on one line on a desktop screen.
 *
 * Same conditions as contrast.e2e.test.ts: needs the built site (`pnpm build` → dist/) and a
 * browser (DTA_E2E=1 in the CI job "site", or DTA_BROWSER_PATH); otherwise skipped.
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

let server: http.Server
let origin: string
let browser: { newContext(o: object): Promise<any>; close(): Promise<void> }

async function open(url: string, width: number, theme: 'light' | 'dark' = 'light') {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: theme,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const response = await page.goto(`${origin}${url}`, { waitUntil: 'networkidle' })
  expect(response?.ok(), url).toBe(true)
  await page.evaluate('document.fonts.ready.then(() => true)')
  return { context, page }
}

/** The header nav's links: label, aria-current, and the width of the underline shown at rest. */
const LINKS = `[...document.querySelectorAll('.site-header nav .links a')].map((a) => {
  const target = getComputedStyle(a).backgroundImage !== 'none' ? a : a.querySelector('.label')
  const style = getComputedStyle(target)
  const [width, height] = style.backgroundSize.split(' ')
  const visible = style.backgroundImage !== 'none' && parseFloat(width) > 0 && parseFloat(height) > 0
  return [a.querySelector('.label').textContent, a.getAttribute('aria-current'), visible]
})`

describe.skipIf(!enabled)('site frame on the built site', () => {
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

  it.each([
    ['/', 'none (its links are sections)', null],
    ['/playground/', 'Playground', 'Playground'],
  ] as const)(
    'on %s the nav marks %s as the page shown, with an underline at rest',
    async (url, _what, current) => {
      for (const theme of ['light', 'dark'] as const) {
        const { context, page } = await open(url, 1280, theme)
        try {
          const links = (await page.evaluate(LINKS)) as Array<[string, string | null, boolean]>
          expect(links.map(([label]) => label)).toEqual([
            'How it works',
            'Agents',
            'Playground',
            'Docs',
          ])
          for (const [label, aria, underline] of links) {
            expect(aria, label).toBe(label === current ? 'page' : null)
            expect(underline, `${label} underlined at rest`).toBe(label === current)
          }
        } finally {
          await context.close()
        }
      }
    },
    60_000,
  )

  it('marks the page in the phone menu too', async () => {
    const { context, page } = await open('/playground/', 390)
    try {
      await page.getByRole('button', { name: 'Menu' }).click()
      await page
        .locator('.site-header')
        .getByRole('link', { name: /Playground/ })
        .waitFor()
      const links = (await page.evaluate(LINKS)) as Array<[string, string | null, boolean]>
      expect(links.filter(([, aria]) => aria === 'page').map(([label]) => label)).toEqual([
        'Playground',
      ])
      expect(links.find(([label]) => label === 'Playground')?.[2]).toBe(true)
      expect(links.filter(([, , underline]) => underline).length).toBe(1)
    } finally {
      await context.close()
    }
  }, 60_000)

  it("the docs mark their page in Starlight's sidebar", async () => {
    const { context, page } = await open('/start/', 1280)
    try {
      expect(await page.locator('nav[aria-label="Main"] a[aria-current="page"]').count()).toBe(1)
    } finally {
      await context.close()
    }
  }, 60_000)

  it.each([1280, 1440])(
    'keeps every eyebrow of the workflow on one line at %i px, without sideways scroll',
    async (width) => {
      const { context, page } = await open('/', width)
      try {
        const lines = await page.evaluate(`(() => {
          return [...document.querySelectorAll('.dta-workflow-frame .beat .where')].map((label) => {
            const range = document.createRange()
            range.selectNodeContents(label)
            return [label.textContent, new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size]
          })
        })()`)
        expect(lines).toEqual([
          ['Where design happens', 1],
          ['In the pull request', 1],
          ['Still in the pull request', 1],
        ])
        expect(await page.evaluate('document.documentElement.scrollWidth')).toBe(width)
      } finally {
        await context.close()
      }
    },
    60_000,
  )
})
