/**
 * The publish recipes the website documents, run once each against local stand-ins: a served
 * folder for the static server, a bare repository for the GitHub assets branch. (Vercel needs a
 * real account; it is checked by hand, see the guide.)
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let tmp: string
let report: string
const sha = 'c'.repeat(40)

function sh(script: string, args: string[], env: Record<string, string>) {
  return execFileSync('sh', [path.join(import.meta.dirname, script), ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-recipe-')))
  report = path.join(tmp, 'report')
  fs.mkdirSync(path.join(report, 'diff'), { recursive: true })
  fs.writeFileSync(path.join(report, 'index.html'), '<!doctype html>report')
  fs.writeFileSync(path.join(report, 'diff', 'card@320.png'), 'png')
  fs.writeFileSync(path.join(report, 'pull-request.json'), JSON.stringify({ pr: 12, sha }))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('static server recipe', () => {
  it('copies the report under the commit and prints its URL last', () => {
    const root = path.join(tmp, 'www')
    const out = sh('static-server.sh', [report], {
      DTA_DIFF_ROOT: root,
      DTA_DIFF_BASE_URL: 'https://diff.example.internal',
      GITHUB_SHA: sha,
    })
    expect(out.trim().split('\n').at(-1)).toBe(`https://diff.example.internal/${sha}`)
    expect(fs.readFileSync(path.join(root, sha, 'diff', 'card@320.png'), 'utf8')).toBe('png')
  })
})

describe('template for any host', () => {
  it('prints the folder URL as its last line and logs to stderr', () => {
    const out = sh('template.sh', [report], { GITHUB_SHA: sha })
    expect(out.trim().split('\n')).toEqual([`https://reports.example.com/${sha}`])
  })
})

describe('GitHub assets branch recipe', () => {
  it('commits the report under pr-<n>/<sha>/, keeps one per PR, and cleans up on close', () => {
    const remote = path.join(tmp, 'remote.git')
    git(tmp, 'init', '--quiet', '--bare', remote)
    const env = { DTA_DIFF_REMOTE: remote, GITHUB_REPOSITORY: 'owner/repo' }

    const out = sh('github-assets-branch.sh', [report], env)
    expect(out.trim()).toBe(`https://github.com/owner/repo/raw/dta-diff-assets/pr-12/${sha}`)
    const files = () =>
      git(tmp, '--git-dir', remote, 'ls-tree', '-r', '--name-only', 'dta-diff-assets').split('\n')
    expect(files()).toEqual([
      `pr-12/${sha}/diff/card@320.png`,
      `pr-12/${sha}/index.html`,
      `pr-12/${sha}/pull-request.json`,
    ])

    // A new push replaces the PR's report; another PR's report stays.
    const next = 'd'.repeat(40)
    fs.writeFileSync(path.join(report, 'pull-request.json'), JSON.stringify({ pr: 12, sha: next }))
    sh('github-assets-branch.sh', [report], env)
    fs.writeFileSync(path.join(report, 'pull-request.json'), JSON.stringify({ pr: 13, sha }))
    const pages = sh('github-assets-branch.sh', [report], {
      ...env,
      DTA_DIFF_PAGES_URL: 'https://owner.github.io/repo',
    })
    expect(pages.trim()).toBe(`https://owner.github.io/repo/pr-13/${sha}`)
    expect(files().filter((f) => f.endsWith('index.html'))).toEqual([
      `pr-12/${next}/index.html`,
      `pr-13/${sha}/index.html`,
    ])

    sh('github-assets-branch-cleanup.sh', ['12'], env)
    expect(files().every((f) => f.startsWith('pr-13/'))).toBe(true)
    // Nothing to clean: no error.
    sh('github-assets-branch-cleanup.sh', ['99'], env)
  })
})
