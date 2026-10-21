/**
 * AAA on the rendered pages: every text node of the landing page and the playground (empty, the
 * paste field, after the example, the detail panel open beside the view or as the bottom sheet, a
 * lint finding open, the "Example with problems" with its rules open, an error selected
 * (TICKET-121) and a finding stepped to with "Next finding" (TICKET-113), an unknown export with
 * its docs link (TICKET-114), the build errors of the example with problems (TICKET-119), after
 * invalid input, the Outputs view, an output file's preview, a copied file, the dependency graph
 * with a token selected and with BrandB's dangling alias (TICKET-078); both themes) and of
 * every story (each renders Light and Graphite side by side) reaches 7:1 against its effective
 * background, 4.5:1 when large (24 px, or 18.66 px bold). So does the `dta diff` report for each
 * verdict (pass, review, fail; TICKET-120 status colours, review in signal since TICKET-121), its
 * story rows with "Show before" off and on (TICKET-109: outlines, leaders and notes at 3:1 by signal
 * or ink line, notes never overlapping, no layout shift when toggling).
 * Findings markers and the report's chip dots (non-text) reach 3:1 on what they are painted on, a
 * selected line's tint included; so do the graph's markers, row outlines and arrows. The token test checks the pairs
 * the system names; this checks what the browser paints, nesting and opacity included.
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
  // Findings markers (non-text, TICKET-120/121): 3:1 on their effective background, a selected
  // line's tint included. The filled square is its background, the open ring its border. The
  // graph's markers (TICKET-078: rows, chips, headers, the list, the switcher, the panel) too.
  for (const el of document.querySelectorAll('.dta-findings__marker, .dta-graph__marker, .dta-graph-list__marker, .dta-switcher__marker, .dta-detail__marker')) {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    const fill = parse(s.backgroundColor), ring = parse(s.borderTopColor)
    const raw = fill[3] > 0 ? fill : parseFloat(s.borderTopWidth) > 0 && ring[3] > 0 ? ring : null
    if (!raw) continue
    const bg = bgOf(el.parentElement)
    const fg = over([raw[0], raw[1], raw[2], raw[3] * opacityOf(el)], bg)
    const r = ratio(fg, bg)
    if (r >= 3) continue
    const key = ['marker', fill[3] > 0 ? s.backgroundColor : s.borderTopColor, bg.map(Math.round).join(',')].join('|')
    if (seen.has(key)) continue
    seen.set(key, { text: '(marker)', element: 'span.dta-findings__marker', fg: fill[3] > 0 ? s.backgroundColor : s.borderTopColor, bg: 'rgb(' + bg.map(Math.round).join(', ') + ')', size: rect.width, weight: 0, ratio: Math.round(r * 100) / 100 })
  }
  // The dependency graph (non-text, TICKET-078): every row's outline on what is around it, and
  // every arrow (line and head) on the canvas, 3:1 (WCAG 1.4.11), the selected chain included.
  const graphPart = (el, colour, bg, label) => {
    const raw = parse(colour)
    if (raw.length < 4 || raw[3] === 0) return
    const fg = over([raw[0], raw[1], raw[2], raw[3] * opacityOf(el)], bg)
    const r = ratio(fg, bg)
    if (r >= 3) return
    const key = [label, colour, bg.map(Math.round).join(',')].join('|')
    if (!seen.has(key)) seen.set(key, { text: '(' + label + ')', element: label, fg: colour, bg: 'rgb(' + bg.map(Math.round).join(', ') + ')', size: 0, weight: 0, ratio: Math.round(r * 100) / 100 })
  }
  for (const el of document.querySelectorAll('.dta-graph__node')) {
    const s = getComputedStyle(el)
    if (s.display === 'none' || el.getBoundingClientRect().width === 0) continue
    graphPart(el, s.borderTopColor, bgOf(el.parentElement), 'graph row outline' + (el.dataset.severity ? ' ' + el.dataset.severity : '') + (el.matches('[aria-current], [data-chain]') ? ' selected' : ''))
  }
  for (const el of document.querySelectorAll('.dta-graph__edges path, .dta-graph__edges polygon')) {
    if (el.getBoundingClientRect().width === 0 && el.getBoundingClientRect().height === 0) continue
    const s = getComputedStyle(el)
    const g = el.parentElement
    graphPart(el, el.tagName === 'path' ? s.stroke : s.fill, bgOf(el.closest('svg').parentElement), 'graph arrow ' + (g.dataset.kind || '') + (g.hasAttribute('data-chain') ? ' chain' : ''))
  }
  // Chip dots of the dta diff report (non-text, TICKET-120/121): the ::before marker of a pass,
  // review or fail chip, 3:1 on the chip's tint.
  for (const el of document.querySelectorAll('.chip')) {
    const b = getComputedStyle(el, '::before')
    if (!b.content || b.content === 'none' || b.display === 'none') continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    const raw = parse(b.backgroundColor)
    if (raw[3] === 0) continue
    const bg = bgOf(el)
    const fg = over([raw[0], raw[1], raw[2], raw[3] * opacityOf(el)], bg)
    const r = ratio(fg, bg)
    if (r >= 3) continue
    const key = ['chip-marker', b.backgroundColor, bg.map(Math.round).join(',')].join('|')
    if (seen.has(key)) continue
    seen.set(key, { text: '(chip marker)', element: 'span.' + String(el.className).replace(/ /g, '.') + '::before', fg: b.backgroundColor, bg: 'rgb(' + bg.map(Math.round).join(', ') + ')', size: parseFloat(b.width), weight: 0, ratio: Math.round(r * 100) / 100 })
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
    // TICKET-121: a selected error keeps its square in status-error-marker on the selection tint
    // (the marker audit checks it reaches 3:1 there).
    'example with problems, an error selected': async (page) => {
      await page.getByRole('button', { name: 'Example with problems' }).click()
      await page.getByRole('tab', { name: /^Lint/ }).click()
      await page.locator('summary').first().click()
      await page.locator('.dta-findings__line').first().getByRole('button').click()
      await page.getByRole('dialog').waitFor()
      const same = await page.evaluate(`(() => {
        const line = document.querySelector('.dta-findings__line[aria-current="true"][data-severity="error"]')
        const probe = document.createElement('span')
        probe.style.background = 'var(--status-error-marker)'
        document.body.append(probe)
        const want = getComputedStyle(probe).backgroundColor
        probe.remove()
        const marker = getComputedStyle(line.querySelector('.dta-findings__marker'))
        const open = getComputedStyle(line.querySelector('.dta-findings__open'))
        return [marker.backgroundColor === want, open.backgroundColor !== 'rgba(0, 0, 0, 0)']
      })()`)
      expect(same).toEqual([true, true])
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
    // TICKET-078: the dependency graph of the example with problems, a token selected (canvas and
    // side panel at 1280, list and bottom sheet at 390): its chain in the selection colours, the
    // circular pair and the default mode name in the status colours.
    'graph, a token selected': async (page) => {
      await page.getByRole('button', { name: 'Example with problems' }).click()
      await page.getByRole('tab', { name: 'Graph' }).click()
      await page
        .getByRole('group', { name: /^Dependency graph/ })
        .first()
        .waitFor()
      await page.getByRole('button', { name: /^Colors\.Brand\.Accent/ }).click()
      await page.getByRole('dialog', { name: 'Colors.Brand.Accent' }).waitFor()
    },
    // ...BrandB: the dangling alias and its missing row on the selected chain, a selected error
    'graph, BrandB with the dangling alias selected': async (page) => {
      await page.getByRole('button', { name: 'Example with problems' }).click()
      await page.getByRole('tab', { name: 'Graph' }).click()
      await page
        .getByRole('group', { name: /^Dependency graph/ })
        .first()
        .waitFor()
      const select = page.getByRole('combobox', { name: 'Brand' })
      if (await select.isVisible()) await select.selectOption('BrandB')
      else
        await page
          .getByRole('group', { name: 'Brand' })
          .getByRole('button', { name: /^BrandB/ })
          .click()
      await page.getByRole('group', { name: /BrandB · Desktop$/ }).waitFor()
      await page.getByRole('button', { name: /^Colors\.Brand\.Accent/ }).click()
      await page.getByRole('dialog', { name: 'Colors.Brand.Accent' }).waitFor()
      if (await page.locator('.dta-graph').isVisible()) {
        expect(await page.locator('.dta-graph__node[data-missing][data-chain]').count()).toBe(1)
      }
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

  // The dta diff report (TICKET-120): each verdict in its status colours, with pass and fail chips;
  // review in signal (TICKET-121), its dot in the chip marker audit. The example change is
  // brand-ab's headline (BrandB's accent, navy to sky): example content stays blue or grey, never a
  // system colour (TICKET-122).
  const TOKEN = 'Colors.Brand.Accent (Brand(Alias) · BrandB)'
  // A second token on the same box (TICKET-111): its note stacks with the first one.
  const RADIUS = 'Radius.Card (Brand(Alias) · BrandB)'
  // TICKET-109: a story row shows "after" with the changed boxes outlined and their notes under
  // them. The screenshots are stand-ins (SVG, served for the PNG paths): a story page on the light
  // canvas (paper-100, where signal alone is 2.98:1, so the ink line must hold) with a
  // navy card and a button; the card's radius and the button's colour change.
  const CARD = { x: 20, y: 20, width: 200, height: 120 }
  const BUTTON = { x: 40, y: 92, width: 120, height: 32 }
  const TITLE = { x: 40, y: 40, width: 140, height: 24 }
  const shot = (side: string) => {
    const open = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">'
    if (side === 'diff') {
      return `${open}<rect width="400" height="200" fill="#eceef2"/><rect x="40" y="40" width="140" height="24" fill="#7d8ea3"/></svg>`
    }
    const r = side === 'base' ? 8 : 24
    const button = side === 'base' ? '#2c4466' : '#3b8fd9'
    return `${open}<rect width="400" height="200" fill="#f5f1e8"/><rect x="20" y="20" width="200" height="120" rx="${r}" fill="#1f2a44"/><rect x="40" y="92" width="120" height="32" rx="${r}" fill="${button}"/></svg>`
  }
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
              tokens: explained
                ? [
                    {
                      id: TOKEN,
                      dependents: 1,
                      pixels: 200,
                      elements: ['span.button'],
                      regions: [BUTTON],
                    },
                    {
                      id: RADIUS,
                      dependents: 2,
                      pixels: 400,
                      elements: ['div.card', 'span.button'],
                      regions: [CARD, BUTTON],
                    },
                  ]
                : [],
              unexplainedPixels: explained ? 0 : 200,
              ...(explained ? {} : { unexplainedRegion: TITLE }),
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
        // The review case has a token group, so its "to review" chip and the redline tags show.
        ...(verdict === 'review'
          ? {
              review: {
                verdict,
                changed: 1,
                explained: 1,
                tokens: [
                  {
                    id: TOKEN,
                    before: { raw: '{Colors.Foundation.Navy.700}', resolved: '#2c4466' },
                    after: { raw: '{Colors.Foundation.Sky.500}', resolved: '#3b8fd9' },
                    stories: ['card@1280'],
                    needsReview: true,
                  },
                  {
                    id: RADIUS,
                    before: { raw: '{Radius.sm}', resolved: 8 },
                    after: { raw: '{Radius.lg}', resolved: 24 },
                    stories: ['card@1280'],
                    needsReview: true,
                  },
                ],
                unexplained: [],
                added: [],
                removed: [],
              },
            }
          : {}),
        tokens: { counts: { changed: 0, added: 0, removed: 0, affected: 0 }, changes: [] },
        stories: [
          story('text', 'unchanged', true),
          ...(verdict === 'pass' ? [] : [story('card', 'changed', verdict === 'review')]),
        ],
      }),
    )
  }

  /**
   * Runs in the report: outlines, leaders and notes are told apart from what is around them at
   * 3:1 (WCAG 1.4.11) by their signal or their ink line, whichever holds. Sampled just outside
   * what each paints, on the "after" image (or the stage's paper below it).
   */
  const EDGES = `(() => {
    const parse = (s) => (s.match(/[\\d.]+/g) || []).map(Number).slice(0, 3)
    const paint = (s) => { const m = (s.match(/[\\d.]+/g) || []).map(Number); return m.length === 4 && m[3] === 0 ? null : m.slice(0, 3) }
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
    const failures = []
    let checked = 0
    for (const stage of document.querySelectorAll('.stage')) {
      const img = stage.querySelector('.shot.after')
      const frame = stage.querySelector('.canvas').getBoundingClientRect()
      const ir = img.getBoundingClientRect()
      const c = document.createElement('canvas')
      c.width = Math.round(ir.width); c.height = Math.round(ir.height)
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, c.width, c.height)
      const paper = parse(getComputedStyle(stage).backgroundColor)
      const sample = (x, y) => {
        if (x >= ir.left && x < ir.right && y >= ir.top && y < Math.min(ir.bottom, frame.bottom)) {
          const d = ctx.getImageData(Math.floor(x - ir.left), Math.floor(y - ir.top), 1, 1).data
          return [d[0], d[1], d[2]]
        }
        return paper
      }
      // A leader's ends join its box's outline and its note: only its sides are checked, from
      // below the outline's ring (7 px: border, outline and ink shadow).
      const check = (el, out, colours, label, sidesFrom = -1) => {
        if (getComputedStyle(el).visibility === 'hidden') return
        const r = el.getBoundingClientRect()
        const points = []
        for (let i = 0; i <= 8; i++) {
          const x = r.left + (r.width * i) / 8
          if (sidesFrom < 0) points.push([x, r.top - out], [x, r.bottom + out])
          const top = sidesFrom < 0 ? r.top : r.top + sidesFrom
          const y = top + ((r.bottom - top) * i) / 8
          if (y <= r.bottom) points.push([r.left - out, y], [r.right + out, y])
        }
        checked++
        for (const [x, y] of points) {
          const around = sample(x, y)
          const best = Math.max(...colours.filter(Boolean).map((colour) => ratio(colour, around)))
          if (best < 3) { failures.push({ label, around: around.map(Math.round).join(','), ratio: Math.round(best * 100) / 100 }); return }
        }
      }
      for (const mark of stage.querySelectorAll('.mark')) {
        const s = getComputedStyle(mark)
        const solid = !mark.classList.contains('unexplained')
        // Outline 2 px (and the 3 px ink shadow of a solid mark) outside the border box.
        check(mark, solid ? 4.5 : 3, [paint(s.outlineColor), paint(s.borderTopColor)], solid ? 'outline' : 'dashed outline')
      }
      for (const note of stage.querySelectorAll('.note')) {
        const s = getComputedStyle(note)
        check(note, 1.5, [paint(s.backgroundColor), paint(s.borderTopColor)], 'note ' + note.textContent)
      }
      for (const leader of stage.querySelectorAll('.leader')) {
        if (leader.getBoundingClientRect().height <= 7) continue
        const s = getComputedStyle(leader)
        check(leader, 1.5, [paint(s.backgroundColor), paint(s.borderLeftColor)], 'leader', 7)
      }
    }
    return { checked, failures }
  })()`

  /** Boxes of what lays out the row: none may move when "Show before" is pressed. */
  const GEOMETRY = `[...document.querySelectorAll('.story, .story .bar, .story .side, .story .toggle, .story .stage, .story .canvas, .story .note, .story .tokens-explained, .story .why, .story .whole')].map((el) => { const r = el.getBoundingClientRect(); return [el.className, r.x + scrollX, r.y + scrollY, r.width, r.height].join(' ') })`

  it.each(
    (['pass', 'review', 'fail'] as const).flatMap((verdict) =>
      (verdict === 'pass' ? (['after'] as const) : (['after', 'before'] as const)).flatMap(
        (state) =>
          (['light', 'graphite'] as const).flatMap((brand) =>
            [1280, 390].map((width) => [verdict, state, brand, width] as const),
          ),
      ),
    ),
  )(
    'dta diff report (%s, %s) in %s at %i px',
    async (verdict, state, brand, width) => {
      const html = report(verdict)
      expect(html).toContain(`<span class="chip ${verdict}">`)
      const found = await audit(`${origin}/`, width, brand, async (page) => {
        await page.route(/\/(base|head|diff)\/[^/]+\.png$/, (route: any) =>
          route.fulfill({
            contentType: 'image/svg+xml',
            body: shot(/\/(base|head|diff)\//.exec(route.request().url())![1]),
          }),
        )
        await page.setContent(html)
        expect(await page.evaluate('document.documentElement.dataset.brand')).toBe(brand)
        await page.evaluate(
          `Promise.all([...document.images].map((i) => { i.loading = 'eager'; return i.decode() }))`,
        )
        await page.evaluate('document.fonts.ready.then(() => true)')
        if (verdict === 'pass') return
        const row = page.locator('.story').first()
        const before = row.locator('[data-toggle="before"]')
        const overlay = row.locator('[data-toggle="overlay"]')
        // Unexplained: the overlay is on by default and "Show before" sits beside it; explained
        // rows have no overlay toggle.
        if (verdict === 'fail') {
          expect(await overlay.getAttribute('aria-pressed')).toBe('true')
          expect(
            await row
              .locator('.shot.overlay')
              .evaluate((el: Element) => getComputedStyle(el).visibility),
          ).toBe('visible')
          expect(await row.locator('.mark.unexplained').count()).toBe(1)
        } else {
          expect(await overlay.count()).toBe(0)
          expect(await row.locator('.mark').count()).toBe(2)
        }
        expect(await before.getAttribute('aria-pressed')).toBe('false')
        const label = () =>
          row
            .locator('.side .when-after, .side .when-before')
            .evaluateAll((els: Element[]) =>
              els
                .filter((el) => getComputedStyle(el).visibility === 'visible')
                .map((el) => el.textContent),
            )
        expect(await label()).toEqual(['With this change working tree'])

        if (state === 'after') {
          // Outlines, leaders and notes at 3:1 against the story around them.
          const edges = (await page.evaluate(EDGES)) as { checked: number; failures: unknown[] }
          expect(edges.checked).toBeGreaterThan(verdict === 'review' ? 4 : 1)
          expect(edges.failures).toEqual([])
          // Notes never overlap each other nor sit over an outlined box.
          const rects = (await page.evaluate(`({
            notes: [...document.querySelector('.stage').querySelectorAll('.note')].map((n) => { const r = n.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] }),
            marks: [...document.querySelector('.stage').querySelectorAll('.mark')].map((n) => { const r = n.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] }),
          })`)) as { notes: number[][]; marks: number[][] }
          const meet = (a: number[], b: number[]) =>
            a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
          expect(rects.notes.length).toBe(verdict === 'review' ? 3 : 1)
          rects.notes.forEach((a, i) => {
            rects.notes.slice(i + 1).forEach((b, j) => {
              expect(meet(a, b), `notes ${i} and ${i + j + 1} overlap`).toBe(false)
            })
            rects.marks.forEach((m, j) => expect(meet(a, m), `note ${i} over box ${j}`).toBe(false))
          })
          return
        }

        // "Show before" by keyboard: the image swaps in place, nothing moves.
        await before.focus()
        const geometry = await page.evaluate(GEOMETRY)
        await page.evaluate(`window.__shift = 0; new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__shift += entry.value
        }).observe({ type: 'layout-shift' })`)
        await page.keyboard.press('Space')
        expect(await before.getAttribute('aria-pressed')).toBe('true')
        expect(await before.locator('.state').textContent()).toBe('on')
        expect(await label()).toEqual(['Before this change main · 1a2b3c4'])
        const visibility = (selector: string) =>
          row.locator(selector).evaluate((el: Element) => getComputedStyle(el).visibility)
        expect(await visibility('.shot.before')).toBe('visible')
        expect(await visibility('.shot.after')).toBe('hidden')
        expect(await visibility('.marks')).toBe('hidden')
        expect(await visibility('.notes')).toBe('hidden')
        await page.waitForTimeout(200)
        expect(await page.evaluate(GEOMETRY)).toEqual(geometry)
        expect(await page.evaluate('window.__shift')).toBe(0)
        // ...and back with Enter.
        await page.keyboard.press('Enter')
        expect(await before.getAttribute('aria-pressed')).toBe('false')
        expect(await label()).toEqual(['With this change working tree'])
        expect(await page.evaluate(GEOMETRY)).toEqual(geometry)
        expect(await page.evaluate('window.__shift')).toBe(0)
        await page.keyboard.press('Space') // audit the "before" state
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
