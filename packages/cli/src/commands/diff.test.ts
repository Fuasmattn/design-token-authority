import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from '../index.js'

const root = path.resolve(import.meta.dirname, '..', '..', '..', '..')
const fixture = path.join(root, 'test', 'fixtures', 'brand-ab')

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-diff-')))
  fs.writeFileSync(path.join(dir, 'dta.config.json'), JSON.stringify({ tokens: { dir: 'tokens' } }))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

async function diff(args: string[]) {
  let stdout = ''
  let stderr = ''
  const exitCode = await runCli(['diff', ...args], {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    input: new PassThrough(),
  })
  // eslint-disable-next-line no-control-regex
  return { exitCode, stdout: stdout.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, ''), stderr }
}

function copyTokens(from: string, to: string) {
  fs.cpSync(path.join(fixture, from), path.join(dir, to), { recursive: true })
}

const color = (value: string) => ({ $type: 'color', $value: value })
function writeTokens(blue: string, target = 'tokens') {
  fs.mkdirSync(path.join(dir, target), { recursive: true })
  fs.writeFileSync(
    path.join(dir, target, 'Base.Value.json'),
    JSON.stringify({ Blue: color(blue) }, null, 2) + '\n',
  )
  fs.writeFileSync(
    path.join(dir, target, 'Brand.A.json'),
    JSON.stringify({ Primary: color('{Blue}') }, null, 2) + '\n',
  )
}

function git(...args: string[]) {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  }).trim()
}

describe('dta diff with a base directory', () => {
  beforeEach(() => {
    copyTokens('tokens', 'tokens')
    copyTokens('tokens-base', 'tokens-base')
  })

  it('reports the token changes of the fixture pair as markdown', async () => {
    const { exitCode, stdout } = await diff(['--base', 'tokens-base', '--format', 'markdown'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain(
      'Base: `tokens-base` · **3 changed · 1 added · 1 removed · 2 affected**',
    )
    expect(stdout).toContain(
      '| `Colors.Foundation.Blue.500` | Primitives · Value | `#0047a0` | `#0057b8` |',
    )
    expect(stdout).not.toContain('dta diff ') // no terminal frame around markdown
  })

  it('prints a readable console report', async () => {
    const { exitCode, stdout } = await diff(['--base', 'tokens-base', '--tokens-only'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Base: tokens-base')
    expect(stdout).toContain('changed  Colors.Foundation.Blue.500')
    expect(stdout).toContain('(because of Colors.Foundation.Blue.500)')
    expect(stdout).toContain('3 changed · 1 added · 1 removed · 2 affected')
    expect(stdout).not.toContain('not available yet')
  })

  it('says that visual comparison is not available yet without --tokens-only', async () => {
    const { stdout } = await diff(['--base', 'tokens-base'])
    expect(stdout).toContain('Visual comparison of stories is not available yet')
  })

  it('writes versioned JSON to a file', async () => {
    const { exitCode, stdout } = await diff([
      '--base',
      'tokens-base',
      '--format',
      'json',
      '--out',
      'reports/diff.json',
    ])
    expect(exitCode).toBe(0)
    expect(stdout).toBe('')
    const json = JSON.parse(fs.readFileSync(path.join(dir, 'reports/diff.json'), 'utf8'))
    expect(json.schema).toBe('dta.diff.tokens/1')
    expect(json.counts).toEqual({ changed: 3, added: 1, removed: 1, affected: 2 })
  })

  it('exits 1 with --fail-on-change when something changed, 0 when nothing did', async () => {
    expect((await diff(['--base', 'tokens-base', '--fail-on-change'])).exitCode).toBe(1)
    const same = await diff(['--base', 'tokens', '--fail-on-change'])
    expect(same.exitCode).toBe(0)
    expect(same.stdout).toContain('No token changes.')
  })

  it('rejects an unknown format', async () => {
    const { exitCode, stderr } = await diff(['--base', 'tokens-base', '--format', 'html'])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('unknown format "html"')
  })
})

describe('dta diff with git', () => {
  beforeEach(() => {
    git('init', '-q', '-b', 'main')
    writeTokens('#0000ff')
    git('add', '.')
    git('commit', '-q', '-m', 'tokens')
    git('checkout', '-q', '-b', 'feature')
    writeTokens('#0000cc')
    git('commit', '-q', '-am', 'darker blue')
  })

  it('compares with the merge base of the default branch when no base is given', async () => {
    const sha = git('merge-base', 'HEAD', 'main').slice(0, 7)
    const { exitCode, stdout } = await diff(['--format', 'markdown'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain(`Base: \`merge base with main (${sha})\``)
    expect(stdout).toContain('| `Blue` | Base · Value | `#0000ff` | `#0000cc` |')
    expect(stdout).toContain('| `Primary` | Brand · A | `#0000ff` | `#0000cc` | `Blue` |')
  })

  it('reads the base at a ref without touching the working tree, and includes uncommitted edits', async () => {
    writeTokens('#000099')
    const { exitCode, stdout } = await diff(['--base', 'main', '--format', 'json'])
    expect(exitCode).toBe(0)
    const json = JSON.parse(stdout)
    expect(json.base).toMatch(/^main \([0-9a-f]{7}\)$/)
    expect(json.changes[0].after.raw).toBe('#000099')
    expect(git('status', '--porcelain')).toContain('tokens/Base.Value.json')
    expect(git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('feature')
  })

  it('works from a sub-folder of the repository', async () => {
    fs.mkdirSync(path.join(dir, 'design'), { recursive: true })
    git('mv', 'tokens', 'design/tokens')
    git('mv', 'dta.config.json', 'design/dta.config.json')
    git('commit', '-q', '-m', 'move')
    git('checkout', '-q', 'main')
    git('checkout', '-q', '-b', 'moved-on-main')
    fs.mkdirSync(path.join(dir, 'design'), { recursive: true })
    git('mv', 'tokens', 'design/tokens')
    git('mv', 'dta.config.json', 'design/dta.config.json')
    git('commit', '-q', '-m', 'move on main')
    git('checkout', '-q', 'feature')
    let stdout = ''
    const exitCode = await runCli(['diff', '--base', 'moved-on-main', '--format', 'json'], {
      cwd: path.join(dir, 'design'),
      stdout: (text) => (stdout += text),
      stderr: () => undefined,
      input: new PassThrough(),
    })
    expect(exitCode).toBe(0)
    expect(JSON.parse(stdout).counts.changed).toBe(1)
  })

  it('reports every token as added when the base has no tokens yet', async () => {
    const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
    const empty = git('commit-tree', emptyTree, '-m', 'empty')
    const { exitCode, stdout } = await diff(['--base', empty, '--format', 'json'])
    expect(exitCode).toBe(0)
    expect(JSON.parse(stdout).counts).toEqual({ changed: 0, added: 2, removed: 0, affected: 0 })
  })

  it('fails clearly for something that is neither a directory nor a ref', async () => {
    const { exitCode, stderr } = await diff(['--base', 'no-such-thing'])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('"no-such-thing" is neither a directory nor a git ref')
  })
})

describe('dta diff outside git', () => {
  it('asks for --base when there is no repository', async () => {
    writeTokens('#0000ff')
    const { exitCode, stderr } = await diff([])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('Not inside a git repository')
    expect(stderr).toContain('--base <dir>')
  })
})
