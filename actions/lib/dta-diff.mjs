// The GitHub layer of `dta diff` (spec decision 12): a status check and one sticky pull-request
// comment from a report folder, and approval by label. Plain Node (no dependencies) so the
// composite actions can run it on any runner: `node dta-diff.mjs <command> --flag value …`.
//
//   report   --dir <report folder> --sha <head sha> [--pr <n>] [--head-owner o --head-branch b]
//            [--artifact-url <url>] [--label dta-diff-approved]
//   approve  --pr <n> --sha <head sha> --user <login> [--label …] [--removed]
//
// Environment: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), GITHUB_API_URL (optional).

import fs from 'node:fs'
import path from 'node:path'

export const CONTEXT = 'dta diff'
export const MARKER = '<!-- dta-diff -->'
export const DEFAULT_LABEL = 'dta-diff-approved'

/** Minimal GitHub REST client over fetch (injectable for tests). */
export function github({
  token,
  repository,
  apiUrl = 'https://api.github.com',
  fetch = globalThis.fetch,
}) {
  const call = async (method, route, body, allowMissing = false) => {
    const response = await fetch(`${apiUrl}/repos/${repository}${route}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (response.status === 404 && (method === 'DELETE' || allowMissing)) return null
    if (!response.ok) {
      throw new Error(`GitHub ${method} ${route}: ${response.status} ${await response.text()}`)
    }
    return response.status === 204 ? null : response.json()
  }
  return {
    get: (route) => call('GET', route),
    /** GET that returns null for 404 instead of throwing. */
    find: (route) => call('GET', route, undefined, true),
    post: (route, body) => call('POST', route, body),
    patch: (route, body) => call('PATCH', route, body),
    delete: (route) => call('DELETE', route),
  }
}

/** State the sticky comment carries between runs (and for approval), as a hidden line. */
export function readState(body) {
  const match = /<!-- dta-diff-state (\{.*?\}) -->/.exec(body ?? '')
  if (!match) return {}
  try {
    return JSON.parse(match[1])
  } catch {
    return {}
  }
}
const stateLine = (state) => `<!-- dta-diff-state ${JSON.stringify(state)} -->`

/** Commit status for a verdict; an approval of this SHA turns any verdict into success. */
export function statusFor(verdict, { approvedBy, label = DEFAULT_LABEL } = {}) {
  if (approvedBy) return { state: 'success', description: `Approved by @${approvedBy}` }
  switch (verdict) {
    case 'pass':
      return { state: 'success', description: 'No visual changes to review' }
    case 'review':
      return { state: 'pending', description: `Changes to review: add the ${label} label` }
    case 'fail':
      return { state: 'failure', description: `Unexplained changes: review, then add ${label}` }
    default:
      return { state: 'success', description: 'Token changes only (no stories rendered)' }
  }
}

const HEADLINE = {
  pass: '✅ **dta diff: pass**',
  review: '🟠 **dta diff: changes to review**',
  fail: '🔴 **dta diff: unexplained changes**',
}

/**
 * The DTA mark, served by the website (TICKET-144; site/src/lib/brand-mark.ts). Comments
 * already posted load these URLs, so they stay as they are.
 */
export const MARK = {
  light: 'https://dta.martinprinz.dev/brand/dta-mark-light.svg',
  dark: 'https://dta.martinprinz.dev/brand/dta-mark-dark.svg',
}

/**
 * The comment's first line: the mark (GitHub picks the dark file in its dark theme), then the
 * verdict. The mark is decorative (empty alt); the emoji and the text carry the verdict for
 * screen readers and e-mail notifications.
 */
export function headline(verdict) {
  const icon =
    `<picture><source media="(prefers-color-scheme: dark)" srcset="${MARK.dark}">` +
    `<img src="${MARK.light}" width="20" height="20" alt="" align="top"></picture>`
  return `${icon} ${HEADLINE[verdict] ?? '**dta diff**'}`
}

const APPROVAL = /<!-- dta-diff-approval -->[\s\S]*?<!-- \/dta-diff-approval -->/

/** The approval line, between markers so `approve` can replace it. */
export function approvalBlock(state, label = DEFAULT_LABEL) {
  const sha = state.sha.slice(0, 7)
  const text =
    state.approvedBy && state.approvedSha === state.sha
      ? `Approved by @${state.approvedBy} for ${sha}.`
      : state.verdict && state.verdict !== 'pass'
        ? `Reviewed the changes? Add the \`${label}\` label to approve ${sha}. A new push needs a new review.`
        : ''
  return `<!-- dta-diff-approval -->${text ? `\n\n${text}\n` : ''}<!-- /dta-diff-approval -->`
}

/** The sticky comment: verdict, approval, where the report is, then summary.md. */
export function commentBody({ result, summary, state, artifactUrl, label = DEFAULT_LABEL }) {
  const lines = [MARKER, stateLine(state)]
  lines.push(headline(result.verdict))
  lines.push(approvalBlock(state, label))
  if (!result.publish) {
    lines.push(
      '',
      artifactUrl
        ? `No publish hook is configured, so there are no images here: the full report is in the [workflow run's artifacts](${artifactUrl}) (open \`index.html\`).`
        : "No publish hook is configured: the full report is in the workflow run's artifacts (open `index.html`).",
    )
  }
  lines.push('', summary.trim(), '')
  return lines.join('\n')
}

/** The pull request a head SHA belongs to: the hint, checked, or found by head branch. */
export async function resolvePullRequest(api, { pr, sha, headOwner, headBranch }) {
  if (pr) {
    const found = await api.get(`/pulls/${Number(pr)}`)
    if (found.head.sha !== sha) {
      throw new Error(`PR #${pr} is at ${found.head.sha.slice(0, 7)}, not ${sha.slice(0, 7)}.`)
    }
    return found.number
  }
  if (headOwner && headBranch) {
    const pulls = await api.get(
      `/pulls?state=open&head=${encodeURIComponent(`${headOwner}:${headBranch}`)}`,
    )
    const match = pulls.find((p) => p.head.sha === sha)
    if (match) return match.number
  }
  return null
}

async function findComment(api, pr) {
  for (let page = 1; page <= 20; page++) {
    const comments = await api.get(`/issues/${pr}/comments?per_page=100&page=${page}`)
    const found = comments.find((c) => c.body?.startsWith(MARKER))
    if (found) return found
    if (comments.length < 100) return null
  }
  return null
}

async function upsertComment(api, pr, body) {
  const existing = await findComment(api, pr)
  if (existing) return api.patch(`/issues/comments/${existing.id}`, { body })
  return api.post(`/issues/${pr}/comments`, { body })
}

/**
 * Creates the approval label when the repository does not have it yet, so the comment's "add
 * the label" works without setup. Best effort: a token that may not create labels only warns.
 */
export async function ensureLabel(api, label = DEFAULT_LABEL) {
  try {
    if (await api.find(`/labels/${encodeURIComponent(label)}`)) return false
    await api.post('/labels', {
      name: label,
      color: '2da44e',
      description: 'dta diff: the visual changes of the head commit are reviewed',
    })
    return true
  } catch (error) {
    console.warn(`dta diff (GitHub): could not create the label "${label}": ${error.message}`)
    return false
  }
}

const hasLabel = async (api, pr, label) =>
  (await api.get(`/issues/${pr}/labels`)).some((l) => l.name === label)

/**
 * After a run: status on the head SHA and the sticky comment. An approval label left from an
 * earlier SHA is removed (a new push needs a new review).
 */
export async function report(api, options) {
  const label = options.label ?? DEFAULT_LABEL
  const result = JSON.parse(fs.readFileSync(path.join(options.dir, 'result.json'), 'utf8'))
  const summary = fs.readFileSync(path.join(options.dir, 'summary.md'), 'utf8')
  const pr = await resolvePullRequest(api, options)
  const sha = options.sha

  const existing = pr ? await findComment(api, pr) : null
  const previous = readState(existing?.body)
  const approved = previous.approvedSha === sha ? previous.approvedBy : undefined
  if (pr && result.verdict && result.verdict !== 'pass') await ensureLabel(api, label)
  if (pr && !approved && (await hasLabel(api, pr, label))) {
    await api.delete(`/issues/${pr}/labels/${encodeURIComponent(label)}`)
  }

  const state = {
    sha,
    verdict: result.verdict ?? null,
    ...(approved ? { approvedSha: sha, approvedBy: approved } : {}),
  }
  const status = statusFor(result.verdict, { approvedBy: approved, label })
  await api.post(`/statuses/${sha}`, {
    context: CONTEXT,
    ...status,
    ...(result.publish?.report || options.artifactUrl
      ? { target_url: result.publish?.report ?? options.artifactUrl }
      : {}),
  })
  if (pr) {
    await upsertComment(
      api,
      pr,
      commentBody({ result, summary, state, artifactUrl: options.artifactUrl, label }),
    )
  }
  return { pr, status, state }
}

/** On `labeled` / `unlabeled`: approve (or withdraw approval of) the head SHA. */
export async function approve(api, options) {
  const label = options.label ?? DEFAULT_LABEL
  const pr = Number(options.pr)
  const sha = options.sha
  const existing = await findComment(api, pr)
  const previous = readState(existing?.body)
  // The verdict belongs to the SHA it was computed for; a newer head has none yet.
  const verdict = previous.sha === sha ? (previous.verdict ?? null) : null
  const state = options.removed
    ? { sha, verdict }
    : { sha, verdict, approvedSha: sha, approvedBy: options.user }
  const status = statusFor(verdict ?? undefined, {
    approvedBy: state.approvedBy,
    label,
  })
  // Before the run for this SHA has reported, only the approval is recorded; the run picks it up.
  if (previous.sha === sha) await api.post(`/statuses/${sha}`, { context: CONTEXT, ...status })
  if (existing) {
    const body = existing.body
      .replace(/<!-- dta-diff-state \{.*?\} -->/, stateLine(state))
      .replace(APPROVAL, approvalBlock(state, label))
    await api.patch(`/issues/comments/${existing.id}`, { body })
  }
  return { status, state }
}

function parseArgs(argv) {
  const options = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) options[key] = true
    else options[key] = argv[++i]
  }
  return options
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const options = parseArgs(rest)
  const api = github({
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
    apiUrl: process.env.GITHUB_API_URL,
  })
  const out = command === 'report' ? await report(api, options) : await approve(api, options)
  console.log(JSON.stringify(out))
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `state=${out.status.state}\n`)
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
) {
  main().catch((error) => {
    console.error(`dta diff (GitHub): ${error.message}`)
    process.exit(1)
  })
}
