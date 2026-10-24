/**
 * The website follows its own tokens: `dta audit` finds no hard-coded value in its source that
 * equals a DTA Drafting Table token.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const site = path.dirname(new URL(import.meta.url).pathname)
const dta = path.join(site, '..', 'bin', 'dta.js')

describe('dta audit on the website', () => {
  it('reports nothing', () => {
    const output = execFileSync(process.execPath, [dta, 'audit', 'src'], {
      cwd: site,
      encoding: 'utf8',
    })
    // The baseline accepts the agent scene's quoted colour (src/landing/content.ts) and four 20px
    // paddings that the audit matches to size.icon, a width/height token (TICKET-147), nothing else.
    expect(output).toMatch(
      /^No hard-coded token values in \d+ files \(6 more in the baseline\)\.\n$/,
    )
  })
})
