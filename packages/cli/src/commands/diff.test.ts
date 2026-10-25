import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from '../index.js'
import { resolveDiffHead } from '../io/diff-base.js'

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
    expect(stdout).not.toContain('showing token changes only')
  })

  it('says why it shows token changes only', async () => {
    const { stdout } = await diff(['--base', 'tokens-base'])
    expect(stdout).toContain('No `diff` section in the config: showing token changes only.')
    fs.writeFileSync(
      path.join(dir, 'dta.config.json'),
      JSON.stringify({ tokens: { dir: 'tokens' }, diff: { outDir: 'dist' } }),
    )
    expect((await diff(['--base', 'tokens-base'])).stdout).toContain(
      'The base is a directory, so there is nothing to build',
    )
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

  it('reads a base from before a resolver document without the resolver options', async () => {
    // The head moves to a resolver document in a subfolder, named in the config.
    fs.rmSync(path.join(dir, 'tokens'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'tokens', 'r'), { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'tokens', 'r', 'app.resolver.json'),
      JSON.stringify({
        version: '2025.10',
        sets: { base: { sources: [{ Blue: color('#0000aa') }] } },
        resolutionOrder: [{ $ref: '#/sets/base' }],
      }),
    )
    fs.writeFileSync(
      path.join(dir, 'dta.config.json'),
      JSON.stringify({ tokens: { dir: 'tokens', resolver: 'r/app.resolver.json' } }),
    )
    const { exitCode, stdout, stderr } = await diff(['--base', 'main', '--format', 'markdown'])
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('`Blue`')
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

// TICKET-123: what result.json records as `head` (the report's "With this change").
describe('the head of dta diff', () => {
  beforeEach(() => {
    git('init', '-q', '-b', 'main')
    writeTokens('#0000ff')
    fs.writeFileSync(path.join(dir, '.gitignore'), '.dta\n')
    git('add', '.')
    git('commit', '-q', '-m', 'tokens')
    git('checkout', '-q', '-b', 'feature/x')
  })

  it('records the branch (without refs/heads) and the commit of a clean tree', () => {
    expect(resolveDiffHead(dir)).toEqual({
      ref: 'feature/x',
      sha: git('rev-parse', 'HEAD').trim(),
      uncommitted: false,
    })
  })

  it('says when there are uncommitted changes: edited, staged or untracked, not ignored', () => {
    fs.mkdirSync(path.join(dir, '.dta', 'diff'), { recursive: true })
    fs.writeFileSync(path.join(dir, '.dta', 'diff', 'result.json'), '{}')
    expect(resolveDiffHead(dir)?.uncommitted).toBe(false)
    writeTokens('#0000cc')
    expect(resolveDiffHead(dir)?.uncommitted).toBe(true)
    git('add', '.')
    expect(resolveDiffHead(dir)?.uncommitted).toBe(true)
    git('commit', '-q', '-m', 'darker')
    fs.writeFileSync(path.join(dir, 'notes.md'), 'new')
    expect(resolveDiffHead(dir)?.uncommitted).toBe(true)
  })

  it('has no ref on a detached HEAD, and is the same from a sub-folder', () => {
    const sha = git('rev-parse', 'HEAD').trim()
    fs.mkdirSync(path.join(dir, 'design'))
    expect(resolveDiffHead(path.join(dir, 'design'))).toEqual(resolveDiffHead(dir))
    git('checkout', '-q', '--detach')
    expect(resolveDiffHead(dir)).toEqual({ sha, uncommitted: false })
  })

  it('is absent outside git and before the first commit', () => {
    const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-nogit-')))
    try {
      expect(resolveDiffHead(outside)).toBeUndefined()
      execFileSync('git', ['init', '-q'], { cwd: outside })
      expect(resolveDiffHead(outside)).toBeUndefined()
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
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

describe('dta diff --list', () => {
  const manifest = {
    schema: 'dta.stories/1',
    themes: ['light'],
    stories: [
      {
        id: 'button--variants',
        title: 'Buttons',
        url: '/stories/button/variants/',
        viewports: [1280, 390],
      },
      { id: 'chip--states', title: 'Chips', url: '/stories/chip/states/' },
    ],
  }
  const site = (config: unknown, withManifest = true) => {
    fs.writeFileSync(path.join(dir, 'dta.config.json'), JSON.stringify(config))
    if (withManifest) {
      fs.mkdirSync(path.join(dir, 'dist', 'stories'), { recursive: true })
      fs.writeFileSync(path.join(dir, 'dist', 'stories', 'manifest.json'), JSON.stringify(manifest))
    }
  }

  it('lists the stories of the built output with their viewports', async () => {
    site({ diff: { outDir: 'dist', viewports: [1440] } })
    const { exitCode, stdout } = await diff(['--list'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Manifest: dist/stories/manifest.json')
    expect(stdout).toMatch(/button--variants\s+\/stories\/button\/variants\/\s+1280 · 390/)
    expect(stdout).toMatch(/chip--states\s+\/stories\/chip\/states\/\s+1440/)
    expect(stdout).toContain('2 stories')
  })

  it('lists as JSON and markdown', async () => {
    site({ diff: { outDir: 'dist' } })
    const json = JSON.parse((await diff(['--list', '--format', 'json'])).stdout)
    expect(json.stories.map((s: { id: string }) => s.id)).toEqual([
      'button--variants',
      'chip--states',
    ])
    expect(json.stories[1].viewports).toEqual([1280])
    const markdown = (await diff(['--list', '--format', 'markdown'])).stdout
    expect(markdown).toContain('| `chip--states` | Chips | `/stories/chip/states/` | 1280 |')
  })

  it('explains what is missing', async () => {
    site({}, false)
    expect((await diff(['--list'])).stderr).toContain('no `diff` section in the config')
    site({ diff: { outDir: 'dist', build: 'pnpm build' } }, false)
    const missing = await diff(['--list'])
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr).toContain(
      'dta diff: no stories manifest at dist/stories/manifest.json.\n  Fix: run `pnpm build` first',
    )
  })

  it('lists a page list (TICKET-128), and names pages the output does not have', async () => {
    site({ diff: { outDir: 'dist', stories: ['/', '/pricing'] } }, false)
    fs.mkdirSync(path.join(dir, 'dist', 'pricing'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'dist', 'index.html'), '<h1>Home</h1>')
    fs.writeFileSync(path.join(dir, 'dist', 'pricing', 'index.html'), '<h1>Pricing</h1>')
    const { exitCode, stdout } = await diff(['--list'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Pages in: dist')
    expect(stdout).toMatch(/home\s+\/\s+1280/)
    expect(stdout).toMatch(/pricing\s+\/pricing\s+1280/)
    site({ diff: { outDir: 'dist', stories: ['/', '/checkout'], build: 'npm run build' } }, false)
    const missing = await diff(['--list'])
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr).toContain(
      'dta diff: "/checkout" is not in dist.\n  Fix: run `npm run build` first, or fix the path in diff.stories.',
    )
  })

  it('finds a page as a file, as <page>.html or as <page>/index.html (TICKET-148)', async () => {
    site(
      { diff: { outDir: 'dist', stories: ['/about', '/docs/', '/feed.xml', '/team?tab=1#x'] } },
      false,
    )
    fs.mkdirSync(path.join(dir, 'dist', 'docs'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'dist', 'about.html'), '<h1>About</h1>')
    fs.writeFileSync(path.join(dir, 'dist', 'docs', 'index.html'), '<h1>Docs</h1>')
    fs.writeFileSync(path.join(dir, 'dist', 'feed.xml'), '<feed/>')
    fs.mkdirSync(path.join(dir, 'dist', 'team'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'dist', 'team', 'index.html'), '<h1>Team</h1>')
    expect((await diff(['--list'])).exitCode).toBe(0)
    // A folder alone is not a page: it needs its index.html.
    site({ diff: { outDir: 'dist', stories: ['/empty'], build: 'npm run build' } }, false)
    fs.mkdirSync(path.join(dir, 'dist', 'empty'), { recursive: true })
    const missing = await diff(['--list'])
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr).toContain('dta diff: "/empty" is not in dist.')
  })

  it('rejects a page that does not start with "/"', async () => {
    site({ diff: { outDir: 'dist', stories: ['pricing'] } }, false)
    const { exitCode, stderr } = await diff(['--list'])
    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('a page path starts with "/"')
  })

  it('reports an invalid manifest', async () => {
    site({ diff: { outDir: 'dist' } })
    fs.writeFileSync(
      path.join(dir, 'dist', 'stories', 'manifest.json'),
      JSON.stringify({ schema: 'other/1', stories: [] }),
    )
    const { exitCode, stderr } = await diff(['--list'])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('invalid-manifest')
  })

  it('lists the stories of a Storybook build (recorded index.json)', async () => {
    fs.writeFileSync(
      path.join(dir, 'dta.config.json'),
      JSON.stringify({ diff: { outDir: 'storybook-static', stories: { type: 'storybook' } } }),
    )
    fs.cpSync(
      path.resolve(import.meta.dirname, '../../../../test/storybook/storybook-static'),
      path.join(dir, 'storybook-static'),
      { recursive: true },
    )
    const { exitCode, stdout } = await diff(['--list'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Storybook index: storybook-static/index.json')
    expect(stdout).toMatch(
      /components-button--primary\s+\/iframe\.html\?id=components-button--primary&viewMode=story\s+1280/,
    )
    expect(stdout).not.toContain('experimental') // tagged skip-dta-diff
    expect(stdout).not.toContain('intro--docs')
    expect(stdout).toContain('3 stories')
  })

  it('explains a missing Storybook build', async () => {
    fs.writeFileSync(
      path.join(dir, 'dta.config.json'),
      JSON.stringify({
        diff: {
          outDir: 'storybook-static',
          build: 'npm run build-storybook',
          stories: { type: 'storybook' },
        },
      }),
    )
    const { stderr } = await diff(['--list'])
    expect(stderr).toContain('dta diff: no Storybook index at storybook-static/index.json.')
    expect(stderr).toContain('  Fix: run `npm run build-storybook` first;')
    expect(stderr).toContain('  Docs: ')
  })

  it('rejects an invalid diff section with exit code 2', async () => {
    site({ diff: { outDir: 'dist', viewports: [] } })
    expect((await diff(['--list'])).exitCode).toBe(2)
  })

  it('uses diff.base from the config when --base is not given', async () => {
    fs.writeFileSync(
      path.join(dir, 'dta.config.json'),
      JSON.stringify({ tokens: { dir: 'tokens' }, diff: { outDir: 'dist', base: 'tokens-base' } }),
    )
    writeTokens('#0000cc')
    writeTokens('#0000ff', 'tokens-base')
    const { exitCode, stdout } = await diff(['--format', 'json'])
    expect(exitCode).toBe(0)
    expect(JSON.parse(stdout).base).toBe('tokens-base')
  })
})

describe('dta diff --check (TICKET-130)', () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
  })
  const setup = (config: unknown) =>
    fs.writeFileSync(path.join(dir, 'dta.config.json'), JSON.stringify(config))
  const page = (file: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, 'dist', file)), { recursive: true })
    fs.writeFileSync(path.join(dir, 'dist', file), '<h1>x</h1>')
  }
  const repo = () => {
    git('init', '-q', '-b', 'main')
    writeTokens('#0000ff')
    git('add', '.')
    git('commit', '-q', '-m', 'tokens')
  }

  it('passes every check on a ready project, one line each', async () => {
    process.env.DTA_BROWSER_PATH = process.execPath
    repo()
    setup({ tokens: { dir: 'tokens' }, diff: { outDir: 'dist', stories: ['/'] } })
    page('index.html')
    const { exitCode, stdout } = await diff(['--check'])
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/✓ config\s+diff section: outDir dist/)
    expect(stdout).toMatch(/✓ browser\s+DTA_BROWSER_PATH/)
    expect(stdout).toMatch(/✓ git history\s+full history/)
    expect(stdout).toMatch(/✓ base\s+merge base with main/)
    expect(stdout).toMatch(/✓ stories\s+1 story in dist/)
    expect(stdout).toContain('Ready for dta diff.')
  })

  it('names the fix for each failing check and exits 1', async () => {
    process.env.DTA_BROWSER_PATH = path.join(dir, 'no-chrome')
    setup({ tokens: { dir: 'tokens' } })
    const { exitCode, stdout } = await diff(['--check'])
    expect(exitCode).toBe(1)
    expect(stdout).toMatch(/✗ config\s+no diff section\n\s+Fix: run `dta init`/)
    expect(stdout).toMatch(/✗ browser\s+DTA_BROWSER_PATH points at .*no-chrome/)
    expect(stdout).toMatch(/✗ git history\s+not a git repository\n\s+Fix: in CI, check out/)
    expect(stdout).toContain(
      'Docs: https://dta.martinprinz.dev/guides/dta-diff-in-pull-requests/#troubleshooting',
    )
    expect(stdout).toContain('3 of 3 checks failed.')
  })

  it('fails the base without a default branch, and the stories before a build', async () => {
    process.env.DTA_BROWSER_PATH = process.execPath
    git('init', '-q', '-b', 'trunk')
    writeTokens('#0000ff')
    git('add', '.')
    git('commit', '-q', '-m', 'tokens')
    setup({
      tokens: { dir: 'tokens' },
      diff: { outDir: 'dist', build: 'npm run build', stories: ['/'] },
    })
    const { exitCode, stdout } = await diff(['--check'])
    expect(exitCode).toBe(1)
    expect(stdout).toMatch(/✗ base\s+no default branch/)
    expect(stdout).toMatch(/✗ stories\s+.*\n\s+Fix: run `npm run build` first/)
    expect((await diff(['--check', '--base', 'trunk'])).stdout).toMatch(/✓ base\s+trunk \(/)
  })

  it('fails the history of a shallow clone', async () => {
    process.env.DTA_BROWSER_PATH = process.execPath
    repo()
    git('commit', '-q', '--allow-empty', '-m', 'two')
    const clone = path.join(dir, 'clone')
    git('clone', '-q', '--depth', '1', `file://${dir}`, clone)
    fs.writeFileSync(
      path.join(clone, 'dta.config.json'),
      JSON.stringify({ tokens: { dir: 'tokens' }, diff: { outDir: 'dist' } }),
    )
    let stdout = ''
    await runCli(['diff', '--check'], {
      cwd: clone,
      stdout: (text) => (stdout += text),
      stderr: () => undefined,
      input: new PassThrough(),
    })
    // eslint-disable-next-line no-control-regex
    stdout = stdout.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
    expect(stdout).toMatch(/✗ git history\s+a shallow clone/)
    expect(stdout).toContain('fetch-depth: 0')
  })

  it('reports an unexpected error with a fix and a docs link (TICKET-148)', async () => {
    repo()
    setup({ tokens: { dir: 'tokens' } })
    let stderr = ''
    const exitCode = await runCli(['diff'], {
      cwd: dir,
      // Writing the report fails in a way dta diff does not know.
      stdout: () => {
        throw new Error('EPIPE: broken pipe')
      },
      stderr: (text) => (stderr += text),
      input: new PassThrough(),
    })
    expect(exitCode).toBe(1)
    expect(stderr).toMatch(
      /^dta diff: Unexpected error: EPIPE: broken pipe\n {2}Fix: .+\n {2}Docs: https:\/\/.+#troubleshooting\n/s,
    )
  })

  it('stops with an error in CI when there is no browser, and only warns locally', async () => {
    process.env.DTA_BROWSER_PATH = path.join(dir, 'no-chrome')
    repo()
    git('checkout', '-q', '-b', 'feature')
    setup({ tokens: { dir: 'tokens' }, diff: { outDir: 'dist', stories: ['/'] } })
    page('index.html')
    process.env.CI = 'true'
    const ci = await diff(['--format', 'markdown'])
    expect(ci.exitCode).toBe(1)
    expect(ci.stderr).toContain('dta diff: No browser for screenshots')
    expect(ci.stderr).toContain('  Fix: `npm i -D playwright-core`')
    // The fix is said once, on the Fix line (TICKET-148).
    expect(ci.stderr.split('npm i -D playwright-core')).toHaveLength(2)
    delete process.env.CI
    const local = await diff(['--format', 'markdown'])
    expect(local.exitCode).toBe(0)
    expect(local.stderr).toContain('No browser for screenshots')
  })
})
