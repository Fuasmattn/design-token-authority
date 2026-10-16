/**
 * CLI-seam snapshot test: runs the CLI against every fixture project and compares stdout,
 * exit code and written files with the reference snapshots in test/snapshots/ (recorded from
 * the v1 CLI to prove parity; see test/snapshots/README.md). A difference is a bug unless it
 * is an intentional change, re-recorded on purpose with `pnpm snapshot:record` and reviewed.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, it } from 'vitest'
import {
  captureScenario,
  compareSnapshot,
  listFixtures,
  readSnapshot,
  SCENARIOS,
  scenariosFor,
  type CliCommand,
} from '@dta/testkit'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const fixturesRoot = path.join(repoRoot, 'test', 'fixtures')
const snapshotsRoot = path.join(repoRoot, 'test', 'snapshots')

const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href
const cli: CliCommand = {
  command: process.execPath,
  args: ['--import', tsxLoader, path.join(repoRoot, 'packages', 'cli', 'src', 'bin.ts')],
}

describe.each(listFixtures(fixturesRoot))('fixture %s', (fixture) => {
  it.each(scenariosFor(fixture).map((s) => s.name))('%s', async (name) => {
    const scenario = SCENARIOS.find((s) => s.name === name)!
    const expected = readSnapshot(path.join(snapshotsRoot, fixture, name))
    if (expected === null) {
      throw new Error(
        `No snapshot recorded for ${fixture}/${name}. Record it on purpose with ` +
          `"pnpm snapshot:record --scenario ${fixture}/${name}" and review the result.`,
      )
    }

    const actual = await captureScenario({
      fixtureDir: path.join(fixturesRoot, fixture),
      scenario,
      cli,
      repoRoot,
    })
    const mismatches = compareSnapshot(expected, actual)
    if (mismatches.length > 0) {
      throw new Error(
        `Output differs from the recorded snapshot (test/snapshots/${fixture}/${name}):\n\n` +
          mismatches.join('\n\n'),
      )
    }
  })
})
