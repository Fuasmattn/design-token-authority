import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from '../index.js'
import { copyToClipboard } from './brief.js'
import { fixtureTokens } from './test-support.js'

let dir: string
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-brief-')))
  fs.writeFileSync(
    path.join(dir, 'dta.config.json'),
    JSON.stringify({ tokens: { dir: 'tokens' }, brands: ['BrandA', 'BrandB'] }),
  )
  fs.mkdirSync(path.join(dir, 'tokens'))
  for (const [name, content] of Object.entries(fixtureTokens())) {
    fs.writeFileSync(path.join(dir, 'tokens', name), content)
  }
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

async function brief(...args: string[]) {
  let stdout = ''
  let stderr = ''
  const exitCode = await runCli(['brief', ...args], {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  })
  return { exitCode, stdout, stderr }
}

describe('dta brief (TICKET-031)', () => {
  it('writes one brief per brand by default', async () => {
    const { exitCode, stdout } = await brief()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('# BrandA brief')
    expect(stdout).toContain('\n---\n\n# BrandB brief')
  })

  it('--brand writes one, as JSON with the schema version', async () => {
    const { stdout } = await brief('--brand', 'BrandB', '--format', 'json')
    const json = JSON.parse(stdout)
    expect(json.schema).toBe('dta.brief/1')
    expect(json.briefs.map((b: { brand: string }) => b.brand)).toEqual(['BrandB'])
  })

  it('exits 2 for an unknown brand or format', async () => {
    expect((await brief('--brand', 'BrandC')).exitCode).toBe(2)
    expect((await brief('--format', 'yaml')).exitCode).toBe(2)
  })

  it('copyToClipboard says when no clipboard command works', () => {
    expect(copyToClipboard('x', 'aix')).toBe(false)
  })
})
