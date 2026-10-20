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
const read = (file) => JSON.parse(fs.readFileSync('tokens/' + file, 'utf8'))
const base = read('Base.Value.json')
// Aliases become var() references, as dta build writes them.
const theme = (mode) =>
  '[data-brand="' + mode.toLowerCase() + '"] { --accent: var(--' +
  read('Theme.' + mode + '.json').accent.$value.replace(/[{}]/g, '') + '); }'
fs.rmSync('dist', { recursive: true, force: true })
fs.cpSync('pages', 'dist', { recursive: true })
fs.writeFileSync(
  'dist/tokens.css',
  [
    ':root { --brand: ' + base.Brand.$value + '; --sky: ' + base.sky.$value + '; --slate: ' + base.slate.$value + '; }',
    theme('A'),
    theme('B'),
  ].join(' '),
)
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
        brands: ['A', 'B'],
        diff: { build: 'node build.mjs', outDir: 'dist' },
      }),
    )
    write('build.mjs', BUILD)
    write('.gitignore', 'dist\n.dta\n')
    const baseTokens = (brand: string) =>
      JSON.stringify({
        Brand: { $type: 'color', $value: brand },
        sky: { $type: 'color', $value: '#4c8fd6' },
        slate: { $type: 'color', $value: '#5a6480' },
      })
    write('tokens/Base.Value.json', baseTokens('#2f55d4'))
    write('tokens/Theme.A.json', JSON.stringify({ accent: { $type: 'color', $value: '{sky}' } }))
    write('tokens/Theme.B.json', JSON.stringify({ accent: { $type: 'color', $value: '{sky}' } }))
    // Both themes side by side; only theme A's accent changes on the feature branch.
    write(
      'pages/stories/themes/index.html',
      page(
        '<div data-brand="a"><div id="in-a" style="width:100px;height:40px;background:var(--accent)"></div></div>' +
          '<div data-brand="b"><div id="in-b" style="width:100px;height:40px;background:var(--accent)"></div></div>',
      ),
    )
    write(
      'pages/stories/card/index.html',
      page('<div style="width:200px;height:80px;background:var(--brand)"></div>'),
    )
    write('pages/stories/text/index.html', page('<p>Unchanged text</p>'))
    write('pages/stories/button/index.html', page('<button style="padding:8px 16px">Save</button>'))
    write('pages/stories/manifest.json', stories(['card', 'text', 'button', 'themes']))
    git('init', '-q', '-b', 'main')
    git('add', '.')
    git('commit', '-q', '-m', 'base')
    git('checkout', '-q', '-b', 'feature')
    // A token change (card), a token change in one theme mode (themes), a component change
    // (button), a new story (new).
    write('tokens/Base.Value.json', baseTokens('#13213f'))
    write('tokens/Theme.A.json', JSON.stringify({ accent: { $type: 'color', $value: '{slate}' } }))
    write(
      'pages/stories/button/index.html',
      page('<button style="padding:12px 24px">Save</button>'),
    )
    write('pages/stories/new/index.html', page('<p>New story</p>'))
    write('pages/stories/manifest.json', stories(['card', 'text', 'button', 'themes', 'new']))
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
    expect(result.tokens.counts.changed).toBe(2)
    expect(
      Object.fromEntries(
        result.stories.map((s: { id: string; status: string }) => [s.id, s.status]),
      ),
    ).toEqual({
      card: 'changed',
      text: 'unchanged',
      button: 'changed',
      themes: 'changed',
      new: 'added',
    })

    // Attribution: token changes explain their stories, the component change does not.
    type Story = {
      id: string
      attribution?: {
        explained: boolean
        tokens: Array<{ id: string; dependents: number; elements: string[] }>
        unexplainedPixels: number
      }
    }
    const byId = Object.fromEntries((result.stories as Story[]).map((s) => [s.id, s]))
    expect(byId.card.attribution).toMatchObject({
      explained: true,
      tokens: [{ id: 'Brand (Base · Value)' }],
    })
    expect(byId.themes.attribution).toMatchObject({
      explained: true,
      tokens: [{ id: 'accent (Theme · A)', dependents: 1, elements: ['div#in-a'] }],
    })
    expect(byId.button.attribution?.explained).toBe(false)
    expect(byId.button.attribution?.tokens).toEqual([])
    expect(byId.button.attribution?.unexplainedPixels).toBeGreaterThan(0)
    expect(byId.text.attribution).toBeUndefined()
    expect(result.verdict).toBe('fail') // the button change is unexplained
    expect(
      result.review.tokens.map((t: { id: string; stories: string[] }) => [t.id, t.stories]),
    ).toEqual([
      ['Brand (Base · Value)', ['card@320']],
      ['accent (Theme · A)', ['themes@320']],
    ])

    const report = path.join(dir, '.dta', 'diff')
    for (const file of [
      'index.html',
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
    const html = fs.readFileSync(path.join(report, 'index.html'), 'utf8')
    expect(html).toContain('src="diff/card@320.png"')
    expect(html).toContain(
      '<span class="tag big" data-contrast-exception="redline label">Brand</span>',
    )
    expect(fs.readFileSync(path.join(report, 'summary.md'), 'utf8')).toContain(
      '**Fail: unexplained changes above the threshold** · 3 changed · 1 added · 1 unchanged · 2 explained by token changes, 1 unexplained',
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
