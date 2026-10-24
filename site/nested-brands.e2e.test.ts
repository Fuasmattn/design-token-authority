/**
 * A nested `data-brand` reaches single-mode tokens that alias brand tokens (TICKET-093). The
 * Learn `multi-brand` example plus a single-mode component tier is built with `dta build`; in
 * Chromium, a `<section data-brand="brandb">` inside `<html data-brand="branda">` resolves the
 * component tokens to BrandB, and the root to BrandA.
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

/** A component tier with one mode over the brand tier; `border` aliases a primitive only. */
const COMPONENT = {
  button: {
    background: { $type: 'color', $value: '{action.background}' },
    radius: { $type: 'number', $value: '{shape.control}' },
    border: { $type: 'color', $value: '{color.blue.600}' },
  },
  card: { accent: { $type: 'color', $value: '{button.background}' } },
}

const STYLES = `(id) => {
  const style = getComputedStyle(document.getElementById(id))
  return {
    background: style.backgroundColor,
    radius: style.borderTopLeftRadius,
    border: style.borderTopColor,
    accent: style.outlineColor,
  }
}`

const BLUE = 'rgb(31, 95, 209)' // color.blue.600, BrandA's action.background
const GREEN = 'rgb(29, 122, 76)' // color.green.600, BrandB's action.background

let dir: string
let css: string
let browser: { newContext(o?: object): Promise<any>; close(): Promise<void> }

describe.skipIf(!enabled)('nested data-brand in Chromium', () => {
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-nested-brands-'))
    fs.copyFileSync(path.join(example, 'dta.config.ts'), path.join(dir, 'dta.config.ts'))
    fs.cpSync(path.join(example, 'tokens'), path.join(dir, 'tokens'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'tokens', 'Component.Value.json'), JSON.stringify(COMPONENT))
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

  it('resolves the component tokens to the brand of the nearest data-brand', async () => {
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      const box =
        'style="background: var(--button-background); border: 2px solid var(--button-border);' +
        ' border-radius: var(--button-radius); outline: 2px solid var(--card-accent)"'
      await page.setContent(
        `<!doctype html><html data-brand="branda"><head><style>${css}</style></head><body>` +
          `<div id="root-box" ${box}></div>` +
          `<section data-brand="brandb"><div id="nested-box" ${box}></div></section>` +
          '</body></html>',
      )
      expect(await page.evaluate(`(${STYLES})('root-box')`)).toEqual({
        background: BLUE,
        radius: '4px',
        border: BLUE,
        accent: BLUE,
      })
      expect(await page.evaluate(`(${STYLES})('nested-box')`)).toEqual({
        background: GREEN,
        radius: '999px',
        border: BLUE, // aliases a primitive: the same in every brand
        accent: GREEN,
      })
    } finally {
      await context.close()
    }
  }, 60_000)
})
