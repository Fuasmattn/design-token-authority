/**
 * The published entry point (`bin/dta.js`, behind both bin names) starts the CLI with plain
 * `node`, outside the repo's working directory.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const bin = path.join(repoRoot, 'bin', 'dta.js')

describe('bin/dta.js', () => {
  it('prints the version of package.json', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-bin-'))
    try {
      const version = execFileSync(process.execPath, [bin, '--version'], { cwd, encoding: 'utf-8' })
      const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'))
      expect(version.trim()).toBe(pkg.version)
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })
  it('stops dta init without a terminal instead of waiting for an answer (TICKET-090)', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-bin-'))
    try {
      let failure: { status?: number; stderr?: string } = {}
      try {
        execFileSync(process.execPath, [bin, 'init'], { cwd, encoding: 'utf-8', stdio: 'pipe' })
      } catch (error) {
        failure = error as typeof failure
      }
      expect(failure.status).toBe(2)
      expect(failure.stderr).toContain('pass --yes')
      expect(fs.existsSync(path.join(cwd, 'dta.config.ts'))).toBe(false)
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })
  // A project without "type": "module" in its package.json (or without a package.json at all):
  // the config is ESM syntax in a .ts / .js file. TICKET-072 found that this failed to load.
  for (const [file, body] of [
    [
      'dta.config.ts',
      "export default { tokens: { dir: 'tokens' } } satisfies Record<string, unknown>",
    ],
    ['dta.config.js', "export default { tokens: { dir: 'tokens' } }"],
    ['dta.config.mts', "export default { tokens: { dir: 'tokens' } }"],
  ] as const) {
    it(`loads an ESM ${file} outside a module package`, () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-bin-'))
      try {
        fs.writeFileSync(path.join(cwd, file), body)
        fs.writeFileSync(path.join(cwd, 'package.json'), '{ "name": "app" }')
        fs.mkdirSync(path.join(cwd, 'tokens'))
        fs.writeFileSync(
          path.join(cwd, 'tokens', 'Base.Value.json'),
          JSON.stringify({ brand: { $type: 'color', $value: '#2f55d4' } }),
        )
        const out = execFileSync(process.execPath, [bin, 'build'], {
          cwd,
          encoding: 'utf-8',
          env: { ...process.env, NO_COLOR: '1' },
        })
        expect(out).toContain('Build complete')
        expect(
          fs.readFileSync(path.join(cwd, 'output', 'css', 'variables.css'), 'utf-8'),
        ).toContain('--brand: #2f55d4;')
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true })
      }
    })
  }
})
