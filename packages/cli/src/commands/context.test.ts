import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from '../index.js'
import { fixtureTokens } from './test-support.js'

let dir: string
const write = (config: unknown) =>
  fs.writeFileSync(path.join(dir, 'dta.config.json'), JSON.stringify(config))
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-context-')))
  write({ brands: ['BrandA', 'BrandB'] })
  fs.mkdirSync(path.join(dir, 'tokens'))
  for (const [name, content] of Object.entries(fixtureTokens())) {
    fs.writeFileSync(path.join(dir, 'tokens', name), content)
  }
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

async function dta(...args: string[]) {
  let stdout = ''
  let stderr = ''
  const exitCode = await runCli(args, {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  })
  return { exitCode, stdout, stderr }
}
const read = (file: string) => fs.readFileSync(path.join(dir, file), 'utf8')

describe('dta context', () => {
  it('writes DESIGN.md and the AGENTS.md block, then reports them up to date', async () => {
    expect(await dta('context')).toMatchObject({
      exitCode: 0,
      stdout: 'Wrote DESIGN.md and AGENTS.md.\n',
    })
    expect(read('DESIGN.md')).toContain('| Colors.Brand.Primary |')
    expect(read('AGENTS.md')).toContain('[DESIGN.md](DESIGN.md)')
    expect((await dta('context')).stdout).toBe('DESIGN.md and AGENTS.md are up to date.\n')
  })

  it('keeps the rest of an existing AGENTS.md', async () => {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Agents\n\nRun pnpm test.\n')
    await dta('context')
    expect(read('AGENTS.md').startsWith('# Agents\n\nRun pnpm test.\n')).toBe(true)
  })

  it('writes elsewhere with --out or context.out', async () => {
    await dta('context', '--out', 'docs/DESIGN.md')
    expect(read('AGENTS.md')).toContain('[docs/DESIGN.md](docs/DESIGN.md)')
    write({ brands: ['BrandA'], context: { out: 'agents/tokens.md' } })
    await dta('context')
    expect(fs.existsSync(path.join(dir, 'agents/tokens.md'))).toBe(true)
  })

  it('--check exits 1 when a file is missing or stale', async () => {
    expect((await dta('context', '--check')).exitCode).toBe(1)
    await dta('context')
    expect((await dta('context', '--check')).exitCode).toBe(0)
    fs.writeFileSync(
      path.join(dir, 'tokens', 'Primitives.Value.json'),
      read('tokens/Primitives.Value.json').replace('#0057b8', '#0057b9'),
    )
    const stale = await dta('context', '--check')
    expect(stale.exitCode).toBe(1)
    expect(stale.stderr).toContain('DESIGN.md is out of date')
  })

  it('leaves a DESIGN.md it did not write alone and exits 2', async () => {
    fs.writeFileSync(path.join(dir, 'DESIGN.md'), '# Our design notes\n')
    const { exitCode, stderr } = await dta('context')
    expect(exitCode).toBe(2)
    expect(stderr).toContain('was not written by dta context')
    expect(read('DESIGN.md')).toBe('# Our design notes\n')
  })
})

describe('dta build with context', () => {
  it('writes the context only when the config has a context section', async () => {
    await dta('build')
    expect(fs.existsSync(path.join(dir, 'DESIGN.md'))).toBe(false)
    write({ brands: ['BrandA', 'BrandB'], context: {} })
    expect((await dta('build')).exitCode).toBe(0)
    expect(read('DESIGN.md')).toContain('# Design tokens')
    expect(read('AGENTS.md')).toContain('<!-- dta:begin -->')
  })
})
