/**
 * The success check of the near-zero setup (spec diff-zero-setup, TICKET-131): on a project with
 * Storybook, `dta init --diff --yes` and then `dta diff` give a report with screenshots, with no
 * file edited by hand. The Storybook here is a small stand-in (its build script writes the
 * `index.json` and `iframe.html` a static Storybook build has), so the test needs no network.
 *
 * Needs a browser: runs when DTA_E2E=1 (CI job "diff-e2e") or DTA_BROWSER_PATH is set.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { PassThrough } from 'node:stream'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runCli } from '../src/index.js'

const enabled = process.env.DTA_E2E === '1' || Boolean(process.env.DTA_BROWSER_PATH)
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')
let dir: string

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  fs.writeFileSync(path.join(dir, file), content)
}
function git(...args: string[]) {
  execFileSync('git', args, {
    cwd: dir,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  })
}

/** A static Storybook build: index.json and iframe.html, the button styled by the token. */
const STORYBOOK_BUILD = `
import fs from 'node:fs'
const out = process.argv[process.argv.indexOf('-o') + 1]
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
fs.copyFileSync('output/css/variables.css', out + '/tokens.css')
fs.writeFileSync(out + '/index.json', JSON.stringify({
  v: 5,
  entries: {
    'button--primary': { type: 'story', id: 'button--primary', title: 'Button', name: 'Primary', tags: ['story'] },
  },
}))
fs.writeFileSync(out + '/iframe.html', '<!doctype html><html><head><link rel="stylesheet" href="tokens.css"></head>' +
  '<body class="sb-show-main" style="margin:0"><button style="background:var(--brand);color:#fff;border:0;padding:16px;font:16px sans-serif">Buy</button></body></html>')
`

const tokens = (brand: string) =>
  JSON.stringify({ brand: { $type: 'color', $value: brand } }, null, 2) + '\n'

describe.skipIf(!enabled)('dta init --diff --yes, then dta diff (spec success check)', () => {
  beforeAll(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-init-diff-e2e-')))
    write(
      'package.json',
      JSON.stringify(
        {
          name: 'storybook-project',
          private: true,
          type: 'module',
          scripts: { 'build-storybook': 'node build-storybook.mjs -o storybook-static' },
          devDependencies: { 'playwright-core': '*' },
        },
        null,
        2,
      ),
    )
    write('package-lock.json', '{"lockfileVersion":3}\n')
    write('.storybook/main.js', 'export default {}\n')
    write('build-storybook.mjs', STORYBOOK_BUILD)
    write('.gitignore', 'node_modules\nstorybook-static\noutput\n.dta\n')
    write(
      'dta.config.ts',
      [
        "import { defineConfig } from 'design-token-authority'",
        '',
        'export default defineConfig({',
        "  figma: { source: 'file' },",
        "  tokens: { dir: 'tokens' },",
        "  outputs: { formats: ['css'], css: { outDir: 'output/css' } },",
        '})',
        '',
      ].join('\n'),
    )
    write('tokens/Base.Value.json', tokens('#1d4ed8'))
    // Installed as in a real project: DTA (its bin and the config helper), playwright-core.
    write(
      'node_modules/design-token-authority/package.json',
      JSON.stringify({ name: 'design-token-authority', type: 'module', exports: './index.js' }),
    )
    write(
      'node_modules/design-token-authority/index.js',
      'export const defineConfig = (config) => config\n',
    )
    write('node_modules/.bin/dta', `#!/bin/sh\nexec node "${repoRoot}/bin/dta.js" "$@"\n`)
    fs.chmodSync(path.join(dir, 'node_modules/.bin/dta'), 0o755)
    fs.symlinkSync(
      path.dirname(createRequire(import.meta.url).resolve('playwright-core')),
      path.join(dir, 'node_modules/playwright-core'),
      'junction',
    )
    git('init', '-q', '-b', 'main')
    git('add', '.')
    git('commit', '-q', '-m', 'project')
    git('checkout', '-q', '-b', 'feature')
    write('tokens/Base.Value.json', tokens('#b91c1c'))
    git('commit', '-q', '-am', 'red brand')
  })

  afterAll(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('sets up and renders a report with screenshots, nothing edited by hand', async () => {
    let out = ''
    let err = ''
    const io = {
      cwd: dir,
      stdout: (text: string) => (out += text),
      stderr: (text: string) => (err += text),
      input: new PassThrough(),
    }
    expect(await runCli(['init', '--diff', '--yes'], io), out + err).toBe(0)
    expect(fs.existsSync(path.join(dir, '.github/workflows/dta-diff.yml'))).toBe(true)

    out = ''
    err = ''
    const code = await runCli(['diff', '--format', 'json', '-o', 'result.json'], io)
    expect(err).toBe('')
    expect(code).toBe(0)
    const result = JSON.parse(fs.readFileSync(path.join(dir, '.dta/diff/result.json'), 'utf8'))
    expect(result.stories.map((s: { id: string; status: string }) => [s.id, s.status])).toEqual([
      ['button--primary', 'changed'],
    ])
    const images = fs.readdirSync(path.join(dir, '.dta/diff'), { recursive: true }).map(String)
    expect(images.some((file) => file.endsWith('.png'))).toBe(true)
    expect(fs.existsSync(path.join(dir, '.dta/diff/index.html'))).toBe(true)
  }, 180_000)
})
