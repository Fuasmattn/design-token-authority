import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { loadConfig } from '../config/load.js'
import { runCli } from '../index.js'

let dir: string
const browserPath = process.env.DTA_BROWSER_PATH

const put = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  fs.writeFileSync(path.join(dir, file), content)
}
const read = (file: string) => fs.readFileSync(path.join(dir, file), 'utf8')
const git = (...args: string[]) =>
  execFileSync('git', args, {
    cwd: dir,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'T',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'T',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
  })
// eslint-disable-next-line no-control-regex
const plain = (text: string) => text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')

const CONFIG = `import { defineConfig } from 'design-token-authority'

export default defineConfig({
  figma: {
    source: 'file',
  },

  tokens: {
    dir: 'tokens',
  },
})
`

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-init-diff-')))
  // The config imports 'design-token-authority', which a real project has installed.
  put(
    'node_modules/design-token-authority/package.json',
    JSON.stringify({ name: 'design-token-authority', type: 'module', exports: './index.js' }),
  )
  put(
    'node_modules/design-token-authority/index.js',
    'export const defineConfig = (config) => config\n',
  )
  put('dta.config.ts', CONFIG)
  put(
    'package.json',
    JSON.stringify({
      scripts: { 'build-storybook': 'storybook build' },
      devDependencies: { 'playwright-core': '^1.59.1' },
    }),
  )
  put('package-lock.json', '{}')
  put('.nvmrc', '22\n')
  put('.storybook/main.js', 'export default {}')
  git('init', '-q', '-b', 'main')
  git('remote', 'add', 'origin', 'git@github.com:acme/site.git')
  // A browser is there: init has nothing to install.
  process.env.DTA_BROWSER_PATH = process.execPath
})
afterEach(() => {
  if (browserPath === undefined) delete process.env.DTA_BROWSER_PATH
  else process.env.DTA_BROWSER_PATH = browserPath
  fs.rmSync(dir, { recursive: true, force: true })
})

async function initDiff(args: string[] = ['--yes'], answers: Array<[string, string]> = []) {
  let stdout = ''
  const input = new PassThrough()
  let next = 0
  const exitCode = await runCli(['init', '--diff', ...args], {
    cwd: dir,
    stdout: (text) => {
      stdout += text
      const step = answers[next]
      if (step && plain(stdout).includes(step[0])) {
        next += 1
        setTimeout(() => input.write(`${step[1]}\r`), 50)
      }
    },
    stderr: () => undefined,
    input,
  })
  return { exitCode, stdout: plain(stdout) }
}

describe('dta init --diff (TICKET-131)', () => {
  it('detects the project, prints where from, and writes the section and the workflow', async () => {
    const { exitCode, stdout } = await initDiff()
    expect(exitCode).toBe(0)
    expect(stdout).toContain(
      'Storybook        build-storybook → storybook-static, from the "build-storybook" script',
    )
    expect(stdout).toContain('Package manager  npm, from package-lock.json')
    expect(stdout).toContain('Node             22, from .nvmrc')
    expect(stdout).toContain('Git host         GitHub, from the origin remote')
    const { config } = await loadConfig({ cwd: dir })
    expect(config?.diff).toMatchObject({
      build: 'npx dta build && npm run build-storybook',
      outDir: 'storybook-static',
      stories: { type: 'storybook' },
      // Not asked with --yes: the setup that is safe for pull requests from forks.
      workflow: 'split',
    })
    expect(fs.readdirSync(path.join(dir, '.github', 'workflows')).sort()).toEqual([
      'dta-diff-approve.yml',
      'dta-diff-report.yml',
      'dta-diff.yml',
    ])
    const run = parse(read('.github/workflows/dta-diff.yml'))
    expect(run.jobs.diff.steps[1].with['node-version-file']).toBe('.nvmrc')
    expect(stdout).toContain('npx dta diff --check')
  })

  it('says up to date on a re-run, and writes nothing', async () => {
    await initDiff()
    const before = read('dta.config.ts')
    const { stdout } = await initDiff()
    expect(stdout).toContain('Up to date: nothing to change.')
    expect(read('dta.config.ts')).toBe(before)
  })

  it('follows a switch to pnpm in the section and the workflow', async () => {
    await initDiff()
    fs.rmSync(path.join(dir, 'package-lock.json'))
    put('pnpm-lock.yaml', 'lockfileVersion: 9')
    const { stdout } = await initDiff()
    // The note box wraps long lines.
    expect(stdout.replace(/\s*[|│]\s*\n[|│]\s*/g, ' ')).toContain(
      'build: npx dta build && npm run build-storybook → pnpm exec dta build && pnpm run build-storybook',
    )
    expect(stdout).toContain('.github/workflows/dta-diff.yml (updated)')
    expect(read('.github/workflows/dta-diff.yml')).toContain('pnpm install --frozen-lockfile')
  })

  it('moves from a page list to Storybook when Storybook is added', async () => {
    put(
      'package.json',
      JSON.stringify({
        scripts: { build: 'vite build' },
        devDependencies: { 'playwright-core': '1' },
      }),
    )
    fs.rmSync(path.join(dir, '.storybook'), { recursive: true })
    await initDiff()
    expect((await loadConfig({ cwd: dir })).config?.diff?.stories).toEqual(['/'])
    put(
      'package.json',
      JSON.stringify({
        scripts: { build: 'vite build', 'build-storybook': 'storybook build' },
        devDependencies: { 'playwright-core': '1' },
      }),
    )
    const { stdout } = await initDiff()
    expect(stdout).toContain('stories: pages / → Storybook')
    expect((await loadConfig({ cwd: dir })).config?.diff?.stories).toMatchObject({
      type: 'storybook',
    })
  })

  it('keeps a key changed by hand, and keys added to the section by hand', async () => {
    await initDiff()
    put(
      'dta.config.ts',
      read('dta.config.ts')
        .replace('outDir: "storybook-static"', 'outDir: "sb-out"')
        .replace("    workflow: 'split',", "    workflow: 'split',\n    viewports: [1280, 390],"),
    )
    fs.rmSync(path.join(dir, 'package-lock.json'))
    put('pnpm-lock.yaml', 'lockfileVersion: 9')
    const { stdout } = await initDiff()
    expect(stdout).toContain('outDir: sb-out (changed by hand)')
    const { config } = await loadConfig({ cwd: dir })
    expect(config?.diff).toMatchObject({
      outDir: 'sb-out',
      viewports: [1280, 390],
      build: 'pnpm exec dta build && pnpm run build-storybook',
    })
  })

  it('does not overwrite a workflow edited by hand, and names it', async () => {
    await initDiff()
    put(
      '.github/workflows/dta-diff.yml',
      read('.github/workflows/dta-diff.yml').replace(
        'runs-on: ubuntu-latest',
        'runs-on: self-hosted',
      ),
    )
    fs.rmSync(path.join(dir, 'package-lock.json'))
    put('pnpm-lock.yaml', 'lockfileVersion: 9')
    const { stdout } = await initDiff()
    expect(stdout).toContain('.github/workflows/dta-diff.yml (edited by hand: not overwritten)')
    expect(read('.github/workflows/dta-diff.yml')).toContain('self-hosted')
    expect(read('.github/workflows/dta-diff-report.yml')).toContain('pnpm install')
  })

  it('asks about outside contributors once, and writes one file for a team', async () => {
    const { exitCode } = await initDiff(
      [],
      [
        ['outside your team', 'n'],
        ['Apply these changes?', ''],
      ],
    )
    expect(exitCode).toBe(0)
    expect(fs.readdirSync(path.join(dir, '.github', 'workflows'))).toEqual(['dta-diff.yml'])
    expect(read('.github/workflows/dta-diff.yml')).toContain('diff-pr@')
    expect((await loadConfig({ cwd: dir })).config?.diff?.workflow).toBe('single')
    // Saved: the re-run does not ask again.
    expect((await initDiff([], [])).stdout).toContain('Up to date')
  })

  it('needs a config first', async () => {
    fs.rmSync(path.join(dir, 'dta.config.ts'))
    const { exitCode, stdout } = await initDiff()
    expect(exitCode).toBe(2)
    expect(stdout).toContain('Run `dta init` first')
  })
})
