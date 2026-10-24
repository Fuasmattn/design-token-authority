import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { loadConfig } from '../config/load.js'
import { stampWorkflow } from '../init/diff-setup.js'
import { ACTION_VERSIONS } from '../init/diff-workflows.js'
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
    // Without a publish hook the report workflow runs no code of the project.
    expect(read('.github/workflows/dta-diff-report.yml')).not.toContain('actions/checkout')
  })

  it('does not build the tokens twice when the build script runs dta build (TICKET-145)', async () => {
    await initDiff()
    expect(read('dta.config.ts')).toContain('build: "npx dta build && npm run build-storybook"')
    put(
      'package.json',
      JSON.stringify({
        scripts: { 'build-storybook': 'dta build && storybook build' },
        devDependencies: { 'playwright-core': '^1.59.1' },
      }),
    )
    const { stdout } = await initDiff()
    // A key init wrote follows the project.
    expect(stdout).toContain('npx dta build && npm run build-storybook → npm run build-storybook')
    expect(read('dta.config.ts')).toContain('build: "npm run build-storybook"')
  })

  it('moves workflows an older init wrote to the current action versions (TICKET-143)', async () => {
    await initDiff()
    const file = '.github/workflows/dta-diff.yml'
    // As an older DTA wrote it: the same template on v4 of the actions, stamped.
    const current = read(file).replace(/# dta init --diff sha256:\w+\n$/, '')
    const old = current
      .replace(ACTION_VERSIONS.checkout, 'actions/checkout@v4')
      .replace(ACTION_VERSIONS.setupNode, 'actions/setup-node@v4')
    expect(old).not.toBe(current)
    put(file, stampWorkflow(old))
    const { stdout } = await initDiff()
    expect(stdout).toContain(`${file} (updated)`)
    expect(read(file)).toBe(stampWorkflow(current))
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

  it('keeps the report folder out of git, once', async () => {
    const first = await initDiff()
    expect(first.stdout).toContain('Added .dta/diff/ to .gitignore')
    expect(read('.gitignore')).toContain('.dta/diff/')
    expect((await initDiff()).stdout).toContain('Up to date')
  })

  it('names only the keys to add when the diff section was written by hand', async () => {
    put(
      'dta.config.ts',
      CONFIG.replace(
        "  tokens: {\n    dir: 'tokens',\n  },",
        "  tokens: {\n    dir: 'tokens',\n  },\n  diff: {\n    build: 'pnpm build',\n    outDir: 'dist',\n    stories: { type: 'static-site', manifest: 'stories/manifest.json' },\n    viewports: [1280],\n  },",
      ),
    )
    fs.rmSync(path.join(dir, '.storybook'), { recursive: true })
    put(
      'package.json',
      JSON.stringify({
        scripts: { build: 'vite build' },
        devDependencies: { 'playwright-core': '1' },
      }),
    )
    const before = read('dta.config.ts')
    const { stdout } = await initDiff()
    expect(stdout).toContain('build: pnpm build (set by hand)')
    expect(stdout).not.toContain('stories:')
    // The note box draws | or │, by terminal.
    expect(stdout).toMatch(
      /Add or change these keys in its diff section:\n[|│] {4}workflow: 'split',/,
    )
    expect(read('dta.config.ts')).toBe(before)
  })

  it("carries the config's publish hook into the report workflow", async () => {
    await initDiff()
    put(
      'dta.config.ts',
      read('dta.config.ts').replace(
        "    workflow: 'split',",
        "    workflow: 'split',\n    publish: 'sh .github/dta-diff-publish.sh',",
      ),
    )
    const { stdout } = await initDiff()
    expect(stdout).toContain('.github/workflows/dta-diff-report.yml (updated)')
    const report = read('.github/workflows/dta-diff-report.yml')
    expect(report).toContain(ACTION_VERSIONS.checkout)
    expect(report).toContain("'sh .github/dta-diff-publish.sh'")
    expect(report).toContain("The publish hook's secrets go here as env")
  })

  it('does not ask for pages when the config renders a manifest', async () => {
    put(
      'dta.config.ts',
      CONFIG.replace(
        "  tokens: {\n    dir: 'tokens',\n  },",
        "  tokens: {\n    dir: 'tokens',\n  },\n  diff: {\n    build: 'pnpm build',\n    outDir: 'dist',\n    stories: { type: 'static-site', manifest: 'stories/manifest.json' },\n    workflow: 'split',\n  },",
      ),
    )
    fs.rmSync(path.join(dir, '.storybook'), { recursive: true })
    put(
      'package.json',
      JSON.stringify({
        scripts: { build: 'vite build' },
        devDependencies: { 'playwright-core': '1' },
      }),
    )
    // Only the confirmation: a pages question would be left unanswered and time out.
    const { exitCode, stdout } = await initDiff([], [['Apply these changes?', '']])
    expect(exitCode).toBe(0)
    expect(stdout).not.toContain('Which pages')
  })

  it('adds the report folder to a .gitignore that does not end in a newline', async () => {
    put('.gitignore', 'node_modules')
    await initDiff()
    expect(read('.gitignore')).toBe('node_modules\n# dta diff reports\n.dta/diff/\n')
  })

  it('needs a config first', async () => {
    fs.rmSync(path.join(dir, 'dta.config.ts'))
    const { exitCode, stdout } = await initDiff()
    expect(exitCode).toBe(2)
    expect(stdout).toContain('Run `dta init` first')
  })
})
