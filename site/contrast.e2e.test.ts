/**
 * AAA on the rendered pages: every text node of the landing page (both themes) and of every
 * story (each renders Light and Graphite side by side) reaches 7:1 against its effective
 * background, 4.5:1 when large (24 px, or 18.66 px bold). The token test checks the pairs the
 * system names; this checks what the browser paints, nesting and opacity included.
 *
 * Needs the built site (`pnpm build` → dist/) and a browser: runs when DTA_E2E=1 (CI job
 * "site") or when DTA_BROWSER_PATH points at Chromium; otherwise skipped.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
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

async function audit(url: string, width: number, brand?: string): Promise<Failure[]> {
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
