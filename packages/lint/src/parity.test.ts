import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintTokens } from './index.js'
import type { LintViolation } from './index.js'
import { fixtureModel, repoRoot } from './test-helpers.js'

/** The lint section of `test/fixtures/brand-ab/dta.config.ts`. */
const brandAbConfig = {
  rules: {
    'semantic-must-alias': { severity: 'error', collections: ['Brand(Alias)', 'ScreenType'] },
    'naming-pattern': { severity: 'warn', patterns: { 'Brand(Alias)': '^[A-Z][A-Za-z ]*$' } },
    'color-contrast': {
      severity: 'warn',
      minRatio: 4.5,
      pairs: [
        ['Colors.Text.Default', 'Colors.Surface.Default'],
        ['Colors.Text.On Primary', 'Colors.Brand.Primary'],
        ['Colors.Text.Muted', 'Colors.Surface.Muted'],
      ],
    },
    'no-duplicate-values': { severity: 'warn' },
  },
}

type Line = { file: string; severity: string; text: string }

/** Reads the violations out of a v1 `dta lint` snapshot, with the file each belongs to. */
function readSnapshot(fixture: string): { lines: Line[]; summary: string } {
  const text = fs.readFileSync(
    path.join(repoRoot, 'test', 'snapshots', fixture, 'lint', 'stdout.txt'),
    'utf8',
  )
  const lines: Line[] = []
  let file = ''
  let summary = ''
  for (const raw of text.split('\n')) {
    const header = /^\|  (\S.*\.json)$/.exec(raw)
    if (header) file = header[1]
    const entry = /^\|    (error|warn) (.*)$/.exec(raw)
    if (entry) lines.push({ file, severity: entry[1], text: entry[2] })
    const total = /^\|  (\d+ (?:errors?|warnings?) found.*)$/.exec(raw)
    if (total) summary = total[1]
  }
  return { lines, summary }
}

const asLines = (violations: LintViolation[]): Line[] =>
  violations.map((v) => ({
    file: v.file,
    severity: v.severity,
    text: `${v.message} [${v.rule}]`,
  }))

const byFile = (lines: Line[]) => [...lines].sort((a, b) => a.file.localeCompare(b.file, 'en'))

describe.each([
  ['brand-ab', brandAbConfig],
  ['daisyui', undefined],
])('parity with the v1 lint snapshot: %s', (fixture, config) => {
  const snapshot = readSnapshot(fixture)
  const result = lintTokens(fixtureModel(fixture), config)

  it('reports the same violations per file, with the same rule, severity and message', () => {
    expect(byFile(asLines(result.violations))).toEqual(byFile(snapshot.lines))
  })

  it('has the same counts as the summary line', () => {
    expect(snapshot.lines.length).toBeGreaterThan(0)
    expect(result.violations).toHaveLength(snapshot.lines.length)
    const errors = snapshot.lines.filter((l) => l.severity === 'error').length
    expect(result.errorCount).toBe(errors)
    expect(result.warningCount).toBe(snapshot.lines.length - errors)
    expect(result.diagnostics).toEqual([])
  })

  it('lists files in the same order (the snapshot is the authority)', () => {
    const files = (lines: Line[]) => [...new Set(lines.map((l) => l.file))]
    expect(files(asLines(result.violations))).toEqual(files(snapshot.lines))
  })
})

describe('malformed configs never throw', () => {
  const model = fixtureModel('brand-ab')
  const configs: unknown[] = [
    42,
    'rules',
    [],
    { rules: 'all' },
    { rules: [] },
    { rules: { 'made-up': {} } },
    { rules: { 'naming-pattern': { patterns: 'x' } } },
    { rules: { 'naming-pattern': { patterns: { 'Brand(Alias)': '(' } } } },
    { rules: { 'color-contrast': { minRatio: -1, pairs: 'x' } } },
    { rules: { 'semantic-must-alias': { collections: [1] } } },
    { rules: { 'no-duplicate-values': { severity: 'loud' } } },
    { extra: true },
  ]

  it.each(configs.map((c) => [JSON.stringify(c), c]))('%s', (_label, config) => {
    const result = lintTokens(model, config)
    expect(result.diagnostics.length).toBeGreaterThan(0)
    expect(result.diagnostics.every((d) => d.severity === 'error')).toBe(true)
  })
})
