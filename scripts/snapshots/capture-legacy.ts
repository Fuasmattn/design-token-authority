/**
 * Record (or verify) snapshots of the frozen legacy pipeline.
 *
 * Runs the legacy CLI (src/cli.ts) against every fixture project in test/fixtures/
 * for each scenario of @dta/testkit and stores the normalized result in
 * test/snapshots/<fixture>/<scenario>/.
 *
 *   pnpm snapshot:capture                    regenerate test/snapshots/
 *   pnpm snapshot:check                      re-capture and fail on any difference
 *   ... --out <dir>                          capture into <dir> instead
 *   ... --fixture brand-ab                   limit to one fixture
 */

import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  captureScenario,
  compareSnapshot,
  listFixtures,
  readSnapshot,
  SCENARIOS,
  writeSnapshot,
  type CliCommand,
} from '@dta/testkit'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixturesRoot = path.join(repoRoot, 'test', 'fixtures')
const snapshotsRoot = path.join(repoRoot, 'test', 'snapshots')

const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href
const legacyCli: CliCommand = {
  command: process.execPath,
  args: ['--import', tsxLoader, path.join(repoRoot, 'src', 'cli.ts')],
}

function parseArgs(argv: string[]) {
  const valueOf = (name: string) => {
    const index = argv.indexOf(name)
    return index >= 0 ? argv[index + 1] : undefined
  }
  return {
    check: argv.includes('--check'),
    out: valueOf('--out'),
    fixture: valueOf('--fixture'),
  }
}

function main(): void {
  const { check, out, fixture: onlyFixture } = parseArgs(process.argv.slice(2))
  const outRoot = path.resolve(out ?? snapshotsRoot)

  const fixtures = listFixtures(fixturesRoot).filter((name) => !onlyFixture || name === onlyFixture)
  if (fixtures.length === 0) throw new Error(`No fixtures found in ${fixturesRoot}`)

  const problems: string[] = []
  for (const fixture of fixtures) {
    for (const scenario of SCENARIOS) {
      const result = captureScenario({
        fixtureDir: path.join(fixturesRoot, fixture),
        scenario,
        cli: legacyCli,
        repoRoot,
      })
      console.log(
        `${fixture.padEnd(10)} ${scenario.name.padEnd(15)} exit=${result.exitCode} files=${Object.keys(result.files).length}`,
      )

      const dir = path.join(outRoot, fixture, scenario.name)
      if (check) {
        const expected = readSnapshot(dir)
        if (expected === null) problems.push(`${fixture}/${scenario.name}: no snapshot recorded`)
        else {
          for (const m of compareSnapshot(expected, result)) {
            problems.push(`${fixture}/${scenario.name}: ${m}`)
          }
        }
      } else {
        writeSnapshot(dir, result)
      }
    }
  }

  if (check) {
    if (problems.length > 0) {
      console.error(`\nSnapshots differ from the legacy pipeline:\n\n${problems.join('\n\n')}`)
      process.exit(1)
    }
    console.log('\nSnapshots are up to date.')
  } else {
    console.log(`\nSnapshots written to ${path.relative(repoRoot, outRoot) || '.'}`)
  }
}

main()
