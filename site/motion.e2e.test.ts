/**
 * Motion rules on the rendered stories: under `prefers-reduced-motion: reduce` the well, the
 * floating objects and every other story have no running animation, and the well's canvas is
 * drawn once (its loop stops). Same conditions as contrast.e2e.test.ts (built site, Chromium).
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
}

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
})
