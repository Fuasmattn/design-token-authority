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
  scenariosFor,
  type CliCommand,
  type ScenarioResult,
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
const PENDING: ReadonlySet<string> = new Set([])

/**
 * Reviewed, intentional differences from the legacy output (see the quirk table in
 * docs/tickets/039-legacy-removal.md). The recorded snapshots stay untouched, because
 * `pnpm snapshot:check` re-records them from the legacy CLI; the change is applied to the
 * expected stdout here, in one visible place. An entry that no longer applies fails the suite.
 */
const INTENDED_CHANGES: ReadonlyArray<{
  scenario: string
  /** Turns the recorded legacy result into the result the new CLI should produce. */
  apply: (expected: ScenarioResult) => ScenarioResult
}> = [
  ...[
    'push-up-to-date',
    'push-dry-run',
    'push-dry-run-markdown',
    'push-dry-run-json',
    'push-yes',
  ].map((scenario) => ({
    // Leftover debug output of the legacy payload generator.
    scenario,
    apply: (expected: ScenarioResult) =>
      replaceInStdout(
        expected,
        "Local variable collections in Figma file: [ 'Primitives', 'Brand(Alias)', 'ScreenType' ]\n",
        '',
      ),
  })),
  {
    // Legacy prints a path the build never writes to; the file is in output/js/.
    scenario: 'build',
    apply: (expected) =>
      replaceInStdout(expected, '|  build/js/colorpalette.js ', '|  output/js/colorpalette.js'),
  },
  {
    // Legacy wrote token files without a final newline; new files now end with one.
    scenario: 'pull-api',
    apply: (expected) => ({
      ...expected,
      files: Object.fromEntries(
        Object.entries(expected.files).map(([name, content]) => [name, content + '\n']),
      ),
    }),
  },
]

function replaceInStdout(expected: ScenarioResult, from: string, to: string): ScenarioResult {
  if (!expected.stdout.includes(from)) {
    throw new Error(`Intended change no longer applies: ${JSON.stringify(from)}`)
  }
  return { ...expected, stdout: expected.stdout.replace(from, to) }
}

function applyIntendedChanges(scenario: string, expected: ScenarioResult): ScenarioResult {
  return INTENDED_CHANGES.filter((change) => change.scenario === scenario).reduce(
    (result, change) => change.apply(result),
    expected,
  )
}

describe('pending list', () => {
  it('only names scenarios that exist', () => {
    const known = new Set(SCENARIOS.map((s) => s.name))
    expect([...PENDING].filter((name) => !known.has(name))).toEqual([])
  })
})

describe.each(listFixtures(fixturesRoot))('fixture %s', (fixture) => {
  it.each(scenariosFor(fixture).map((s) => s.name))('%s', async (name) => {
    const scenario = SCENARIOS.find((s) => s.name === name)!
    const recorded = readSnapshot(path.join(snapshotsRoot, fixture, name))
    if (recorded === null) {
      throw new Error(`No snapshot recorded for ${fixture}/${name}. Run "pnpm snapshot:capture".`)
    }
    const expected = applyIntendedChanges(name, recorded)

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
