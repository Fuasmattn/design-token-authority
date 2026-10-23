/**
 * The published packages as a user gets them (TICKET-090): `design-token-authority` and
 * `create-dta` built, packed and installed from the tarballs into an empty project, then
 * `npm create dta`'s bin, `build`, `lint`, `diff --tokens-only` and the config's types there.
 *
 * Needs the npm registry for the dependencies: DTA_PACKAGE_E2E=1 (CI job "package"); otherwise
 * skipped.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const enabled = process.env.DTA_PACKAGE_E2E === '1'
const repo = path.resolve(import.meta.dirname, '..', '..', '..')
const fixture = path.join(repo, 'test', 'fixtures', 'brand-ab', 'tokens')
const version = (
  JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')) as {
    version: string
  }
).version

let work: string
let project: string
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 'T',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'T',
  GIT_COMMITTER_EMAIL: 't@example.com',
}
// CI may force colours: compare the text without its escape codes.
// eslint-disable-next-line no-control-regex
const plain = (text: string) => text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
const run = (command: string, args: string[], cwd = project) =>
  plain(
    execFileSync(command, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  )
const npx = (...args: string[]) => run('npx', ['--no-install', ...args])

describe.skipIf(!enabled)('the npm packages, installed from their tarballs', () => {
  beforeAll(() => {
    work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-package-')))
    project = path.join(work, 'project')
    fs.mkdirSync(project)
    run('pnpm', ['package:build'], repo)
    run('pnpm', ['pack', '--pack-destination', work], repo)
    run('pnpm', ['--filter', 'create-dta', 'pack', '--pack-destination', work], repo)
    run('npm', ['init', '-y'])
    run('npm', [
      'install',
      '--save-dev',
      '--no-audit',
      '--no-fund',
      path.join(work, `design-token-authority-${version}.tgz`),
      path.join(work, `create-dta-${version}.tgz`),
      // What a TypeScript project brings along, for the config's types.
      'typescript@5.9.3',
      '@types/node@24',
    ])
  }, 600_000)
  afterAll(() => {
    if (work) fs.rmSync(work, { recursive: true, force: true })
  })

  it('ships the bundle only, and runs it without tsx for the CLI', () => {
    const installed = path.join(project, 'node_modules', 'design-token-authority')
    expect(fs.readdirSync(installed).sort()).toEqual([
      'LICENSE',
      'README.md',
      'dist',
      'package.json',
    ])
    const pkg = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'))
    expect(pkg.bin).toEqual({ 'design-token-authority': './dist/bin.js', dta: './dist/bin.js' })
    expect(npx('design-token-authority', '--version').trim()).toBe(version)
    // tsx only loads a .ts config: one dynamic import in the whole bundle, nothing static.
    const code = fs
      .readdirSync(path.join(installed, 'dist'), { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.js'))
      .map((file) => fs.readFileSync(path.join(installed, 'dist', file), 'utf8'))
      .join('\n')
    const specifiers = [...code.matchAll(/(from\s*|import\s*\(\s*)["'](tsx[^"']*)["']/g)]
    expect(specifiers.map((match) => `${match[1].trim()} ${match[2]}`)).toEqual([
      'import( tsx/esm/api',
    ])
  }, 60_000)

  it("starts a project with create-dta's bin (npm create dta), the package already there", () => {
    expect(npx('create-dta', '--yes')).toContain('Created dta.config.ts')
    expect(fs.readFileSync(path.join(project, 'dta.config.ts'), 'utf8')).toContain(
      "import { defineConfig } from 'design-token-authority'",
    )
  }, 60_000)

  it('create-dta installs design-token-authority first in a project without it', () => {
    const fresh = path.join(work, 'fresh')
    const fake = path.join(work, 'fake-bin')
    fs.mkdirSync(fresh)
    fs.mkdirSync(fake)
    // A stand-in npm: records how it was called (the registry has no such version yet).
    fs.writeFileSync(
      path.join(fake, 'npm'),
      `#!/bin/sh\necho "$@" > "${path.join(work, 'npm-args.txt')}"\n`,
      { mode: 0o755 },
    )
    const output = execFileSync(
      process.execPath,
      [path.join(project, 'node_modules', 'create-dta', 'bin.js'), '--yes'],
      {
        cwd: fresh,
        encoding: 'utf8',
        env: {
          ...env,
          PATH: `${fake}${path.delimiter}${process.env.PATH ?? ''}`,
          npm_config_user_agent: 'npm/11',
        },
      },
    )
    expect(output).toContain(`Installing design-token-authority: npm install --save-dev`)
    expect(fs.readFileSync(path.join(work, 'npm-args.txt'), 'utf8').trim()).toBe(
      `install --save-dev design-token-authority@^${version}`,
    )
    expect(fs.existsSync(path.join(fresh, 'dta.config.ts'))).toBe(true)
  }, 60_000)

  it('builds, lints and diffs the tokens with that config', () => {
    fs.cpSync(fixture, path.join(project, 'tokens'), { recursive: true })
    expect(npx('dta', 'build')).toContain('Build complete')
    expect(fs.existsSync(path.join(project, 'output', 'css', 'variables.css'))).toBe(true)
    expect(npx('dta', 'lint')).toContain('All clean')
    run('git', ['init', '-q', '-b', 'main'])
    run('git', ['add', 'dta.config.ts', 'tokens'])
    run('git', ['commit', '-q', '-m', 'base'])
    run('git', ['checkout', '-q', '-b', 'change'])
    const file = path.join(project, 'tokens', 'Primitives.Value.json')
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('#003f8a', '#123456'))
    expect(npx('dta', 'diff', '--tokens-only')).toContain('Tokens: 1 changed')
  }, 120_000)

  it('types the config: defineConfig rejects a wrong value', () => {
    // tsc prints its errors on stdout.
    const check = (file: string) => {
      try {
        return tscRun(file)
      } catch (error) {
        throw new Error(String((error as { stdout?: string }).stdout ?? error))
      }
    }
    const tscRun = (file: string) =>
      npx(
        'tsc',
        '--noEmit',
        '--strict',
        '--target',
        'esnext',
        '--module',
        'nodenext',
        '--moduleResolution',
        'nodenext',
        '--types',
        'node',
        file,
      )
    expect(() => check('dta.config.ts')).not.toThrow()
    fs.writeFileSync(
      path.join(project, 'wrong.config.ts'),
      "import { defineConfig } from 'design-token-authority'\nexport default defineConfig({ figma: { source: 'file' }, tokens: { dir: 1 } })\n",
    )
    expect(() => check('wrong.config.ts')).toThrow(/not assignable to type 'string'/)
  }, 120_000)
})
