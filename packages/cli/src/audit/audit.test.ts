import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { auditFiles, baselineOf, newFindings, type Finding } from './audit.js'

let dir: string
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-audit-')))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))
const touch = (file: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  fs.writeFileSync(path.join(dir, file), '')
}

describe('auditFiles', () => {
  it('lists source files, skipping dependencies, tests, output and ignored globs', () => {
    for (const file of [
      'src/a.css',
      'src/b.tsx',
      'src/c.md',
      'src/d.test.ts',
      'src/node_modules/x.js',
      'src/gen/out.css',
      'src/legacy/old.css',
    ]) {
      touch(file)
    }
    expect(auditFiles(dir, ['src'], { skip: ['src/gen'], ignore: ['src/legacy'] })).toEqual([
      'src/a.css',
      'src/b.tsx',
    ])
    expect(auditFiles(dir, ['src'], { languages: ['css'], skip: ['src/gen'] })).toEqual([
      'src/a.css',
      'src/legacy/old.css',
    ])
  })
})

const finding = (line: number, value = '#fff'): Finding => ({
  file: 'src/a.css',
  line,
  column: 3,
  value,
  kind: 'color',
  context: 'color',
  token: 'bg',
})

describe('baseline', () => {
  it('accepts recorded findings wherever they move, and reports new ones', () => {
    const baseline = baselineOf([finding(1), finding(2, '#000')]).findings
    expect(newFindings([finding(10), finding(20, '#000')], baseline)).toEqual([])
    // A second #fff is new: each baseline entry covers one finding.
    expect(newFindings([finding(10), finding(11), finding(20, '#000')], baseline)).toEqual([
      finding(11),
    ])
  })
})
