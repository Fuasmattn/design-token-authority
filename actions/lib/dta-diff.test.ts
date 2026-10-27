import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parse } from 'yaml'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
// @ts-expect-error plain JS module (runs on GitHub runners without a build step)
import * as lib from './dta-diff.mjs'

const SHA = 'a'.repeat(40)
const NEW_SHA = 'b'.repeat(40)

interface Comment {
  id: number
  body: string
}

/** In-memory GitHub: one pull request, its labels, comments and commit statuses. */
function fakeGitHub(headSha = SHA) {
  const db = {
    head: headSha,
    labels: [] as string[],
    repoLabels: [] as string[],
    comments: [] as Comment[],
    statuses: [] as Array<{ sha: string; state: string; description: string; target_url?: string }>,
    calls: [] as string[],
  }
  const api = {
    async get(route: string) {
      db.calls.push(`GET ${route}`)
      if (route === '/pulls/7') return { number: 7, head: { sha: db.head } }
      if (route.startsWith('/pulls?')) return [{ number: 7, head: { sha: db.head } }]
      if (route === '/issues/7/labels') return db.labels.map((name) => ({ name }))
      if (route.startsWith('/issues/7/comments')) return db.comments
      throw new Error(`unexpected GET ${route}`)
    },
    async find(route: string) {
      db.calls.push(`GET ${route}`)
      const name = decodeURIComponent(route.replace('/labels/', ''))
      return db.repoLabels.includes(name) ? { name } : null
    },
    async post(route: string, body: Record<string, string>) {
      db.calls.push(`POST ${route}`)
      if (route === '/labels') {
        db.repoLabels.push(body.name)
        return {}
      }
      if (route.startsWith('/statuses/')) {
        db.statuses.push({ sha: route.slice(10), ...body } as never)
        return {}
      }
      if (route === '/issues/7/comments') {
        db.comments.push({ id: db.comments.length + 1, body: body.body })
        return {}
      }
      throw new Error(`unexpected POST ${route}`)
    },
    async patch(route: string, body: { body: string }) {
      db.calls.push(`PATCH ${route}`)
      const id = Number(route.split('/').at(-1))
      const comment = db.comments.find((c) => c.id === id)
      if (!comment) throw new Error('no comment')
      comment.body = body.body
      return {}
    },
    async delete(route: string) {
      db.calls.push(`DELETE ${route}`)
      db.labels = db.labels.filter((l) => `/issues/7/labels/${encodeURIComponent(l)}` !== route)
      return null
    },
  }
  return { db, api }
}

let dir: string
function writeReport(result: object, summary = '## dta diff: stories\n\n**1 changed**\n') {
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result))
  fs.writeFileSync(path.join(dir, 'summary.md'), summary)
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-gh-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('statusFor', () => {
  it('maps verdicts to commit statuses, and an approval to success', () => {
    expect(lib.statusFor('pass').state).toBe('success')
    expect(lib.statusFor('review')).toEqual({
      state: 'pending',
      description: 'Changes to review: add the dta-diff-approved label',
    })
    expect(lib.statusFor('fail').state).toBe('failure')
    expect(lib.statusFor('fail', { approvedBy: 'ana' })).toEqual({
      state: 'success',
      description: 'Approved by @ana',
    })
    expect(lib.statusFor(undefined).state).toBe('success')
  })
})

describe('report', () => {
  it('sets the status and creates one sticky comment, then updates it in place', async () => {
    const { db, api } = fakeGitHub()
    writeReport({ verdict: 'review' })
    await lib.report(api, { dir, sha: SHA, pr: '7', artifactUrl: 'https://gh/run/1' })
    expect(db.statuses).toEqual([
      {
        sha: SHA,
        context: 'dta diff',
        state: 'pending',
        description: 'Changes to review: add the dta-diff-approved label',
        target_url: 'https://gh/run/1',
      },
    ])
    expect(db.comments).toHaveLength(1)
    const body = db.comments[0].body
    expect(body.startsWith('<!-- dta-diff -->')).toBe(true)
    expect(body).toContain(`${lib.headline('review')}\n`)
    expect(body).toContain('🟠 **dta diff: changes to review**')
    expect(body).toContain('Add the `dta-diff-approved` label to approve aaaaaaa.')
    expect(body).toContain("[workflow run's artifacts](https://gh/run/1)")
    expect(body).toContain('**1 changed**')

    writeReport({ verdict: 'pass' }, 'all good')
    await lib.report(api, { dir, sha: SHA, pr: '7' })
    expect(db.comments).toHaveLength(1)
    expect(db.comments[0].body).toContain('✅ **dta diff: pass**')
    expect(db.comments[0].body).not.toContain('Add the')
  })

  it('opens the headline with the DTA mark for light and dark themes (TICKET-144)', () => {
    expect(lib.MARK).toEqual({
      light: 'https://dta.martinprinz.dev/brand/dta-mark-light.svg',
      dark: 'https://dta.martinprinz.dev/brand/dta-mark-dark.svg',
    })
    const icon =
      '<picture><source media="(prefers-color-scheme: dark)" srcset="https://dta.martinprinz.dev/brand/dta-mark-dark.svg">' +
      '<img src="https://dta.martinprinz.dev/brand/dta-mark-light.svg" width="20" height="20" alt="" align="top"></picture>'
    expect(lib.headline('pass')).toBe(`${icon} ✅ **dta diff: pass**`)
    expect(lib.headline('review')).toBe(`${icon} 🟠 **dta diff: changes to review**`)
    expect(lib.headline('fail')).toBe(`${icon} 🔴 **dta diff: unexplained changes**`)
    // Token changes only (no verdict): the mark and the name.
    expect(lib.headline(undefined)).toBe(`${icon} **dta diff**`)
    // An approval of the head commit (TICKET-148); a pass needs none, so it stays a pass.
    expect(lib.headline('review', { approved: true })).toBe(`${icon} ✅ **dta diff: approved**`)
    expect(lib.headline('fail', { approved: true })).toBe(`${icon} ✅ **dta diff: approved**`)
    expect(lib.headline('pass', { approved: true })).toBe(`${icon} ✅ **dta diff: pass**`)
    // The marker and the state line stay first, so comments posted before are found again.
    const body = lib.commentBody({
      result: { verdict: 'pass' },
      summary: '',
      state: { sha: SHA, verdict: 'pass' },
    })
    expect(body.split('\n').slice(0, 3)).toEqual([
      '<!-- dta-diff -->',
      `<!-- dta-diff-state ${JSON.stringify({ sha: SHA, verdict: 'pass' })} -->`,
      lib.headline('pass'),
    ])
  })

  it('links the published report instead of the artifact', async () => {
    const { db, api } = fakeGitHub()
    writeReport({
      verdict: 'review',
      publish: { url: 'https://r.example.com', report: 'https://r.example.com/index.html' },
    })
    await lib.report(api, { dir, sha: SHA, pr: '7', artifactUrl: 'https://gh/run/1' })
    expect(db.statuses[0].target_url).toBe('https://r.example.com/index.html')
    expect(db.comments[0].body).not.toContain('artifacts')
  })

  it('ends quietly when the pull request has moved past the reported commit (TICKET-158)', async () => {
    // Two pushes minutes apart: the report for the first lands after the second has its own run.
    // Posting would put a status on an old commit and a stale comment over the newer report;
    // failing the job painted a red run for a report nobody needed.
    const { db, api } = fakeGitHub(NEW_SHA)
    writeReport({ verdict: 'pass' })
    const out = await lib.report(api, { dir, sha: SHA, pr: '7' })
    expect(out).toMatchObject({ pr: null, superseded: true, status: { state: 'superseded' } })
    expect(db.statuses).toEqual([])
    expect(db.comments).toEqual([])
    expect(db.calls.filter((c) => !c.startsWith('GET'))).toEqual([])
  })

  it('finds the pull request by head branch when there is no hint (forks)', async () => {
    const { db, api } = fakeGitHub()
    writeReport({ verdict: 'pass' })
    const out = await lib.report(api, { dir, sha: SHA, headOwner: 'someone', headBranch: 'x' })
    expect(out.pr).toBe(7)
    expect(db.calls).toContain('GET /pulls?state=open&head=someone%3Ax')
  })
})

describe('the approval label', () => {
  it('is created on the first run that needs a review, once', async () => {
    const { db, api } = fakeGitHub()
    writeReport({ verdict: 'review' })
    await lib.report(api, { dir, sha: SHA, pr: '7' })
    expect(db.repoLabels).toEqual(['dta-diff-approved'])
    await lib.report(api, { dir, sha: SHA, pr: '7' })
    expect(db.calls.filter((c) => c === 'POST /labels')).toHaveLength(1)
  })

  it('is not created for a run that passes', async () => {
    const { db, api } = fakeGitHub()
    writeReport({ verdict: 'pass' })
    await lib.report(api, { dir, sha: SHA, pr: '7' })
    expect(db.repoLabels).toEqual([])
  })
})

describe('approval by label', () => {
  it('approves the reported head commit and records it in the comment', async () => {
    const { db, api } = fakeGitHub()
    writeReport({ verdict: 'fail' })
    await lib.report(api, { dir, sha: SHA, pr: '7' })
    db.labels.push('dta-diff-approved')
    await lib.approve(api, { pr: '7', sha: SHA, user: 'ana' })
    expect(db.statuses.at(-1)).toMatchObject({
      sha: SHA,
      state: 'success',
      description: 'Approved by @ana',
    })
    expect(db.comments[0].body).toContain('Approved by @ana for aaaaaaa.')
    expect(db.comments[0].body).not.toContain('Add the')
    // The headline says so too (TICKET-148), right after the state line as before.
    expect(db.comments[0].body.split('\n')[2]).toBe(lib.headline('fail', { approved: true }))
    expect(db.comments[0].body).toContain('✅ **dta diff: approved**')
    expect(lib.readState(db.comments[0].body)).toEqual({
      sha: SHA,
      verdict: 'fail',
      approvedSha: SHA,
      approvedBy: 'ana',
    })

    // A rerun for the same commit keeps the approval, the label and the headline.
    await lib.report(api, { dir, sha: SHA, pr: '7' })
    expect(db.statuses.at(-1)?.state).toBe('success')
    expect(db.labels).toEqual(['dta-diff-approved'])
    expect(db.comments[0].body.split('\n')[2]).toBe(lib.headline('fail', { approved: true }))
  })

  it('needs a new review after a new push: the label is removed', async () => {
    const { db, api } = fakeGitHub()
    writeReport({ verdict: 'review' })
    await lib.report(api, { dir, sha: SHA, pr: '7' })
    db.labels.push('dta-diff-approved')
    await lib.approve(api, { pr: '7', sha: SHA, user: 'ana' })

    db.head = NEW_SHA
    await lib.report(api, { dir, sha: NEW_SHA, pr: '7' })
    expect(db.labels).toEqual([])
    expect(db.statuses.at(-1)).toMatchObject({ sha: NEW_SHA, state: 'pending' })
    expect(db.comments[0].body).toContain('to approve bbbbbbb')
    expect(db.comments[0].body.split('\n')[2]).toBe(lib.headline('review'))
  })

  it('withdraws the approval when the label is removed', async () => {
    const { db, api } = fakeGitHub()
    writeReport({ verdict: 'review' })
    await lib.report(api, { dir, sha: SHA, pr: '7' })
    await lib.approve(api, { pr: '7', sha: SHA, user: 'ana' })
    await lib.approve(api, { pr: '7', sha: SHA, user: 'ana', removed: true })
    expect(db.statuses.at(-1)?.state).toBe('pending')
    expect(db.comments[0].body).toContain('Add the `dta-diff-approved` label')
    expect(db.comments[0].body.split('\n')[2]).toBe(lib.headline('review'))
    expect(db.comments[0].body).not.toContain('dta diff: approved')
  })

  it('records an approval that arrives before the run reports, without a status', async () => {
    const { db, api } = fakeGitHub()
    writeReport({ verdict: 'review' })
    await lib.report(api, { dir, sha: SHA, pr: '7' })
    const statuses = db.statuses.length
    db.head = NEW_SHA
    db.labels.push('dta-diff-approved')
    await lib.approve(api, { pr: '7', sha: NEW_SHA, user: 'ana' })
    expect(db.statuses).toHaveLength(statuses)
    // The comment still shows the older commit's run: its headline does not say approved yet.
    expect(db.comments[0].body.split('\n')[2]).toBe(lib.headline('review'))
    await lib.report(api, { dir, sha: NEW_SHA, pr: '7' })
    expect(db.statuses.at(-1)).toMatchObject({ sha: NEW_SHA, state: 'success' })
    expect(db.comments[0].body.split('\n')[2]).toBe(lib.headline('review', { approved: true }))
    expect(db.labels).toEqual(['dta-diff-approved'])
  })
})

describe('actions and example workflows', () => {
  const root = path.resolve(import.meta.dirname, '..')
  const load = (file: string) => parse(fs.readFileSync(path.join(root, file), 'utf8'))

  it('are composite actions that call the shared script', () => {
    for (const name of ['diff', 'diff-pr', 'diff-report', 'diff-approve']) {
      const action = load(`${name}/action.yml`)
      expect(action.runs.using).toBe('composite')
      expect(action.name).toMatch(/^dta diff/)
    }
    expect(JSON.stringify(load('diff-report/action.yml'))).toContain('lib/dta-diff.mjs')
    // diff and diff-pr run dta diff the same way.
    for (const name of ['diff', 'diff-pr'])
      expect(JSON.stringify(load(`${name}/action.yml`))).toContain('lib/run-diff.sh')
    expect(JSON.stringify(load('diff-pr/action.yml'))).toContain('lib/dta-diff.mjs')
  })

  it('keep untrusted runs read-only and give the trusted ones minimal permissions', () => {
    const run = load('examples/dta-diff.yml')
    expect(Object.keys(run.on)).toEqual(['pull_request'])
    expect(run.permissions).toEqual({ contents: 'read' })
    expect(JSON.stringify(run)).not.toContain('secrets.')

    const report = load('examples/dta-diff-report.yml')
    expect(Object.keys(report.on)).toEqual(['workflow_run'])
    expect(report.permissions).toEqual({
      actions: 'read',
      'pull-requests': 'write',
      statuses: 'write',
    })

    // One file (private and team repositories): write permissions, so no workflow_run split.
    const single = load('examples/dta-diff-single.yml')
    expect(single.on.pull_request.types).toContain('labeled')
    expect(single.permissions).toEqual({
      contents: 'read',
      'pull-requests': 'write',
      statuses: 'write',
    })
    // The publish secret only on the step that publishes, never on the job or the install.
    const steps = single.jobs.diff.steps as Array<{ uses?: string; env?: object }>
    const withSecrets = steps.filter((step) => JSON.stringify(step).includes('secrets.'))
    expect(withSecrets.map((step) => step.uses)).toEqual([
      expect.stringMatching(/^Fuasmattn\/design-token-authority\/actions\/diff-pr@v\d+\.\d+\.\d+/),
    ])
    expect(
      JSON.stringify({
        ...single,
        jobs: { ...single.jobs, diff: { ...single.jobs.diff, steps: [] } },
      }),
    ).not.toContain('secrets.')

    const approve = load('examples/dta-diff-approve.yml')
    expect(approve.on.pull_request_target.types).toEqual(['labeled', 'unlabeled'])
    expect(JSON.stringify(approve)).not.toContain('checkout')
  })
})
