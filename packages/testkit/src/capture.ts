import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startFigmaFake, type FigmaFake } from './figma-fake.js'
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
  { name: 'clean', args: ['clean'] },
  {
    name: 'analyze',
    args: ['analyze'],
    fixtures: ['brand-ab'],
    figma: { fileKey: 'FAKEFILEKEY', token: 'fake-token' },
  },
  {
    name: 'pull-api',
    args: ['pull', '--output', 'pulled'],
    fixtures: ['brand-ab'],
    figma: { fileKey: 'FAKEFILEKEY', token: 'fake-token' },
  },
  {
    name: 'diff-tokens',
    args: ['diff', '--tokens-only', '--base', 'tokens-base', '--format', 'markdown'],
    fixtures: ['brand-ab'],
  },
  {
    name: 'pull-from-file',
    args: ['pull', '--from-file', 'tokens/Primitives.Value.json', '--output', 'pulled'],
    fixtures: ['brand-ab'],
  },
  {
    name: 'push-up-to-date',
    args: ['push', '--dry-run'],
    fixtures: ['brand-ab'],
    figma: { fileKey: 'FAKEFILEKEY', token: 'fake-token' },
  },
  {
    name: 'push-dry-run',
    args: ['push', '--dry-run'],
    fixtures: ['brand-ab'],
    figma: {
      fileKey: 'FAKEFILEKEY',
      token: 'fake-token',
      recording: 'variables-local.drifted.json',
    },
  },
  {
    name: 'push-dry-run-markdown',
    args: ['push', '--dry-run', '--format', 'markdown'],
    fixtures: ['brand-ab'],
    figma: {
      fileKey: 'FAKEFILEKEY',
      token: 'fake-token',
      recording: 'variables-local.drifted.json',
    },
  },
  {
    name: 'push-dry-run-json',
    args: ['push', '--dry-run', '--format', 'json'],
    fixtures: ['brand-ab'],
    figma: {
      fileKey: 'FAKEFILEKEY',
      token: 'fake-token',
      recording: 'variables-local.drifted.json',
    },
  },
  {
    name: 'token-get',
    args: ['token', 'get', 'Colors.Brand.Primary'],
    fixtures: ['brand-ab'],
  },
  {
    name: 'token-get-json',
    args: ['token', 'get', 'Colors.Brand.Primary', '--format', 'json'],
    fixtures: ['brand-ab'],
  },
  {
    name: 'token-get-unknown',
    args: ['token', 'get', 'Colors.Brand.Primay'],
    fixtures: ['brand-ab'],
  },
  { name: 'token-find', args: ['token', 'find', '#003f8a'], fixtures: ['brand-ab'] },
  {
    name: 'token-find-json',
    args: ['token', 'find', '16', '--format', 'json'],
    fixtures: ['brand-ab'],
  },
  { name: 'token-list', args: ['token', 'list', '--match', 'Colors.**'], fixtures: ['brand-ab'] },
  { name: 'skill-add', args: ['skill', 'add'], fixtures: ['brand-ab'] },
  {
    name: 'push-yes',
    args: ['push', '--yes'],
    fixtures: ['brand-ab'],
    figma: {
      fileKey: 'FAKEFILEKEY',
      token: 'fake-token',
      recording: 'variables-local.drifted.json',
    },
  },
]

/** The scenarios that apply to a fixture project. */
export function scenariosFor(fixture: string): readonly Scenario[] {
  return SCENARIOS.filter((scenario) => !scenario.fixtures || scenario.fixtures.includes(fixture))
}

/** Name of the generated config file used by scenarios that talk to the Figma fake. */
const GENERATED_CONFIG = 'dta.snapshot.config.ts'

/** Preload that redirects requests for api.figma.com to the fake (see figma-redirect.mjs). */
const FIGMA_REDIRECT_URL = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'figma-redirect.mjs'),
).href

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

interface RunResult {
  stdout: string
  stderr: string
  status: number
}

/** Run a command to completion, collecting its output. Never blocks the event loop. */
function run(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number; label: string },
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`"${options.label}" timed out after ${options.timeoutMs} ms`))
    }, options.timeoutMs)

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (code === null) reject(new Error(`"${options.label}" was terminated by ${signal}`))
      else {
        resolve({
          stdout: Buffer.concat(stdout).toString('utf-8'),
          stderr: Buffer.concat(stderr).toString('utf-8'),
          status: code,
        })
      }
    })
  })
}

/**
 * Run one CLI invocation against a fresh copy of a fixture project and return its
 * normalized, machine-independent behaviour: stdout, stderr, exit code and the
 * files the command created.
 */
export async function captureScenario(options: CaptureOptions): Promise<ScenarioResult> {
  const { fixtureDir, scenario, cli, repoRoot, timeoutMs = 120_000 } = options

  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-snapshot-')))
  const workDir = path.join(root, 'work')
  let fake: FigmaFake | undefined
  try {
    fs.cpSync(fixtureDir, workDir, { recursive: true })
    const figma = scenario.figma
    if (figma) {
      fs.writeFileSync(
        path.join(workDir, GENERATED_CONFIG),
        [
          "import base from './dta.config.ts'",
          'export default {',
          '  ...base,',
          `  figma: { ...base.figma, source: 'api', fileKey: '${figma.fileKey}', personalAccessToken: '${figma.token}' },`,
          '}',
          '',
        ].join('\n'),
      )
    }
    const before = new Set(listFiles(workDir))
    const fixtureName = path.basename(fixtureDir)
    fake = figma
      ? await startFigmaFake({
          files: {
            [figma.fileKey]: JSON.parse(
              fs.readFileSync(
                path.join(
                  repoRoot,
                  'test',
                  'recordings',
                  fixtureName,
                  figma.recording ?? 'variables-local.json',
                ),
                'utf-8',
              ),
            ),
          },
          token: figma.token,
        })
      : undefined

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${makeStubBin(path.join(root, 'bin'))}${path.delimiter}${process.env.PATH ?? ''}`,
      LC_ALL: 'en_US.UTF-8',
      LANG: 'en_US.UTF-8',
      TZ: 'UTC',
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      CI: '1',
      // Terminal UI libraries pick unicode or ASCII symbols from TERM (`linux` means ASCII).
      // The recorded snapshots use the ASCII form, so pin it for every machine.
      TERM: 'linux',
    }
    delete env.FIGMA_PERSONAL_ACCESS_TOKEN
    delete env.FIGMA_FILE_KEY

    const figmaApiUrl = options.figmaApiUrl ?? fake?.url
    if (figmaApiUrl !== undefined) {
      env.DTA_FIGMA_API_URL = figmaApiUrl
      // Requests must reach the fake directly. An environment proxy (common in CI and
      // sandboxes) would make the HTTP client address the proxy instead of api.figma.com.
      for (const name of Object.keys(env)) {
        if (/^(https?|all)_proxy$/i.test(name)) delete env[name]
      }
      env.NO_PROXY = '*'
      env.no_proxy = '*'
      const preload = `--import=${FIGMA_REDIRECT_URL}`
      env.NODE_OPTIONS = [process.env.NODE_OPTIONS, preload].filter(Boolean).join(' ')
    }

    const args = figma ? [...scenario.args, '--config', GENERATED_CONFIG] : scenario.args
    const result = await run(cli.command, [...cli.args, ...args], {
      cwd: workDir,
      env,
      timeoutMs,
      label: scenario.name,
    })

    const normalize = (text: string) => normalizeOutput(text, workDir, repoRoot)
    const files: Record<string, string> = {}
    for (const name of listFiles(workDir).filter((f) => !before.has(f))) {
      // The pipelines under test only write text files.
      files[name] = normalize(fs.readFileSync(path.join(workDir, name), 'utf-8'))
    }
    return {
      stdout: normalize(result.stdout),
      stderr: normalize(result.stderr),
      exitCode: result.status,
      files,
    }
  } finally {
    await fake?.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
}
