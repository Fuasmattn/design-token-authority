#!/usr/bin/env node
/**
 * TICKET-035: Capture snapshot outputs from the legacy pipeline.
 *
 * Runs the frozen legacy CLI (src/cli.ts) against every fixture project in
 * test/fixtures/ for a fixed list of scenarios and stores, per scenario:
 *
 *   <out>/<fixture>/<scenario>/stdout.txt      normalized stdout
 *   <out>/<fixture>/<scenario>/stderr.txt      normalized stderr (only if non-empty)
 *   <out>/<fixture>/<scenario>/exit-code.txt   process exit code
 *   <out>/<fixture>/<scenario>/files/**        every file the command created
 *
 * Usage:
 *   node scripts/snapshots/capture-legacy.mjs              regenerate test/snapshots/
 *   node scripts/snapshots/capture-legacy.mjs --check      capture to a temp dir and diff against test/snapshots/
 *   node scripts/snapshots/capture-legacy.mjs --out <dir>  capture into <dir>
 *   node scripts/snapshots/capture-legacy.mjs --fixture brand-ab   limit to one fixture
 *
 * The output is deterministic: ANSI/cursor codes are stripped, absolute paths are
 * replaced with placeholders, the locale is pinned, and every scenario runs in a
 * fresh copy of the fixture so scenarios cannot affect each other.
 */

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixturesRoot = path.join(repoRoot, 'test', 'fixtures')
const defaultOut = path.join(repoRoot, 'test', 'snapshots')
const legacyCli = path.join(repoRoot, 'src', 'cli.ts')
const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href

/** Scenarios run against every fixture. `args` are legacy CLI arguments. */
const SCENARIOS = [
  { name: 'build', args: ['build'] },
  { name: 'lint', args: ['lint'] },
  { name: 'graph-console', args: ['graph'] },
  { name: 'graph-dot', args: ['graph', '--format', 'dot'] },
  { name: 'graph-markdown', args: ['graph', '--format', 'markdown'] },
  { name: 'graph-html', args: ['graph', '--format', 'html', '--output', 'graph.html'] },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function listFiles(dir, base = dir) {
  const result = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) result.push(...listFiles(full, base))
    else result.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return result.sort()
}

/**
 * Reduce raw terminal output to what a terminal would finally show.
 *
 * The spinner library redraws its line with "cursor to column 1 + erase line"
 * (ESC[1G ESC[J) and only emits intermediate frames when a phase happens to take
 * longer than one animation tick. Piped, those frames pile up in front of the
 * final line, which makes stdout timing-dependent. Dropping the text that gets
 * redrawn yields the same output regardless of speed. All remaining ANSI
 * sequences (colors, cursor show/hide) are then stripped.
 */
function stripAnsi(text) {
  return text.replace(/[^\n]*\u001b\[1G\u001b\[J/g, '').replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
}

/** Replace machine-specific absolute paths and normalize line endings. */
function normalize(text, workDir) {
  let result = stripAnsi(text).replace(/\r\n/g, '\n')
  // realpath variant first (macOS /var -> /private/var)
  const variants = new Set([workDir, fs.realpathSync(workDir)])
  for (const v of variants) result = result.split(v).join('<cwd>')
  result = result.split(repoRoot).join('<repo>')
  return result
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

/** Directory with no-op `open` / `xdg-open` so `graph --format html` never launches a browser. */
function makeStubBin(root) {
  const bin = path.join(root, 'stub-bin')
  fs.mkdirSync(bin, { recursive: true })
  for (const name of ['open', 'xdg-open', 'start']) {
    const file = path.join(bin, name)
    fs.writeFileSync(file, '#!/bin/sh\nexit 0\n')
    fs.chmodSync(file, 0o755)
  }
  return bin
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

function captureScenario({ fixture, scenario, outDir, tmpRoot, stubBin }) {
  const workDir = fs.mkdtempSync(path.join(tmpRoot, `${fixture}-${scenario.name}-`))
  fs.cpSync(path.join(fixturesRoot, fixture), workDir, { recursive: true })
  const before = new Set(listFiles(workDir))

  const env = {
    ...process.env,
    PATH: `${stubBin}${path.delimiter}${process.env.PATH ?? ''}`,
    LC_ALL: 'en_US.UTF-8',
    LANG: 'en_US.UTF-8',
    TZ: 'UTC',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    CI: '1',
  }
  delete env.FIGMA_PERSONAL_ACCESS_TOKEN
  delete env.FIGMA_FILE_KEY

  const run = spawnSync(process.execPath, ['--import', tsxLoader, legacyCli, ...scenario.args], {
    cwd: workDir,
    env,
    encoding: 'utf-8',
    timeout: 120_000,
  })
  if (run.error) throw run.error

  const target = path.join(outDir, fixture, scenario.name)
  fs.rmSync(target, { recursive: true, force: true })
  writeFile(path.join(target, 'stdout.txt'), normalize(run.stdout ?? '', workDir))
  const stderr = normalize(run.stderr ?? '', workDir)
  if (stderr.trim() !== '') writeFile(path.join(target, 'stderr.txt'), stderr)
  writeFile(path.join(target, 'exit-code.txt'), `${run.status}\n`)

  const created = listFiles(workDir).filter((f) => !before.has(f))
  for (const rel of created) {
    const raw = fs.readFileSync(path.join(workDir, rel))
    // Text files are normalized (paths, line endings); the legacy pipeline only writes text.
    writeFile(path.join(target, 'files', rel), normalize(raw.toString('utf-8'), workDir))
  }

  fs.rmSync(workDir, { recursive: true, force: true })
  return { exitCode: run.status, files: created.length }
}

function captureAll(outDir, onlyFixture) {
  const fixtures = fs
    .readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !onlyFixture || name === onlyFixture)
    .sort()
  if (fixtures.length === 0) throw new Error(`No fixtures found in ${fixturesRoot}`)

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-snapshot-'))
  const stubBin = makeStubBin(tmpRoot)
  try {
    for (const fixture of fixtures) {
      for (const scenario of SCENARIOS) {
        const r = captureScenario({ fixture, scenario, outDir, tmpRoot, stubBin })
        console.log(
          `${fixture.padEnd(10)} ${scenario.name.padEnd(15)} exit=${r.exitCode} files=${r.files}`,
        )
      }
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }
  return fixtures
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2)
  const flag = (name) => args.indexOf(name)
  const valueOf = (name) => (flag(name) >= 0 ? args[flag(name) + 1] : undefined)

  const onlyFixture = valueOf('--fixture')
  if (args.includes('--check')) {
    const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-snapshot-check-'))
    try {
      captureAll(tmpOut, onlyFixture)
      const expected = new Set(listFiles(defaultOut).filter((f) => f.split('/').length > 2))
      const actual = new Set(listFiles(tmpOut))
      const problems = []
      for (const f of actual) {
        if (!expected.has(f)) problems.push(`new      ${f}`)
        else if (
          !fs.readFileSync(path.join(tmpOut, f)).equals(fs.readFileSync(path.join(defaultOut, f)))
        )
          problems.push(`changed  ${f}`)
      }
      for (const f of expected) {
        const inScope = !onlyFixture || f.startsWith(`${onlyFixture}/`)
        if (inScope && !actual.has(f)) problems.push(`missing  ${f}`)
      }
      if (problems.length > 0) {
        console.error(`\nSnapshots differ from the legacy pipeline:\n  ${problems.join('\n  ')}`)
        process.exit(1)
      }
      console.log('\nSnapshots are up to date.')
    } finally {
      fs.rmSync(tmpOut, { recursive: true, force: true })
    }
    return
  }

  const outDir = path.resolve(valueOf('--out') ?? defaultOut)
  captureAll(outDir, onlyFixture)
  console.log(`\nSnapshots written to ${path.relative(repoRoot, outDir) || '.'}`)
}

main()
