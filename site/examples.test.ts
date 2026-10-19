/**
 * Orbit Burger, the landing page's example product, is a real DTA token set: both states lint
 * clean under its own config, build with DTA, and differ in exactly the two tokens the page talks
 * about (Colors.Brand.Primary Nova 500 → 600, Radius.Card 8 → 24).
 */
import fs from 'node:fs'
import path from 'node:path'
import { parseTokenFiles } from '@dta/core'
import { lintTokens } from '@dta/lint'
import { describe, expect, it } from 'vitest'
import config from './examples/orbit-burger/dta.config.js'
import { exampleStylesheet } from './scripts/build-example.js'

const exampleDir = path.join(import.meta.dirname, 'examples', 'orbit-burger')

function model(dir: string) {
  const tokensDir = path.join(exampleDir, dir)
  const files = fs
    .readdirSync(tokensDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((fileName) => ({
      fileName,
      content: fs.readFileSync(path.join(tokensDir, fileName), 'utf8'),
    }))
  return parseTokenFiles(files)
}

describe('the Orbit Burger example token set', () => {
  it.each(['tokens-base', 'tokens'])('%s parses and lints clean with its config', (dir) => {
    const parsed = model(dir)
    expect(parsed.diagnostics).toEqual([])
    const result = lintTokens(parsed.model, config.lint)
    expect(result.diagnostics).toEqual([])
    expect(result.violations).toEqual([])
  })

  it('builds one scoped stylesheet with both states, differing in the two changed tokens', async () => {
    const css = await exampleStylesheet()
    const block = (state: string) =>
      css.match(
        new RegExp(
          `\\[data-example="orbit-burger"\\]\\[data-state="${state}"\\] \\{\\n([\\s\\S]*?)\\n\\}`,
        ),
      )?.[1]
    const main = block('main')!.split('\n')
    const change = block('change')!.split('\n')
    expect(main).toHaveLength(change.length)
    const differing = change.filter((line, i) => line !== main[i]).map((line) => line.trim())
    expect(differing).toEqual([
      '--colors-brand-primary: #e0600a; /** The brand orange: the launch button, prices, the active tab. */',
      '--radius-card: 24px; /** Cards and the launch button. */',
    ])
    expect(main.map((line) => line.trim())).toContain(
      '--colors-brand-primary: #ff7a1a; /** The brand orange: the launch button, prices, the active tab. */',
    )
    // The example's variables never shadow the site's own tokens.
    const siteBase = fs.readFileSync(path.join(import.meta.dirname, 'output/css/base.css'), 'utf8')
    for (const [, name] of css.matchAll(/^\s+(--[\w-]+):/gm)) {
      expect(siteBase, `${name} is also a site token`).not.toContain(`${name}:`)
    }
  })
})
