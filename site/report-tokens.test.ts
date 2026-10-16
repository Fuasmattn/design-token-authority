import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { REPORT_TOKENS_MODULE, reportTokensModule } from './scripts/report-tokens.js'

describe('dta diff report tokens', () => {
  it('are built from site/tokens and up to date (run `pnpm report:tokens`)', async () => {
    expect(fs.readFileSync(REPORT_TOKENS_MODULE, 'utf8')).toBe(await reportTokensModule())
  })
})
