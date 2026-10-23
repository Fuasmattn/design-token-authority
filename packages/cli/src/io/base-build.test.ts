import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BaseBuildError, buildBase } from './base-build.js'
import { CommandFailedError } from './run-command.js'
import { createBaseWorktree, type BaseWorktree } from './worktree.js'

let dir: string
let worktree: BaseWorktree | undefined
const put = (file: string, content = '') => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  fs.writeFileSync(path.join(dir, file), content)
}
const git = (...args: string[]) =>
  execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'T',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'T',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
  }).trim()

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-base-build-')))
  git('init', '-q', '-b', 'main')
  put('.gitignore', 'node_modules\n')
  put('package.json', '{"scripts":{"build":"echo build"}}')
  put('package-lock.json', '{"lockfileVersion":3}')
  git('add', '.')
  git('commit', '-q', '-m', 'base')
  // Installed at the head, not in git.
  put('node_modules/dep/index.js', 'module.exports = 1')
})
afterEach(() => {
  worktree?.remove()
  worktree = undefined
  fs.rmSync(dir, { recursive: true, force: true })
})

/** A run() that records commands and fails the ones `fails` says. */
function recorder(fails: (command: string, call: number) => boolean = () => false) {
  const calls: string[] = []
  const run = (command: string, cwd: string) => {
    calls.push(
      `${command} @ ${path.basename(cwd) === '' ? '/' : path.relative(worktree?.root ?? '', cwd) || '.'}`,
    )
    if (fails(command, calls.length)) throw new CommandFailedError(command, cwd, 'boom')
    return ''
  }
  return { calls, run }
}

describe('buildBase (TICKET-127)', () => {
  it("reuses the head's node_modules when the lockfile did not change", () => {
    worktree = createBaseWorktree(dir, git('rev-parse', 'HEAD'))
    const { calls, run } = recorder()
    expect(buildBase({ cwd: dir, worktree, build: 'npm run build', run })).toBe('reused')
    expect(calls).toEqual(['npm run build @ .'])
    // A real folder of links to the head's packages: the base's caches stay in the worktree.
    const modules = path.join(worktree.root, 'node_modules')
    expect(fs.lstatSync(modules).isSymbolicLink()).toBe(false)
    expect(fs.lstatSync(path.join(modules, 'dep')).isSymbolicLink()).toBe(true)
    expect(fs.existsSync(path.join(modules, 'dep', 'index.js'))).toBe(true)
  })

  it("links workspace packages to the base's own code, and leaves the caches out", () => {
    put('packages/ui/index.js', "module.exports = 'base'")
    git('add', '.')
    git('commit', '-q', '-m', 'ui at base')
    const base = git('rev-parse', 'HEAD')
    put('packages/ui/index.js', "module.exports = 'head'")
    git('commit', '-q', '-am', 'ui at head')
    // As npm, pnpm and yarn install a workspace package: a link into the repository.
    fs.mkdirSync(path.join(dir, 'node_modules', '@acme'), { recursive: true })
    fs.symlinkSync('../../packages/ui', path.join(dir, 'node_modules', '@acme', 'ui'))
    put('node_modules/.cache/storybook/x', 'head cache')
    worktree = createBaseWorktree(dir, base)
    const { run } = recorder()
    expect(buildBase({ cwd: dir, worktree, build: 'npm run build', run })).toBe('reused')
    const ui = path.join(worktree.root, 'node_modules', '@acme', 'ui', 'index.js')
    expect(fs.readFileSync(ui, 'utf8')).toBe("module.exports = 'base'")
    expect(fs.existsSync(path.join(worktree.root, 'node_modules', '.cache'))).toBe(false)
  })

  it('installs from the lockfile when it changed', () => {
    const base = git('rev-parse', 'HEAD')
    put('package-lock.json', '{"lockfileVersion":3,"packages":{}}')
    git('commit', '-q', '-am', 'new dependency')
    worktree = createBaseWorktree(dir, base)
    const { calls, run } = recorder()
    expect(buildBase({ cwd: dir, worktree, build: 'npm run build', run })).toBe('installed')
    expect(calls).toEqual(['npm ci @ .', 'npm run build @ .'])
    expect(fs.existsSync(path.join(worktree.root, 'node_modules'))).toBe(false)
  })

  it('installs cleanly when the build fails with the linked packages', () => {
    worktree = createBaseWorktree(dir, git('rev-parse', 'HEAD'))
    const { calls, run } = recorder((command, call) => command === 'npm run build' && call === 1)
    expect(buildBase({ cwd: dir, worktree, build: 'npm run build', run })).toBe('installed')
    expect(calls).toEqual(['npm run build @ .', 'npm ci @ .', 'npm run build @ .'])
    expect(fs.existsSync(path.join(worktree.root, 'node_modules'))).toBe(false)
  })

  it('runs diff.setup instead, when it is set', () => {
    worktree = createBaseWorktree(dir, git('rev-parse', 'HEAD'))
    const { calls, run } = recorder()
    expect(buildBase({ cwd: dir, worktree, setup: 'make deps', build: 'npm run build', run })).toBe(
      'setup',
    )
    expect(calls).toEqual(['make deps @ .', 'npm run build @ .'])
    expect(fs.existsSync(path.join(worktree.root, 'node_modules'))).toBe(false)
  })

  it('stops with the command and its output when the base does not build', () => {
    const base = git('rev-parse', 'HEAD')
    put('package-lock.json', '{"changed":true}')
    git('commit', '-q', '-am', 'changed')
    worktree = createBaseWorktree(dir, base)
    const { run } = recorder((command) => command === 'npm run build')
    let error: unknown
    try {
      buildBase({ cwd: dir, worktree, build: 'npm run build', run })
    } catch (thrown) {
      error = thrown
    }
    expect(error).toBeInstanceOf(BaseBuildError)
    expect((error as BaseBuildError).failure.command).toBe('npm run build')
    expect((error as BaseBuildError).message).toContain('boom')
  })
})
