/**
 * Re-record named snapshot scenarios from the CLI (packages/cli).
 *
 * The snapshots in test/snapshots/ were recorded from the v1 CLI and proved parity of the
 * rewrite. They are reference outputs: a failing snapshot test means the output changed, and
 * the fix is in the code, not here. Use this script only for an intentional, reviewed output
 * change, and name every scenario it may touch; the resulting diff is part of the PR.
 *
 *   pnpm snapshot:record --scenario brand-ab/build
 *   pnpm snapshot:record --scenario brand-ab/build --scenario daisyui/build
 *
 * There is deliberately no "record everything" mode.
 */

import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  captureScenario,
  listFixtures,
  scenariosFor,
  writeSnapshot,
  type CliCommand,
} from '@dta/testkit'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixturesRoot = path.join(repoRoot, 'test', 'fixtures')
const snapshotsRoot = path.join(repoRoot, 'test', 'snapshots')

const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href
const cli: CliCommand = {
  command: process.execPath,
  args: ['--import', tsxLoader, path.join(repoRoot, 'packages', 'cli', 'src', 'bin.ts')],
}

function requestedScenarios(argv: string[]): string[] {
  const names: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--scenario' && argv[i + 1]) names.push(argv[++i])
    else throw new Error(`Unknown argument: ${argv[i]}`)
  }
  return names
}

function available(): string[] {
  return listFixtures(fixturesRoot).flatMap((fixture) =>
    scenariosFor(fixture).map((s) => `${fixture}/${s.name}`),
  )
}

async function main(): Promise<void> {
  const requested = requestedScenarios(process.argv.slice(2))
  const known = available()
  if (requested.length === 0) {
    console.error(
      'Name the scenarios to re-record, e.g. --scenario brand-ab/build\n\n' +
        `Available:\n  ${known.join('\n  ')}`,
    )
    process.exit(1)
  }
  const unknown = requested.filter((name) => !known.includes(name))
  if (unknown.length > 0) {
    console.error(
      `Unknown scenario(s): ${unknown.join(', ')}\n\nAvailable:\n  ${known.join('\n  ')}`,
    )
    process.exit(1)
  }

  for (const name of requested) {
    const [fixture, scenarioName] = name.split('/')
    const scenario = scenariosFor(fixture).find((s) => s.name === scenarioName)!
    const result = await captureScenario({
      fixtureDir: path.join(fixturesRoot, fixture),
      scenario,
      cli,
      repoRoot,
    })
    writeSnapshot(path.join(snapshotsRoot, fixture, scenarioName), result)
    console.log(
      `${name.padEnd(30)} exit=${result.exitCode} files=${Object.keys(result.files).length}`,
    )
  }
  console.log('\nReview the diff in test/snapshots/ before committing.')
}

await main()
