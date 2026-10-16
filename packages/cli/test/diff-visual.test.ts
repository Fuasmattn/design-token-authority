/**
 * End to end: `dta diff` builds a small static site at two commits, renders its stories in
 * Chromium and compares them. Needs a browser: runs when DTA_E2E=1 (CI job "diff-e2e") or when
 * DTA_BROWSER_PATH points at Chromium; otherwise skipped.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runCli } from '../src/index.js'

const enabled = process.env.DTA_E2E === '1' || Boolean(process.env.DTA_BROWSER_PATH)
let dir: string

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  fs.writeFileSync(path.join(dir, file), content)
}

function git(...args: string[]) {
  execFileSync('git', args, {
    cwd: dir,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  })
}

const page = (body: string) =>
  `<!doctype html><html><head><link rel="stylesheet" href="/tokens.css"><style>body{margin:0;font:16px sans-serif}</style></head><body>${body}</body></html>`

/** The site's "build": tokens.css from the token file, pages and manifest copied to dist/. */
const BUILD = `
import fs from 'node:fs'
const tokens = JSON.parse(fs.readFileSync('tokens/Base.Value.json', 'utf8'))
fs.rmSync('dist', { recursive: true, force: true })
fs.cpSync('pages', 'dist', { recursive: true })
fs.writeFileSync('dist/tokens.css', ':root { --brand: ' + tokens.Brand.$value + '; }')
`

function stories(ids: string[]) {
  return JSON.stringify({
    schema: 'dta.stories/1',
    stories: ids.map((id) => ({ id, title: id, url: `/stories/${id}/`, viewports: [320] })),
  })
}

describe.skipIf(!enabled)('dta diff (visual, end to end)', () => {
  beforeAll(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-diff-e2e-')))
    write(
      'dta.config.json',
      JSON.stringify({
        tokens: { dir: 'tokens' },
        diff: { build: 'node build.mjs', outDir: 'dist' },
      }),
    )
    write('build.mjs', BUILD)
    write('.gitignore', 'dist\n.dta\n')
    write(
      'tokens/Base.Value.json',
      JSON.stringify({ Brand: { $type: 'color', $value: '#2f55d4' } }),
    )
    write(
      'pages/stories/card/index.html',
      page('<div style="width:200px;height:80px;background:var(--brand)"></div>'),
    )
    write('pages/stories/text/index.html', page('<p>Unchanged text</p>'))
    write('pages/stories/button/index.html', page('<button style="padding:8px 16px">Save</button>'))
    write('pages/stories/manifest.json', stories(['card', 'text', 'button']))
    git('init', '-q', '-b', 'main')
    git('add', '.')
    git('commit', '-q', '-m', 'base')
    git('checkout', '-q', '-b', 'feature')
    // A token change (card), a component change (button), a new story (new).
    write(
      'tokens/Base.Value.json',
      JSON.stringify({ Brand: { $type: 'color', $value: '#e8632a' } }),
    )
    write(
      'pages/stories/button/index.html',
      page('<button style="padding:12px 24px">Save</button>'),
    )
    write('pages/stories/new/index.html', page('<p>New story</p>'))
    write('pages/stories/manifest.json', stories(['card', 'text', 'button', 'new']))
    git('add', '.')
    git('commit', '-q', '-m', 'head')
  })

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('renders base and head and finds exactly the expected differences', async () => {
    let stdout = ''
    let stderr = ''
    const exitCode = await runCli(['diff', '--format', 'json', '--fail-on-change'], {
      cwd: dir,
      stdout: (text) => (stdout += text),
      stderr: (text) => (stderr += text),
      input: new PassThrough(),
    })
    expect(stderr).toBe('')
    expect(exitCode).toBe(1) // changes found, --fail-on-change
    const result = JSON.parse(stdout)
    expect(result.schema).toBe('dta.diff/1')
    expect(result.tokens.counts.changed).toBe(1)
    expect(
      Object.fromEntries(
        result.stories.map((s: { id: string; status: string }) => [s.id, s.status]),
      ),
    ).toEqual({ card: 'changed', text: 'unchanged', button: 'changed', new: 'added' })

    const report = path.join(dir, '.dta', 'diff')
    for (const file of [
      'result.json',
      'summary.md',
      'head/card@320.png',
      'base/card@320.png',
      'diff/card@320.png',
      'head/new@320.png',
    ]) {
      expect(fs.existsSync(path.join(report, file)), file).toBe(true)
    }
    expect(fs.existsSync(path.join(report, 'diff/text@320.png'))).toBe(false)
    expect(fs.readFileSync(path.join(report, 'summary.md'), 'utf8')).toContain(
      '**2 changed · 1 added · 1 unchanged**',
    )
    // The working tree is untouched and the temporary worktree is gone.
    expect(
      execFileSync('git', ['worktree', 'list'], { cwd: dir, encoding: 'utf8' }).trim().split('\n'),
    ).toHaveLength(1)
  }, 120_000)

  it('produces the same result on a second run (deterministic rendering)', async () => {
    const run = async () => {
      let stdout = ''
      await runCli(['diff', '--format', 'json'], {
        cwd: dir,
        stdout: (text) => (stdout += text),
        stderr: () => undefined,
        input: new PassThrough(),
      })
      return JSON.parse(stdout).stories.map((s: { id: string; changedPixels: number }) => [
        s.id,
        s.changedPixels,
      ])
    }
    expect(await run()).toEqual(await run())
  }, 120_000)
})
