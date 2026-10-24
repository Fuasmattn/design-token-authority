/**
 * The CSS `dta build` writes for DTCG 2025.10 values renders (TICKET-134): the `dtcg-2025`
 * fixture is built, and in Chromium every composite custom property is a valid value for the
 * property it is meant for (box-shadow, border, font, transition, a gradient's colour stops),
 * colour spaces stay as written, and `data-brand` switches a composite.
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
const fixture = path.join(site, '..', 'test', 'fixtures', 'dtcg-2025')
const bin = path.join(site, '..', 'bin', 'dta.js')

const PAGE = `
<div id="shadow" style="box-shadow: var(--shadow-card)"></div>
<div id="stack" style="box-shadow: var(--shadow-stack)"></div>
<div id="border" style="border: var(--border-focus)"></div>
<div id="dashed" style="border: var(--border-dashed)"></div>
<div id="text" style="font: var(--typography-body)">Text</div>
<div id="fade" style="transition: opacity var(--transition-enter)"></div>
<div id="gradient" style="background-image: linear-gradient(to right, var(--gradient-brand))"></div>
<div id="sky" style="color: var(--color-sky)"></div>
<div id="vivid" style="color: var(--color-vivid)"></div>
<section id="brand-b" data-brand="b"><div id="raised" style="box-shadow: var(--elevation-raised)"></div></section>
`

const STYLES = `() => {
  const style = (id) => getComputedStyle(document.getElementById(id))
  return {
    shadow: style('shadow').boxShadow,
    stack: style('stack').boxShadow,
    borderWidth: style('border').borderTopWidth,
    borderStyle: style('border').borderTopStyle,
    dashed: style('dashed').borderTopStyle,
    fontSize: style('text').fontSize,
    fontWeight: style('text').fontWeight,
    lineHeight: style('text').lineHeight,
    fontFamily: style('text').fontFamily,
    duration: style('fade').transitionDuration,
    timing: style('fade').transitionTimingFunction,
    gradient: style('gradient').backgroundImage,
    sky: style('sky').color,
    vivid: style('vivid').color,
    raised: style('raised').boxShadow,
  }
}`

let dir: string
let css: string
let browser: { newContext(o?: object): Promise<any>; close(): Promise<void> }

describe.skipIf(!enabled)('DTCG 2025.10 CSS in Chromium', () => {
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-dtcg-css-'))
    fs.cpSync(fixture, dir, { recursive: true })
    execFileSync(process.execPath, [bin, 'build'], {
      cwd: dir,
      env: { ...process.env, NO_COLOR: '1' },
    })
    css = ['variables.css', 'themes/a.css', 'themes/b.css']
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

  it('renders every composite, keeps colour spaces and switches with data-brand', async () => {
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      await page.setContent(
        `<!doctype html><html data-brand="a"><head><style>${css}</style></head><body>${PAGE}</body></html>`,
      )
      const styles = (await page.evaluate(`(${STYLES})()`)) as Record<string, string>
      expect(styles.shadow).toBe('rgba(0, 0, 0, 0.5) 0px 4px 16px 0px')
      expect(styles.stack).toBe(
        'rgba(0, 0, 0, 0.5) 0px 1px 2px 0px, rgba(0, 0, 0, 0.2) 0px 8px 16px -4px inset',
      )
      expect([styles.borderWidth, styles.borderStyle, styles.dashed]).toEqual([
        '2px',
        'solid',
        'dashed',
      ])
      expect([styles.fontSize, styles.fontWeight, styles.lineHeight]).toEqual([
        '16px',
        '400',
        '24px',
      ])
      expect(styles.fontFamily).toBe('"Helvetica Neue", Arial, sans-serif')
      expect([styles.duration, styles.timing]).toEqual(['0.15s', 'cubic-bezier(0.5, 0, 1, 1)'])
      expect(styles.gradient).toMatch(/^linear-gradient\(to right, oklch\(0\.7 0\.15 250\) 0%, /)
      expect(styles.sky).toBe('oklch(0.7 0.15 250)')
      expect(styles.vivid).toBe('color(display-p3 1 0.2 0)')
      // Brand B's elevation is the two-layer stack, brand A's the card shadow.
      expect(styles.raised).toBe(styles.stack)
    } finally {
      await context.close()
    }
  })
})
