/**
 * The publish hook (`--publish`, `diff.publish`) on an existing report folder
 * (`--from-report`): no browser needed.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from '../src/index.js'

let dir: string

const RESULT = {
  schema: 'dta.diff/1',
  base: 'main',
  verdict: 'review',
  review: {
    verdict: 'review',
    changed: 1,
    explained: 1,
    tokens: [{ id: 'Brand (Base · Value)', stories: ['card@320'], needsReview: true }],
    unexplained: [],
    added: [],
    removed: [],
  },
  tokens: { counts: { changed: 1, added: 0, removed: 0, affected: 0 }, changes: [] },
  stories: [
    {
      id: 'card',
      title: 'card',
      url: '/stories/card/',
      viewport: 320,
      status: 'changed',
      ratio: 0.1,
      changedPixels: 10,
      images: { base: 'base/card@320.png', head: 'head/card@320.png', diff: 'diff/card@320.png' },
    },
  ],
}

async function run(args: string[], config: object = { tokens: { dir: 'tokens' } }) {
  fs.writeFileSync(path.join(dir, 'dta.config.json'), JSON.stringify(config))
  let stdout = ''
  let stderr = ''
  const exitCode = await runCli(['diff', ...args], {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    input: new PassThrough(),
  })
  return { exitCode, stdout, stderr }
}

const report = () => path.join(dir, '.dta', 'diff')
const read = (file: string) => fs.readFileSync(path.join(report(), file), 'utf8')

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-publish-')))
  fs.mkdirSync(report(), { recursive: true })
  fs.writeFileSync(path.join(report(), 'result.json'), JSON.stringify(RESULT))
  fs.writeFileSync(path.join(report(), 'summary.md'), 'old')
  // A hook that records how it was called and prints a URL on its last line.
  fs.writeFileSync(
    path.join(dir, 'hook.mjs'),
    `import fs from 'node:fs'
fs.writeFileSync('hook-call.json', JSON.stringify({ arg: process.argv[2], env: process.env.DTA_REPORT_DIR }))
console.log('uploading…')
console.log('https://reports.example.com/pr-7/')`,
  )
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('dta diff --publish --from-report', () => {
  it('runs the hook on the report folder and rewrites the links', async () => {
    const { exitCode, stdout, stderr } = await run(['--from-report', '--publish', 'node hook.mjs'])
    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe('https://reports.example.com/pr-7')
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'hook-call.json'), 'utf8'))).toEqual({
      arg: report(),
      env: report(),
    })
    expect(JSON.parse(read('result.json')).publish).toEqual({
      url: 'https://reports.example.com/pr-7',
      report: 'https://reports.example.com/pr-7/index.html',
    })
    const summary = read('summary.md')
    expect(summary).toContain('[Open the full report](https://reports.example.com/pr-7/index.html)')
    expect(summary).toContain('<img src="https://reports.example.com/pr-7/diff/card@320.png"')
  })

  it('takes the hook and a URL pattern from diff.publish', async () => {
    fs.writeFileSync(
      path.join(dir, 'json-hook.mjs'),
      `console.log(JSON.stringify({ deployment: { url: 'https://d.example.com/abc' } }))`,
    )
    const { exitCode } = await run(['--from-report'], {
      tokens: { dir: 'tokens' },
      diff: { outDir: 'dist', publish: { command: 'node json-hook.mjs', url: '$.deployment.url' } },
    })
    expect(exitCode).toBe(0)
    expect(JSON.parse(read('result.json')).publish.url).toBe('https://d.example.com/abc')
  })

  it('fails loudly when the hook fails or prints no URL, and keeps the report', async () => {
    const failed = await run(['--from-report', '--publish', 'node -e "process.exit(3)"'])
    expect(failed.exitCode).toBe(1)
    expect(failed.stderr).toContain('failed (exit 3)')
    const silent = await run(['--from-report', '--publish', 'node -e "console.log(1)"'])
    expect(silent.exitCode).toBe(1)
    expect(silent.stderr).toContain('printed no URL on its last line')
    expect(JSON.parse(read('result.json')).publish).toBeUndefined()
  })

  it('needs a hook and an earlier report', async () => {
    expect((await run(['--from-report'])).stderr).toContain('needs a publish hook')
    fs.rmSync(report(), { recursive: true })
    expect((await run(['--from-report', '--publish', 'node hook.mjs'])).stderr).toContain(
      'no result.json',
    )
  })
})
