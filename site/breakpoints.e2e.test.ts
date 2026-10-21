/**
 * Breakpoint modes switch by media query (TICKET-091). The Learn `multi-brand` example plus a
 * `Screen` collection (Mobile, Tablet, Desktop) is built with `dta build` and a mobile-first
 * `breakpoints` config; in Chromium, the tokens follow the viewport width, and a breakpoint token
 * that aliases a brand token follows the nearest `data-brand` at every width.
 *
 * Needs a browser only (no built site): runs when DTA_E2E=1 (CI job "site", through
 * `test:contrast`) or DTA_BROWSER_PATH is set; otherwise skipped.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const enabled = process.env.DTA_E2E === '1' || Boolean(process.env.DTA_BROWSER_PATH)
const site = import.meta.dirname
const example = path.join(site, 'learn-examples', 'multi-brand')
const bin = path.join(site, '..', 'bin', 'dta.js')

const radius = (alias: string) => ({
  $type: 'number',
  $value: alias,
  $extensions: { 'com.figma': { scopes: ['CORNER_RADIUS'] } },
})
/** `gap` aliases primitives only; `accent` aliases a brand token on Desktop. */
const SCREEN: Record<string, object> = {
  Mobile: { gap: radius('{radius.4}'), accent: { $type: 'color', $value: '{color.neutral.0}' } },
  Tablet: { gap: radius('{radius.4}'), accent: { $type: 'color', $value: '{color.blue.600}' } },
  Desktop: {
    gap: radius('{radius.999}'),
    accent: { $type: 'color', $value: '{action.background}' },
  },
}

const CONFIG = `export default {
  tokens: { dir: 'tokens' },
  brands: ['BrandA', 'BrandB'],
  breakpoints: {
    collection: 'Screen',
    default: 'Mobile',
    modes: { Tablet: '(min-width: 768px)', Desktop: '(min-width: 1024px)' },
  },
  outputs: { css: { outDir: 'output/css' } },
}
`

const STYLES = `(id) => {
  const style = getComputedStyle(document.getElementById(id))
  return { radius: style.borderTopLeftRadius, accent: style.backgroundColor }
}`

const WHITE = 'rgb(255, 255, 255)' // color.neutral.0
const BLUE = 'rgb(31, 95, 209)' // color.blue.600, BrandA's action.background
const GREEN = 'rgb(29, 122, 76)' // color.green.600, BrandB's action.background

let dir: string
let css: string
let browser: { newContext(o?: object): Promise<any>; close(): Promise<void> }

describe.skipIf(!enabled)('breakpoint modes in Chromium', () => {
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-breakpoints-'))
    fs.writeFileSync(path.join(dir, 'dta.config.ts'), CONFIG)
    fs.cpSync(path.join(example, 'tokens'), path.join(dir, 'tokens'), { recursive: true })
    for (const [mode, tokens] of Object.entries(SCREEN)) {
      fs.writeFileSync(path.join(dir, 'tokens', `Screen.${mode}.json`), JSON.stringify(tokens))
    }
    execFileSync(process.execPath, [bin, 'build'], {
      cwd: dir,
      env: { ...process.env, NO_COLOR: '1' },
    })
    css = ['variables.css', 'themes/branda.css', 'themes/brandb.css']
      .map((file) => fs.readFileSync(path.join(dir, 'output', 'css', file), 'utf-8'))
      .join('\n')
    const playwright = await import('playwright-core')
    browser = await playwright.chromium.launch({
      executablePath: process.env.DTA_BROWSER_PATH || undefined,
    })
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('writes the modes as media blocks, and the brand-dependent token into the themes', () => {
    expect(css).toContain('/* Screen · Mobile (default) */\n:root {\n  --gap: var(--radius-4);')
    expect(css).toContain('@media (min-width: 1024px) {\n  :root {\n    --gap: var(--radius-999);')
    expect(css).toContain(
      '@media (min-width: 1024px) {\n  [data-brand="brandb"] {\n    --accent: var(--action-background);',
    )
  })

  for (const [width, expected] of [
    [390, { root: { radius: '4px', accent: WHITE }, nested: { radius: '4px', accent: WHITE } }],
    [800, { root: { radius: '4px', accent: BLUE }, nested: { radius: '4px', accent: BLUE } }],
    [1280, { root: { radius: '999px', accent: BLUE }, nested: { radius: '999px', accent: GREEN } }],
  ] as const) {
    it(`follows the viewport at ${width}px, and the nearest data-brand`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 600 } })
      try {
        const page = await context.newPage()
        const box = 'style="border-radius: var(--gap); background: var(--accent)"'
        await page.setContent(
          `<!doctype html><html data-brand="branda"><head><style>${css}</style></head><body>` +
            `<div id="root-box" ${box}></div>` +
            `<section data-brand="brandb"><div id="nested-box" ${box}></div></section>` +
            '</body></html>',
        )
        expect(await page.evaluate(`(${STYLES})('root-box')`)).toEqual(expected.root)
        expect(await page.evaluate(`(${STYLES})('nested-box')`)).toEqual(expected.nested)
      } finally {
        await context.close()
      }
    }, 60_000)
  }

  it('switches when the same page is resized', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 600 } })
    try {
      const page = await context.newPage()
      await page.setContent(
        `<!doctype html><html data-brand="brandb"><head><style>${css}</style></head><body>` +
          '<div id="box" style="border-radius: var(--gap); background: var(--accent)"></div>' +
          '</body></html>',
      )
      expect(await page.evaluate(`(${STYLES})('box')`)).toEqual({ radius: '4px', accent: WHITE })
      await page.setViewportSize({ width: 1024, height: 600 })
      expect(await page.evaluate(`(${STYLES})('box')`)).toEqual({ radius: '999px', accent: GREEN })
      await page.setViewportSize({ width: 1023, height: 600 })
      expect(await page.evaluate(`(${STYLES})('box')`)).toEqual({ radius: '4px', accent: BLUE })
    } finally {
      await context.close()
    }
  }, 60_000)
})
