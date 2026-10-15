/**
 * CLI-seam parity test: runs the new CLI against every fixture project and compares
 * stdout, exit code and written files with the snapshots recorded from the legacy
 * pipeline (`pnpm snapshot:capture`, see test/snapshots/README.md).
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  captureScenario,
  compareSnapshot,
  listFixtures,
  readSnapshot,
  SCENARIOS,
  type CliCommand,
} from '@dta/testkit'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const fixturesRoot = path.join(repoRoot, 'test', 'fixtures')
const snapshotsRoot = path.join(repoRoot, 'test', 'snapshots')

const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href
const newCli: CliCommand = {
  command: process.execPath,
  args: ['--import', tsxLoader, path.join(repoRoot, 'packages', 'cli', 'src', 'bin.ts')],
}

/**
 * Scenarios the new CLI does not reproduce yet. They still run, and must NOT match:
 * a pending scenario that already passes fails the suite, so the list cannot go stale.
 *
 * Porting a command? Remove its scenarios from this list. From then on the new output
 * must match the snapshots exactly (or the snapshots are updated on purpose, in the
 * same PR, to document an intentional change).
 */
const PENDING: ReadonlySet<string> = new Set([
  'build',
  'lint',
  'graph-console',
  'graph-dot',
  'graph-markdown',
  'graph-html',
])

describe('pending list', () => {
  it('only names scenarios that exist', () => {
    const known = new Set(SCENARIOS.map((s) => s.name))
    expect([...PENDING].filter((name) => !known.has(name))).toEqual([])
  })
})

describe.each(listFixtures(fixturesRoot))('fixture %s', (fixture) => {
  it.each(SCENARIOS.map((s) => s.name))('%s', async (name) => {
    const scenario = SCENARIOS.find((s) => s.name === name)!
    const expected = readSnapshot(path.join(snapshotsRoot, fixture, name))
    if (expected === null) {
      throw new Error(`No snapshot recorded for ${fixture}/${name}. Run "pnpm snapshot:capture".`)
    }

    const actual = await captureScenario({
      fixtureDir: path.join(fixturesRoot, fixture),
      scenario,
      cli: newCli,
      repoRoot,
    })
    const mismatches = compareSnapshot(expected, actual)

    if (PENDING.has(name)) {
      expect(
        mismatches.length,
        `"${name}" already matches the legacy snapshots. Remove it from PENDING in test/snapshots.test.ts.`,
      ).toBeGreaterThan(0)
    } else if (mismatches.length > 0) {
      throw new Error(`Output differs from the legacy snapshots:\n\n${mismatches.join('\n\n')}`)
    }
  })
})
