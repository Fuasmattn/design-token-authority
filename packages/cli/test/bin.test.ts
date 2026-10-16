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
})
