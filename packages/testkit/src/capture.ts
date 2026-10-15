import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { normalizeOutput } from './normalize.js'
import { listFiles } from './store.js'
import type { CaptureOptions, Scenario, ScenarioResult } from './types.js'

/** The CLI invocations every fixture is run with. */
export const SCENARIOS: readonly Scenario[] = [
  { name: 'build', args: ['build'] },
  { name: 'lint', args: ['lint'] },
  { name: 'graph-console', args: ['graph'] },
  { name: 'graph-dot', args: ['graph', '--format', 'dot'] },
  { name: 'graph-markdown', args: ['graph', '--format', 'markdown'] },
  { name: 'graph-html', args: ['graph', '--format', 'html', '--output', 'graph.html'] },
]

/** Directory with no-op `open` / `xdg-open` so `graph --format html` never launches a browser. */
function makeStubBin(dir: string): string {
  fs.mkdirSync(dir, { recursive: true })
  for (const name of ['open', 'xdg-open', 'start']) {
    const file = path.join(dir, name)
    fs.writeFileSync(file, '#!/bin/sh\nexit 0\n')
    fs.chmodSync(file, 0o755)
  }
  return dir
}

/**
 * Run one CLI invocation against a fresh copy of a fixture project and return its
 * normalized, machine-independent behaviour: stdout, stderr, exit code and the
 * files the command created.
 */
export function captureScenario(options: CaptureOptions): ScenarioResult {
  const { fixtureDir, scenario, cli, repoRoot, timeoutMs = 120_000 } = options

  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-snapshot-')))
  const workDir = path.join(root, 'work')
  try {
    fs.cpSync(fixtureDir, workDir, { recursive: true })
    const before = new Set(listFiles(workDir))

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${makeStubBin(path.join(root, 'bin'))}${path.delimiter}${process.env.PATH ?? ''}`,
      LC_ALL: 'en_US.UTF-8',
      LANG: 'en_US.UTF-8',
      TZ: 'UTC',
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      CI: '1',
    }
    delete env.FIGMA_PERSONAL_ACCESS_TOKEN
    delete env.FIGMA_FILE_KEY

    const run = spawnSync(cli.command, [...cli.args, ...scenario.args], {
      cwd: workDir,
      env,
      encoding: 'utf-8',
      timeout: timeoutMs,
      // Node's default (1 MB) is too small for a large token set's graph output.
      maxBuffer: 256 * 1024 * 1024,
    })
    if (run.error) throw run.error
    if (run.status === null) {
      throw new Error(`"${scenario.name}" was terminated by ${run.signal ?? 'a signal'}`)
    }

    const normalize = (text: string) => normalizeOutput(text, workDir, repoRoot)
    const files: Record<string, string> = {}
    for (const name of listFiles(workDir).filter((f) => !before.has(f))) {
      // The pipelines under test only write text files.
      files[name] = normalize(fs.readFileSync(path.join(workDir, name), 'utf-8'))
    }
    return {
      stdout: normalize(run.stdout ?? ''),
      stderr: normalize(run.stderr ?? ''),
      exitCode: run.status,
      files,
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}
