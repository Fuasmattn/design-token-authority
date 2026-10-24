import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { auditJsonSchema, runCli } from '../index.js'
import { fixtureTokens } from './test-support.js'

let dir: string
const write = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  fs.writeFileSync(path.join(dir, file), content)
}
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-audit-cmd-')))
  write('dta.config.json', JSON.stringify({ brands: ['BrandA', 'BrandB'] }))
  for (const [name, content] of Object.entries(fixtureTokens())) write(`tokens/${name}`, content)
  write('src/a.css', '.a {\n  color: #0057b8;\n  padding: 16px;\n}\n')
  write('output/css/variables.css', ':root { --x: #0057b8; }\n')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

async function audit(...args: string[]) {
  let stdout = ''
  let stderr = ''
  const exitCode = await runCli(['audit', ...args], {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  })
  return { exitCode, stdout, stderr }
}

describe('dta audit', () => {
  it('reports hard-coded values with the token to use and exits 1', async () => {
    const { exitCode, stdout } = await audit()
    expect(exitCode).toBe(1)
    expect(stdout).toContain(
      '2:10  #0057b8  color → Colors.Brand.Primary  var(--colors-brand-primary)',
    )
    expect(stdout).toContain('2 hard-coded values in 1 file could be tokens.')
  })

  it('never scans the build output, even when asked to scan the project', async () => {
    const { stdout } = await audit('.')
    expect(stdout).not.toContain('output/css')
  })

  it('reports nothing new after --update-baseline, but a new value again', async () => {
    expect((await audit('--update-baseline')).stdout).toContain(
      'Wrote .dta/audit-baseline.json with 2 findings',
    )
    const clean = await audit()
    expect(clean.exitCode).toBe(0)
    expect(clean.stdout).toContain('(2 more in the baseline)')
    write('src/b.css', '.b { border-radius: 0; color: #003f8a; }\n')
    const again = await audit()
    expect(again.exitCode).toBe(1)
    expect(again.stdout).toContain('src/b.css')
    expect(again.stdout).not.toContain('src/a.css')
  })

  it('prints JSON that matches the published schema', async () => {
    const { stdout } = await audit('--format', 'json')
    const validate = new Ajv2020({ strict: false }).compile(auditJsonSchema())
    const result = JSON.parse(stdout)
    expect(validate(result)).toBe(true)
    expect(result).toMatchObject({ schema: 'dta.audit/1', baselined: 0, files: 1 })
  })

  it('reads paths, ignore globs and near from the config', async () => {
    write('src/c.css', '.c { color: #0057b9; }\n')
    write(
      'dta.config.json',
      JSON.stringify({
        brands: ['BrandA'],
        audit: { paths: ['src'], ignore: ['src/a.css'], near: true },
      }),
    )
    const { stdout } = await audit()
    expect(stdout).toContain('src/c.css')
    expect(stdout).not.toContain('src/a.css')
  })

  it('exits 2 for a missing path, an unknown format or a broken baseline', async () => {
    expect((await audit('nope')).exitCode).toBe(2)
    expect((await audit('--format', 'xml')).exitCode).toBe(2)
    write('.dta/audit-baseline.json', '{')
    expect((await audit()).exitCode).toBe(2)
  })
})
