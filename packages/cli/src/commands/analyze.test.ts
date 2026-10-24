import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startFigmaFake, type FigmaFake } from '@dta/testkit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from '../index.js'

const recording = JSON.parse(
  fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      '..',
      '..',
      '..',
      '..',
      'test/recordings/brand-ab/variables-local.json',
    ),
    'utf8',
  ),
)

let dir: string
let fake: FigmaFake
beforeEach(async () => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-analyze-')))
  fake = await startFigmaFake({ files: { KEY: recording }, token: 'secret' })
  process.env.DTA_FIGMA_API_URL = fake.url
})
afterEach(async () => {
  delete process.env.DTA_FIGMA_API_URL
  await fake.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

async function analyze(figma: object, ...args: string[]) {
  fs.writeFileSync(path.join(dir, 'dta.config.json'), JSON.stringify({ figma }))
  let stdout = ''
  const exitCode = await runCli(['analyze', ...args], {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: () => undefined,
  })
  // eslint-disable-next-line no-control-regex
  return { exitCode, stdout: stdout.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '') }
}

describe('dta analyze', () => {
  it('reports the structure of the Figma file', async () => {
    const { exitCode, stdout } = await analyze({ fileKey: 'KEY', personalAccessToken: 'secret' })
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Found 3 variable collections')
    expect(stdout).toContain('Brand(Alias)')
    expect(stdout).toContain("brands: ['BrandA', 'BrandB']")
    expect(stdout).toContain('Analysis complete!')
    expect(fake.requests).toHaveLength(1)
  })

  it('needs credentials and exits with code 2 without calling Figma', async () => {
    const { exitCode, stdout } = await analyze({ fileKey: 'KEY' })
    expect(exitCode).toBe(2)
    expect(stdout).toContain('Figma API credentials are required for analyze.')
    expect(fake.requests).toHaveLength(0)
  })

  it('explains a rejected token, with the way out for other plans, and never prints the token', async () => {
    const { exitCode, stdout } = await analyze({ fileKey: 'KEY', personalAccessToken: 'wrong' })
    expect(exitCode).toBe(1)
    expect(stdout).toContain('Enterprise')
    expect(stdout).toContain('--from-file')
    expect(stdout).not.toContain('wrong')
  })

  it('shows the file key with --verbose', async () => {
    const { stdout } = await analyze({ fileKey: 'KEY', personalAccessToken: 'secret' }, '--verbose')
    expect(stdout).toContain('File: KEY')
  })
})
