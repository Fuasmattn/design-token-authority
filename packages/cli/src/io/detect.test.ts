import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { describeFound, detectProject, installCommand, lockfileIn } from './detect.js'

let dir: string
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-detect-')))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const put = (file: string, content = '') => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  fs.writeFileSync(path.join(dir, file), content)
}
const pkg = (json: object) => put('package.json', JSON.stringify(json))
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

describe('detectProject', () => {
  it('notices a build script that already builds the tokens (TICKET-145)', () => {
    put('package-lock.json', '{}')
    for (const [script, runs] of [
      ['dta build && vite build', true],
      ['npx dta build && node build.mjs', true],
      ['pnpm exec dta build; astro build', true],
      ['design-token-authority build && next build', true],
      ['vite build', false],
      ['dta lint && vite build', false],
      ['node scripts/dta-builder.mjs', false],
    ] as const) {
      pkg({ scripts: { build: script } })
      expect(detectProject(dir).buildRunsDta, script).toBe(runs)
    }
    // Storybook: its build script decides.
    put('.storybook/main.ts')
    pkg({ scripts: { 'build-storybook': 'dta build && storybook build', build: 'vite build' } })
    expect(detectProject(dir).buildRunsDta).toBe(true)
  })

  it('reads an npm project with Storybook, naming where each result came from', () => {
    pkg({
      engines: { node: '>=20' },
      scripts: { 'build-storybook': 'storybook build -o dist/sb', build: 'vite build' },
    })
    put('package-lock.json', '{}')
    put('.storybook/main.ts')
    const found = detectProject(dir)
    expect(describeFound(found.packageManager)).toBe('npm, from package-lock.json')
    expect(found.storybook).toEqual({
      value: { script: 'build-storybook', outDir: 'dist/sb' },
      source: 'the "build-storybook" script in package.json',
    })
    expect(found.build.value).toBe('npm run build-storybook')
    expect(found.install.value).toBe('npm ci')
    expect(describeFound(found.node)).toBe('>=20, from engines.node in package.json')
  })

  it('reads a pnpm project without Storybook, the Node version from .nvmrc', () => {
    pkg({ scripts: { build: 'astro build' }, engines: { node: '20' } })
    put('pnpm-lock.yaml', 'lockfileVersion: 9')
    put('.nvmrc', '22\n')
    const found = detectProject(dir)
    expect(found.packageManager.value).toBe('pnpm')
    expect(found.storybook).toEqual({
      value: null,
      source: 'no .storybook/ folder and no Storybook build script',
    })
    expect(found.build).toEqual({
      value: 'pnpm run build',
      source: 'the "build" script in package.json',
    })
    expect(found.install.value).toBe('pnpm install --frozen-lockfile')
    expect(describeFound(found.node)).toBe('22, from .nvmrc')
  })

  it('finds Storybook in a script named otherwise, with its default output folder', () => {
    pkg({ scripts: { 'sb:build': 'storybook build --quiet' } })
    put('yarn.lock')
    const found = detectProject(dir)
    expect(found.storybook.value).toEqual({ script: 'sb:build', outDir: 'storybook-static' })
    expect(found.build.value).toBe('yarn run sb:build')
  })

  it('falls back to packageManager in package.json, and says what is missing', () => {
    pkg({ packageManager: 'pnpm@9.12.0' })
    expect(describeFound(detectProject(dir).packageManager)).toBe(
      'pnpm, from packageManager in package.json',
    )
    pkg({})
    const found = detectProject(dir)
    expect(describeFound(found.packageManager)).toBe(
      'not found (no lockfile and no packageManager in package.json)',
    )
    expect(found.build.value).toBeNull()
    expect(found.node.value).toBeNull()
    expect(found.git.host).toEqual({ value: null, source: 'not a git repository' })
  })

  it('reads the git host and default branch without network', () => {
    pkg({})
    git('init', '-q', '-b', 'main')
    git('commit', '-q', '--allow-empty', '-m', 'start')
    expect(detectProject(dir).git).toEqual({
      host: { value: null, source: 'no origin remote' },
      defaultBranch: { value: 'main', source: 'the local branches' },
    })
    git('remote', 'add', 'origin', 'git@github.com:acme/site.git')
    expect(detectProject(dir).git.host).toEqual({ value: 'github', source: 'the origin remote' })
    git('remote', 'set-url', 'origin', 'https://gitlab.com/acme/site.git')
    expect(detectProject(dir).git.host.value).toBe('other')
  })

  it('finds the lockfile and Node version at the root of a workspace', () => {
    git('init', '-q', '-b', 'main')
    put('pnpm-lock.yaml', 'lockfileVersion: 9')
    put('.nvmrc', '22')
    put('package.json', JSON.stringify({ private: true }))
    put(
      'packages/web/package.json',
      JSON.stringify({ scripts: { 'build-storybook': 'storybook build' } }),
    )
    const found = detectProject(path.join(dir, 'packages', 'web'))
    expect(describeFound(found.packageManager)).toBe('pnpm, from ../../pnpm-lock.yaml')
    expect(found.lockfile.value).toEqual({ file: 'pnpm-lock.yaml', dir: '../..' })
    expect(describeFound(found.node)).toBe('22, from ../../.nvmrc')
    expect(found.build.value).toBe('pnpm run build-storybook')
    expect(found.pnpmVersion).toBeNull()
  })

  it('finds Storybook by what a script runs, not by a script that names another', () => {
    pkg({
      scripts: {
        chromatic: 'chromatic --build-script-name build-sb',
        'build-sb': 'npx storybook@8 build --output-dir out/sb',
      },
    })
    expect(detectProject(dir).storybook.value).toEqual({ script: 'build-sb', outDir: 'out/sb' })
    pkg({ scripts: { sbb: 'sb build' } })
    expect(detectProject(dir).storybook.value?.script).toBe('sbb')
  })

  it('uses the Yarn 2+ flag when the project has a .yarnrc.yml', () => {
    expect(installCommand('yarn', dir)).toBe('yarn install --frozen-lockfile')
    put('.yarnrc.yml', 'nodeLinker: node-modules')
    expect(installCommand('yarn', dir)).toBe('yarn install --immutable')
    expect(installCommand('bun')).toBe('bun install --frozen-lockfile')
  })
})

describe('lockfileIn (TICKET-148)', () => {
  it('names the lockfile of a folder and its manager, pnpm first when there are several', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-lock-'))
    try {
      expect(lockfileIn(folder)).toBeNull()
      fs.writeFileSync(path.join(folder, 'package-lock.json'), '{}')
      expect(lockfileIn(folder)).toEqual({ file: 'package-lock.json', manager: 'npm' })
      fs.writeFileSync(path.join(folder, 'pnpm-lock.yaml'), '')
      expect(lockfileIn(folder)).toEqual({ file: 'pnpm-lock.yaml', manager: 'pnpm' })
    } finally {
      fs.rmSync(folder, { recursive: true, force: true })
    }
  })
})
