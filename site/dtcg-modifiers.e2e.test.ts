/**
 * Several resolver modifiers at once in CSS (TICKET-137): the `dtcg-modifiers` fixture (a theme
 * and a brand that both change the accent) is built, and in Chromium every combination of
 * `data-theme` and `data-brand`, set on the same element or nested either way round, gives the
 * value the resolver document gives for that combination.
 *
 * Needs a browser only (no built site): runs when DTA_E2E=1 (CI job "site", through
 * `test:contrast`) or DTA_BROWSER_PATH is set; otherwise skipped.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseTokenFiles, resolve, type TokenModel } from '@dta/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const enabled = process.env.DTA_E2E === '1' || Boolean(process.env.DTA_BROWSER_PATH)
const site = import.meta.dirname
const fixture = path.join(site, '..', 'test', 'fixtures', 'dtcg-modifiers')
const bin = path.join(site, '..', 'bin', 'dta.js')

/** Probes: where the attributes are set, and the combination that applies there. */
const PROBES = [
  { id: 'root', html: '<p id="root"></p>', theme: 'light', brand: 'a' },
  {
    id: 'dark',
    html: '<section data-theme="dark"><p id="dark"></p></section>',
    theme: 'dark',
    brand: 'a',
  },
  {
    id: 'b',
    html: '<section data-brand="b"><p id="b"></p></section>',
    theme: 'light',
    brand: 'b',
  },
  {
    id: 'brand-in-theme',
    html: '<section data-theme="dark"><div data-brand="b"><p id="brand-in-theme"></p></div></section>',
    theme: 'dark',
    brand: 'b',
  },
  {
    id: 'theme-in-brand',
    html: '<section data-brand="b"><div data-theme="dark"><p id="theme-in-brand"></p></div></section>',
    theme: 'dark',
    brand: 'b',
  },
  {
    id: 'reset',
    html: '<section data-brand="b" data-theme="dark"><div data-brand="a" data-theme="light"><p id="reset"></p></div></section>',
    theme: 'light',
    brand: 'a',
  },
  {
    // A theme token that aliases the combined accent, with the brand set further in.
    id: 'light-in-dark',
    html: '<section data-theme="dark"><div data-theme="light"><p data-brand="b" id="light-in-dark"></p></div></section>',
    theme: 'light',
    brand: 'b',
  },
]
const TOKENS = [
  'accent',
  'button.background',
  'surface',
  'button.text',
  'button.radius',
  'ring',
  'button.focus',
]
const property = (name: string) => `--${name.replace(/\./g, '-')}`

const STYLES = `(ids) => Object.fromEntries(ids.map((id) => {
  const p = document.getElementById(id)
  const style = getComputedStyle(p)
  return [id, {
    accent: style.color,
    'button.background': style.backgroundColor,
    surface: style.outlineColor,
    'button.text': style.borderTopColor,
    'button.radius': style.borderTopLeftRadius,
    ring: style.textDecorationColor,
    'button.focus': style.caretColor,
  }]
}))`

const rgb = (value: unknown) => {
  const hex = String(value)
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}
const cssValue = (value: unknown) => {
  if (typeof value !== 'object' || value === null) return rgb(value)
  const { value: amount, unit } = value as { value?: unknown; unit?: unknown }
  return `${String(amount)}${String(unit)}`
}

let dir: string
let css: string
let model: TokenModel
let browser: { newContext(o?: object): Promise<any>; close(): Promise<void> }

function tokenFiles(root: string) {
  const files: Array<{ fileName: string; content: string }> = []
  const walk = (at: string) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const file = path.join(at, entry.name)
      if (entry.isDirectory()) walk(file)
      else {
        files.push({
          fileName: path.relative(root, file).split(path.sep).join('/'),
          content: fs.readFileSync(file, 'utf-8'),
        })
      }
    }
  }
  walk(root)
  return files
}

describe.skipIf(!enabled)('several resolver modifiers in Chromium', () => {
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-modifiers-css-'))
    fs.cpSync(fixture, dir, { recursive: true })
    execFileSync(process.execPath, [bin, 'build'], {
      cwd: dir,
      env: { ...process.env, NO_COLOR: '1' },
    })
    const cssDir = path.join(dir, 'output', 'css')
    css = [
      'variables.css',
      ...fs.readdirSync(path.join(cssDir, 'themes')).map((f) => `themes/${f}`),
    ]
      .map((file) => fs.readFileSync(path.join(cssDir, file), 'utf-8'))
      .join('\n')
    model = parseTokenFiles(tokenFiles(path.join(fixture, 'tokens'))).model
    const playwright = await import('playwright-core')
    browser = await playwright.chromium.launch({
      executablePath: process.env.DTA_BROWSER_PATH || undefined,
    })
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('gives the resolver value of every combination, nested either way', async () => {
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      const rule = `p { outline: 1px solid; border: 1px solid; color: var(${property('accent')});
        background-color: var(${property('button.background')});
        outline-color: var(${property('surface')}); border-color: var(${property('button.text')});
        border-radius: var(${property('button.radius')});
        text-decoration: underline; text-decoration-color: var(${property('ring')});
        caret-color: var(${property('button.focus')}); }`
      await page.setContent(
        `<!doctype html><html data-theme="light" data-brand="a"><head><style>${css}\n${rule}</style></head><body>${PROBES.map((p) => p.html).join('\n')}</body></html>`,
      )
      const styles = (await page.evaluate(
        `(${STYLES})(${JSON.stringify(PROBES.map((p) => p.id))})`,
      )) as Record<string, Record<string, string>>
      for (const probe of PROBES) {
        for (const token of TOKENS) {
          const resolved = resolve(model, token.split('.'), {
            theme: probe.theme,
            brand: probe.brand,
          })
          expect(resolved.ok, token).toBe(true)
          if (!resolved.ok) continue
          expect(`${probe.id} ${token}: ${styles[probe.id][token]}`).toBe(
            `${probe.id} ${token}: ${cssValue(resolved.value)}`,
          )
        }
      }
      // The four combinations differ where the resolver says they do.
      expect(new Set(PROBES.map((p) => styles[p.id].accent)).size).toBe(3)
    } finally {
      await context.close()
    }
  })
})
