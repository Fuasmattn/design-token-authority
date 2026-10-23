import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { cssBindings, type BuildOptions } from '@dta/build'
import {
  formatDiagnostic,
  hasErrors,
  parseTokenFiles,
  type TokenFileInput,
  type TokenModel,
} from '@dta/core'
import {
  attributePixels,
  compareStories,
  DEPENDENTS_SCRIPT,
  diffTokens,
  diffResultSchema,
  extractPublishUrl,
  PAGE_DECLARATIONS_SCRIPT,
  planReverts,
  renderReportHtml,
  renderSummaryMarkdown,
  reviewStories,
  VERDICT_TEXT,
  type Dependent,
  type DiffLabels,
  type DiffResult,
  type PageDeclaration,
  type Review,
  type RevertPlan,
  pageStories,
  readStoriesManifest,
  readStorybookIndex,
  storyImagePaths,
  summarizeStories,
  toDiffJson,
  type DiffConfig,
  type StoryRef,
  type StoryResult,
  formatState,
  renderTokenChangesMarkdown,
  summarizeCounts,
  toJson,
  type TokenChange,
  type TokenChangeSet,
} from '@dta/visual-diff'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { diffProblems, docsUrl, formatProblem, type DiffProblem } from '../diff-problems.js'
import { BaseBuildError, buildBase } from '../io/base-build.js'
import { BrowserUnavailableError, launchScreenshotter } from '../io/browser.js'
import {
  defaultBranch,
  DiffBaseError,
  gitOutput,
  resolveDiffBase,
  resolveDiffHead,
} from '../io/diff-base.js'
import { CommandFailedError, runCommand } from '../io/run-command.js'
import { serveStatic } from '../io/static-server.js'
import { createBaseWorktree } from '../io/worktree.js'
import { readTokenDir, TokenDirError, tokenParseOptions } from '../io/token-dir.js'
import { banner, createUi } from '../ui.js'
import { breakpointOptions } from './build.js'

const FORMATS = ['console', 'markdown', 'json'] as const
type Format = (typeof FORMATS)[number]

const KIND_STYLE: Record<TokenChange['kind'], (text: string) => string> = {
  changed: pc.yellow,
  added: pc.green,
  removed: pc.red,
  affected: pc.cyan,
}

/** Markdown in the console, without the table syntax. */
const plain = (text: string) => text.replace(/`/g, '')

function consoleReport(set: TokenChangeSet): string {
  return set.changes
    .map((change) => {
      const label = KIND_STYLE[change.kind](change.kind.padEnd(8))
      const where = pc.dim(`${change.collection} · ${change.mode}`)
      const values =
        change.kind === 'added'
          ? plain(formatState(change.after))
          : change.kind === 'removed'
            ? plain(formatState(change.before))
            : `${plain(formatState(change.before))} ${pc.dim('→')} ${plain(formatState(change.after))}`
      const because = change.causes?.length
        ? pc.dim(`  (because of ${change.causes.join(', ')})`)
        : ''
      return `${label} ${change.name}  ${where}\n         ${values}${because}`
    })
    .join('\n')
}

/**
 * `dta diff`: compares the project's tokens with a base (a directory, a git ref, or the merge
 * base with the default branch) and, with a `diff` section and a git base, renders the stories
 * of the base and the head and compares the screenshots (report in `.dta/diff/`).
 */
export async function runDiff(context: CommandContext): Promise<number> {
  const tokensDir = context.config?.tokens.dir ?? 'tokens'
  const requested = String(context.options.format ?? 'console')
  const out = typeof context.options.out === 'string' ? context.options.out : undefined
  const base =
    typeof context.options.base === 'string' ? context.options.base : context.config?.diff?.base
  const failOnChange = Boolean(context.options.failOnChange)
  const ui = createUi(context.stdout)
  const fail = (problem: DiffProblem) => {
    context.stderr(formatProblem(problem))
    return 1
  }

  if (!FORMATS.includes(requested as Format)) {
    return fail(diffProblems.unknownFormat(requested, FORMATS))
  }
  const format = requested as Format

  if (context.options.list) return listStories(context, format, fail)
  if (context.options.check) return checkSetup(context, base)
  const reportDir = path.resolve(
    context.cwd,
    typeof context.options.report === 'string' ? context.options.report : '.dta/diff',
  )
  const hook = publishHook(context)
  if (context.options.fromReport) {
    if (!hook) return fail(diffProblems.fromReportWithoutHook())
    if (!fs.existsSync(path.join(reportDir, 'result.json'))) {
      return fail(
        diffProblems.fromReportWithoutResult(path.relative(context.cwd, reportDir) || '.'),
      )
    }
    const published = publishReport(context, reportDir, hook)
    if (!published.ok) return fail(diffProblems.publishFailed(published.message))
    context.stdout(`${published.url}\n`)
    return 0
  }

  let headFiles: TokenFileInput[]
  let baseInfo
  try {
    headFiles = readTokenDir(tokensDir, context.cwd)
    baseInfo = resolveDiffBase(context.cwd, tokensDir, base)
  } catch (error) {
    if (error instanceof TokenDirError) return fail(diffProblems.noTokens(error.message))
    if (error instanceof DiffBaseError) return fail(diffProblems.noBase(error.message))
    throw error
  }

  const head = parseTokenFiles(headFiles, tokenParseOptions(context.config))
  // The base may predate the resolver document the config names (a migration to one): its files
  // are read without the resolver options then.
  const baseHasResolver = baseInfo.files.some((f) => f.fileName.endsWith('.resolver.json'))
  const before = parseTokenFiles(
    baseInfo.files,
    baseHasResolver ? tokenParseOptions(context.config) : {},
  )
  const problems = [
    ...before.diagnostics.map((d) => ({ side: 'base', d })),
    ...head.diagnostics.map((d) => ({ side: 'head', d })),
  ]
  if (hasErrors(problems.map((p) => p.d))) {
    for (const { side, d } of problems) context.stderr(`${side}: ${formatDiagnostic(d)}\n`)
    return fail(diffProblems.tokenErrors())
  }

  const set = diffTokens(before.model, head.model)
  const total = set.changes.length
  // Recorded before anything is built: the temporary worktree and the report change nothing here.
  const headInfo = resolveDiffHead(context.cwd)
  const labels: DiffLabels = { base: baseInfo.label, ...(headInfo ? { head: headInfo } : {}) }
  const log = (text: string) => format === 'console' && ui.log.message(text)

  if (format === 'console') {
    ui.intro(banner('diff'))
    ui.log.message(`${pc.dim('Base:')} ${baseInfo.label}`)
    if (total > 0) context.stdout(`\n${consoleReport(set)}\n\n`)
  }

  // Visual comparison: needs a `diff` section and a git base (the base is built from it).
  let stories: StoryResult[] | null = null
  let review: Review | undefined
  const diff = context.config?.diff
  const skip = (reason: string) => format === 'console' && ui.log.info(reason)
  if (context.options.tokensOnly) {
    // token changes only, on request
  } else if (!diff) {
    skip('No `diff` section in the config: showing token changes only.')
  } else if (!baseInfo.sha) {
    skip('The base is a directory, so there is nothing to build: showing token changes only.')
  } else {
    try {
      const plan = await planAttribution(context, set, before.model, head.model)
      stories = await compareVisually(context, diff, baseInfo.sha, plan, log)
      review = reviewStories(stories, plan.causes, diff.thresholds)
    } catch (error) {
      if (error instanceof BrowserUnavailableError) {
        // In CI a missing browser is a broken setup, not a reason to compare tokens only.
        if (isCI()) return fail(diffProblems.noBrowser(error.message))
        context.stderr(formatProblem(diffProblems.noBrowser(error.message)))
        if (format === 'console') ui.log.warn('No screenshots: showing token changes only.')
      } else if (error instanceof VisualDiffError) {
        return fail(error.problem)
      } else if (error instanceof CommandFailedError) {
        return fail(diffProblems.commandFailed(error.message, error.command))
      } else {
        throw error
      }
    }
  }
  let result: DiffResult | null = null
  let publishFailed = false
  if (stories) {
    result = writeReport(reportDir, set, stories, labels, review)
    if (hook) {
      log(`${pc.dim('Publishing:')} ${hook.command}`)
      const published = publishReport(context, reportDir, hook)
      if (published.ok) {
        result = published.result
        log(`${pc.dim('Published:')} ${published.result.publish?.report}`)
      } else {
        // Loud, but the diff result below is still printed and written.
        publishFailed = true
        context.stderr(formatProblem(diffProblems.publishFailed(published.message)))
      }
    }
    if (format === 'console') {
      context.stdout(`\n${consoleStories(stories)}\n\n`)
      if (review) context.stdout(`${consoleReview(review)}\n\n`)
      ui.log.message(
        `${pc.dim('Report:')} ${path.join(path.relative(context.cwd, reportDir) || '.', 'index.html')}`,
      )
    }
  }

  const document =
    format === 'json'
      ? result
        ? `${JSON.stringify(result, null, 2)}\n`
        : toJson(set, labels)
      : format === 'markdown'
        ? result
          ? renderSummaryMarkdown(result, { baseUrl: result.publish?.url })
          : renderTokenChangesMarkdown(set, labels)
        : null
  if (document !== null) {
    if (out) {
      const target = path.resolve(context.cwd, out)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, document, 'utf8')
    } else {
      context.stdout(document)
    }
  }
  const storiesChanged = stories?.some((s) => s.status !== 'unchanged') ?? false
  if (format === 'console') {
    const summary = summarizeCounts(set.counts)
    const tokensLine = total > 0 ? pc.yellow(`Tokens: ${summary}`) : pc.green('No token changes.')
    const storiesText = stories ? `Stories: ${summarizeStories(stories)}` : ''
    const storiesLine = stories
      ? `  ${storiesChanged ? pc.yellow(storiesText) : pc.green(storiesText)}`
      : ''
    const verdictLine = review
      ? `  ${VERDICT_STYLE[review.verdict](VERDICT_TEXT[review.verdict])}`
      : ''
    ui.outro(`${tokensLine}${storiesLine}${verdictLine}`)
  }

  if (publishFailed) return 1
  if (!failOnChange) return 0
  // With stories, only what needs a look fails: unexplained changes above the threshold and
  // explained changes not yet reviewed. Without stories, any token change does.
  if (review) return review.verdict === 'pass' ? 0 : 1
  return total > 0 || storiesChanged ? 1 : 0
}

const VERDICT_STYLE: Record<Review['verdict'], (text: string) => string> = {
  pass: pc.green,
  review: pc.yellow,
  fail: pc.red,
}

/** Build options as `dta build` uses them, so reverted variables match the project's CSS. */
function buildOptions(context: CommandContext): BuildOptions {
  const config = context.config
  return {
    brands: config?.brands ?? [],
    breakpoints: breakpointOptions(config),
    collections: config?.collections,
    css: { outDir: config?.outputs?.css?.outDir },
  }
}

/** Which CSS to put back for each changed token (from the CSS DTA builds at both sides). */
async function planAttribution(
  context: CommandContext,
  set: TokenChangeSet,
  base: TokenModel,
  head: TokenModel,
) {
  const options = buildOptions(context)
  const [baseBindings, headBindings] = await Promise.all([
    cssBindings(base, options),
    cssBindings(head, options),
  ])
  return planReverts(set, baseBindings.bindings, headBindings.bindings)
}

/** A problem with the built output (missing manifest, broken story). */
class VisualDiffError extends Error {
  constructor(readonly problem: DiffProblem) {
    super(problem.message)
  }
}

/** The configured stories source: which file in the output to read, and how. */
function storiesSource(diff: DiffConfig) {
  const options = { viewports: diff.viewports }
  const stories = diff.stories
  if (Array.isArray(stories)) return null
  if (stories.type === 'storybook') {
    return {
      file: stories.index,
      label: 'Storybook index',
      read: (json: unknown) =>
        readStorybookIndex(json, {
          ...options,
          excludeTags: stories.excludeTags,
          exclude: stories.exclude,
        }),
    }
  }
  return {
    file: stories.manifest,
    label: 'stories manifest',
    read: (json: unknown) => readStoriesManifest(json, options),
  }
}

/** The file a page path is served from: `/` → index.html, `/a` → a/index.html, a.html or a. */
function pageExists(outDir: string, url: string): boolean {
  const clean = decodeURIComponent(url.split(/[?#]/)[0]).replace(/^\/+/, '')
  const candidates =
    clean.endsWith('/') || clean === ''
      ? [path.join(clean, 'index.html')]
      : [clean, `${clean}.html`, path.join(clean, 'index.html')]
  return candidates.some((file) => {
    const full = path.join(outDir, file)
    return fs.existsSync(full) && fs.statSync(full).isFile()
  })
}

type StoriesRead =
  | { ok: true; stories: StoryRef[]; absent: string[]; where: string }
  | { ok: false; problem: 'missing' | 'invalid'; message: string; where: string }

/**
 * The stories of a built output: the pages of `diff.stories` that exist in it (the others listed
 * as absent), or the stories of its manifest or Storybook index.
 */
function readStories(outDir: string, diff: DiffConfig): StoriesRead {
  if (Array.isArray(diff.stories)) {
    const { stories, diagnostics } = pageStories(diff.stories, { viewports: diff.viewports })
    if (hasErrors(diagnostics)) {
      return {
        ok: false,
        problem: 'invalid',
        where: 'diff.stories',
        message: diagnostics.map((d) => formatDiagnostic(d)).join('; '),
      }
    }
    const present = stories.filter((story) => pageExists(outDir, story.url))
    return {
      ok: true,
      stories: present,
      absent: stories.filter((story) => !present.includes(story)).map((story) => story.url),
      where: diff.outDir,
    }
  }
  const source = storiesSource(diff)
  if (!source) throw new Error('unreachable: a page list has no source file')
  const where = path.join(diff.outDir, source.file)
  const file = path.join(outDir, source.file)
  if (!fs.existsSync(file))
    return { ok: false, problem: 'missing', where, message: `no ${source.label} at ${where}` }
  let json: unknown
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return { ok: false, problem: 'invalid', where, message: `${where} is not valid JSON` }
  }
  const { stories, diagnostics } = source.read(json)
  if (hasErrors(diagnostics)) {
    return {
      ok: false,
      problem: 'invalid',
      where,
      message: diagnostics.map((d) => formatDiagnostic(d)).join('; '),
    }
  }
  return { ok: true, stories, absent: [], where }
}

/** The problem when the built output has no stories file. */
function storiesMissing(outDir: string, diff: DiffConfig): DiffProblem {
  const read = readStories(outDir, diff)
  const message = read.ok ? `no stories in ${diff.outDir}` : read.message
  return !Array.isArray(diff.stories) && diff.stories.type === 'storybook'
    ? diffProblems.noStorybookIndex(read.where, diff.build)
    : diffProblems.storiesMissing(message, diff.build)
}

/** Whether `dta diff` runs in CI (GitHub Actions and most others set CI=true). */
function isCI(): boolean {
  const value = process.env.CI
  return value !== undefined && value !== '' && value !== '0' && value !== 'false'
}

function readManifest(outDir: string, diff: DiffConfig, side: string) {
  const read = readStories(outDir, diff)
  if (!read.ok) {
    if (read.problem === 'missing') return null
    throw new VisualDiffError(diffProblems.storiesInvalid(`${side}: ${read.message}`))
  }
  // A page the head does not have is a mistake in the list; the base may not have it yet.
  if (side === 'head' && read.absent.length > 0) {
    throw new VisualDiffError(diffProblems.pagesAbsent(read.absent, diff.outDir, diff.build))
  }
  return read.stories
}

/**
 * Builds the head and the base (in a temporary worktree), serves both outputs, renders every
 * story at each viewport and compares the screenshots.
 */
async function compareVisually(
  context: CommandContext,
  diff: DiffConfig,
  sha: string,
  plan: RevertPlan,
  log: (text: string) => void,
): Promise<StoryResult[]> {
  const screenshotter = await launchScreenshotter()
  const cleanup: Array<() => unknown> = [() => screenshotter.close()]
  try {
    if (diff.build) {
      log(`${pc.dim('Building head:')} ${diff.build}`)
      runCommand(diff.build, context.cwd)
    }
    const headOut = path.resolve(context.cwd, diff.outDir)
    const headStories = readManifest(headOut, diff, 'head')
    if (!headStories) {
      throw new VisualDiffError(storiesMissing(headOut, diff))
    }

    log(`${pc.dim('Building base:')} ${sha.slice(0, 7)} in a temporary worktree`)
    const worktree = createBaseWorktree(context.cwd, sha)
    cleanup.push(() => worktree.remove())
    const baseOut = path.resolve(worktree.projectDir, diff.outDir)
    try {
      buildBase({
        cwd: context.cwd,
        worktree,
        setup: diff.setup,
        build: diff.build,
        log: (text) => log(pc.dim(text)),
      })
    } catch (error) {
      if (!(error instanceof BaseBuildError)) throw error
      throw new VisualDiffError(diffProblems.baseBuildFailed(error.message, error.failure.command))
    }
    // No stories file at the base (before the site had one): every story is new.
    const baseStories: StoryRef[] = readManifest(baseOut, diff, 'base') ?? []

    const headServer = await serveStatic(headOut)
    cleanup.push(() => headServer.close())
    const baseServer = await serveStatic(baseOut)
    cleanup.push(() => baseServer.close())

    log(`${pc.dim('Rendering:')} ${headStories.length} stories`)
    return await compareStories({
      base: baseStories,
      head: headStories,
      threshold: diff.threshold,
      colorThreshold: diff.colorThreshold,
      capture: (side, story, viewport) =>
        screenshotter.capture(
          `${(side === 'head' ? headServer : baseServer).url}${story.url}`,
          viewport,
          story.ready,
        ),
      // Changed stories only: revert each changed token in the head page and see what moves.
      attribute: async (story, viewport, comparison) => {
        const started = Date.now()
        // The build's selectors, plus wherever this page itself declares the variables.
        const dependents =
          plan.causes.length === 0
            ? {}
            : ((await screenshotter.inspect(
                `${headServer.url}${story.url}`,
                viewport,
                story.ready,
                async (run) => {
                  const page = (await run(
                    PAGE_DECLARATIONS_SCRIPT,
                    plan.variables,
                  )) as PageDeclaration[]
                  return (await run(DEPENDENTS_SCRIPT, plan.groupsFor(page))) as Record<
                    string,
                    Dependent[]
                  >
                },
              )) ?? {})
        const attribution = attributePixels(
          comparison.mask,
          comparison.width,
          comparison.height,
          dependents,
        )
        return { ...attribution, ms: Date.now() - started }
      },
    })
  } finally {
    for (const step of cleanup.reverse()) {
      try {
        await step()
      } catch {
        // keep cleaning up
      }
    }
  }
}

function writeReport(
  dir: string,
  set: ReturnType<typeof diffTokens>,
  stories: StoryResult[],
  labels: DiffLabels,
  review?: Review,
): DiffResult {
  fs.rmSync(dir, { recursive: true, force: true })
  for (const result of stories) {
    const paths = storyImagePaths(result)
    for (const side of ['base', 'head', 'diff'] as const) {
      const image = result.images[side]
      const file = paths[side]
      if (!image || !file) continue
      fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true })
      fs.writeFileSync(path.join(dir, file), image)
    }
  }
  fs.mkdirSync(dir, { recursive: true })
  const json = toDiffJson(set, stories, labels, review)
  const result = diffResultSchema.parse(JSON.parse(json))
  fs.writeFileSync(path.join(dir, 'result.json'), json)
  fs.writeFileSync(path.join(dir, 'summary.md'), renderSummaryMarkdown(result))
  // The report reads the screenshots back to know where notes may sit on them.
  const image = (file: string) => fs.readFileSync(path.join(dir, file))
  fs.writeFileSync(path.join(dir, 'index.html'), renderReportHtml(result, { image }))
  return result
}

interface PublishHook {
  command: string
  url?: string
}

/** `--publish <command>` or `diff.publish`. */
function publishHook(context: CommandContext): PublishHook | null {
  if (typeof context.options.publish === 'string') return { command: context.options.publish }
  const configured = context.config?.diff?.publish
  if (!configured) return null
  return typeof configured === 'string' ? { command: configured } : configured
}

/**
 * Runs the publish hook on the report folder (path as last argument and DTA_REPORT_DIR), reads
 * the public URL from its output and rewrites result.json and summary.md with absolute links.
 */
function publishReport(
  context: CommandContext,
  dir: string,
  hook: PublishHook,
): { ok: true; url: string; result: DiffResult } | { ok: false; message: string } {
  const run = spawnSync(`${hook.command} ${shellQuote(dir)}`, {
    cwd: context.cwd,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, DTA_REPORT_DIR: dir, FORCE_COLOR: '0' },
  })
  const tail = (text: string) => text.trim().split('\n').slice(-10).join('\n')
  if (run.status !== 0) {
    return {
      ok: false,
      message: `the publish hook \`${hook.command}\` failed (exit ${run.status ?? 'signal'}):\n${tail(`${run.stdout ?? ''}${run.stderr ?? ''}`)}`,
    }
  }
  const url = extractPublishUrl(run.stdout ?? '', hook.url)
  if (!url) {
    return {
      ok: false,
      message: `the publish hook \`${hook.command}\` printed no URL${hook.url ? ` matching ${hook.url}` : ' on its last line'}:\n${tail(run.stdout ?? '')}`,
    }
  }
  const resultFile = path.join(dir, 'result.json')
  const parsed = diffResultSchema.parse(JSON.parse(fs.readFileSync(resultFile, 'utf8')))
  const result: DiffResult = { ...parsed, publish: { url, report: `${url}/index.html` } }
  fs.writeFileSync(resultFile, `${JSON.stringify(result, null, 2)}\n`)
  fs.writeFileSync(path.join(dir, 'summary.md'), renderSummaryMarkdown(result, { baseUrl: url }))
  return { ok: true, url, result }
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`

const STATUS_STYLE: Record<StoryResult['status'], (text: string) => string> = {
  changed: pc.yellow,
  added: pc.green,
  removed: pc.red,
  unchanged: pc.dim,
}

function consoleStories(results: StoryResult[]): string {
  const width = Math.max(...results.map((r) => `${r.id}@${r.viewport}`.length), 0)
  return results
    .map((r) => {
      const label = STATUS_STYLE[r.status](r.status.padEnd(9))
      const ratio = r.status === 'changed' ? pc.dim(`${(r.ratio * 100).toFixed(2)}%`) : ''
      const a = r.attribution
      const cause = !a
        ? ''
        : a.explained
          ? pc.cyan(` explained by ${a.tokens.map((t) => t.id.split(' (')[0]).join(', ')}`)
          : pc.red(` unexplained: ${a.unexplainedPixels} px`)
      const ms = a?.ms !== undefined ? pc.dim(` (${a.ms} ms)`) : ''
      return `${label} ${`${r.id}@${r.viewport}`.padEnd(width)}  ${ratio}${cause}${ms}`.trimEnd()
    })
    .join('\n')
}

function consoleReview(review: Review): string {
  const lines = review.tokens.map(
    (t) =>
      `${pc.cyan(t.id)} explains ${t.stories.length} of ${review.changed} changed ${review.changed === 1 ? 'story' : 'stories'}`,
  )
  const unexplained = review.changed - review.explained
  if (unexplained > 0) lines.push(pc.red(`${unexplained} unexplained`))
  return lines.join('\n')
}

/** `dta diff --list`: the stories of the built output, as `dta diff` would render them. */
function listStories(
  context: CommandContext,
  format: Format,
  fail: (problem: DiffProblem) => number,
): number {
  const diff = context.config?.diff
  if (!diff) return fail(diffProblems.noDiffSection())
  const outDir = path.resolve(context.cwd, diff.outDir)
  const read = readStories(outDir, diff)
  if (!read.ok) {
    return fail(
      read.problem === 'missing'
        ? storiesMissing(outDir, diff)
        : diffProblems.storiesInvalid(read.message),
    )
  }
  if (read.absent.length > 0)
    return fail(diffProblems.pagesAbsent(read.absent, diff.outDir, diff.build))
  const { stories } = read
  const manifestPath = read.where

  if (format === 'json') {
    context.stdout(`${JSON.stringify({ manifest: manifestPath, stories }, null, 2)}\n`)
    return 0
  }
  if (format === 'markdown') {
    const rows = stories.map(
      (s) => `| \`${s.id}\` | ${s.title} | \`${s.url}\` | ${s.viewports.join(', ')} |`,
    )
    context.stdout(
      ['| Story | Title | URL | Viewports |', '| --- | --- | --- | --- |', ...rows].join('\n') +
        '\n',
    )
    return 0
  }
  const ui = createUi(context.stdout)
  ui.intro(banner('diff'))
  const label = Array.isArray(diff.stories)
    ? 'Pages in:'
    : diff.stories.type === 'storybook'
      ? 'Storybook index:'
      : 'Manifest:'
  ui.log.message(`${pc.dim(label)} ${manifestPath}`)
  const idWidth = Math.max(...stories.map((s) => s.id.length), 0)
  const urlWidth = Math.max(...stories.map((s) => s.url.length), 0)
  const rows = stories.map(
    (s) => `${s.id.padEnd(idWidth)}  ${pc.dim(s.url.padEnd(urlWidth))}  ${s.viewports.join(' · ')}`,
  )
  context.stdout(`\n${rows.join('\n')}\n\n`)
  ui.outro(`${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`)
  return 0
}

interface Check {
  name: string
  ok: boolean
  detail: string
  problem?: DiffProblem
}

/** Whether a browser is there for screenshots, without starting it. */
async function browserCheck(cwd: string): Promise<Check> {
  const name = 'browser'
  const custom = process.env.DTA_BROWSER_PATH
  if (custom) {
    return fs.existsSync(custom)
      ? { name, ok: true, detail: `DTA_BROWSER_PATH (${custom})` }
      : {
          name,
          ok: false,
          detail: `DTA_BROWSER_PATH points at ${custom}, which does not exist`,
          problem: diffProblems.noBrowser(
            `DTA_BROWSER_PATH points at ${custom}, which does not exist.`,
          ),
        }
  }
  let playwright: { chromium: { executablePath(): string } }
  try {
    // The project's own playwright-core first (what dta init installs), then DTA's.
    try {
      playwright = createRequire(path.join(cwd, 'package.json'))(
        'playwright-core',
      ) as typeof playwright
    } catch {
      playwright = (await import('playwright-core')) as unknown as typeof playwright
    }
  } catch {
    return {
      name,
      ok: false,
      detail: 'playwright-core is not installed',
      problem: diffProblems.noBrowser('playwright-core is not installed.'),
    }
  }
  const executable = playwright.chromium.executablePath()
  return executable && fs.existsSync(executable)
    ? { name, ok: true, detail: `playwright-core with Chromium (${executable})` }
    : {
        name,
        ok: false,
        detail: 'playwright-core is installed, Chromium is not',
        problem: diffProblems.noBrowser('playwright-core is installed, but Chromium is not.'),
      }
}

/** `dta diff --check`: the setup, without building or rendering anything (TICKET-130). */
async function checkSetup(context: CommandContext, base: string | undefined): Promise<number> {
  const checks: Check[] = []
  const diff = context.config?.diff

  checks.push(
    diff
      ? {
          name: 'config',
          ok: true,
          detail: `diff section: outDir ${diff.outDir}${diff.build ? `, build \`${diff.build}\`` : ''}`,
        }
      : {
          name: 'config',
          ok: false,
          detail: 'no diff section',
          problem: diffProblems.noDiffSection(),
        },
  )
  checks.push(await browserCheck(context.cwd))

  const inRepo = gitOutput(context.cwd, ['rev-parse', '--show-toplevel']) !== null
  const shallow =
    gitOutput(context.cwd, ['rev-parse', '--is-shallow-repository'])?.trim() === 'true'
  checks.push(
    !inRepo
      ? {
          name: 'git history',
          ok: false,
          detail: 'not a git repository',
          problem: diffProblems.noBase(
            'Not inside a git repository, so there is no base to build.',
          ),
        }
      : shallow
        ? {
            name: 'git history',
            ok: false,
            detail: 'a shallow clone: the merge base may be missing',
            problem: diffProblems.noBase(
              'This is a shallow clone, so the merge base may be missing.',
            ),
          }
        : { name: 'git history', ok: true, detail: 'full history' },
  )

  if (inRepo) {
    const ref = base ?? defaultBranch(context.cwd)
    const sha = ref
      ? base !== undefined
        ? gitOutput(context.cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])?.trim()
        : gitOutput(context.cwd, ['merge-base', 'HEAD', ref])?.trim()
      : undefined
    checks.push(
      sha
        ? {
            name: 'base',
            ok: true,
            detail:
              base !== undefined
                ? `${ref} (${sha.slice(0, 7)})`
                : `merge base with ${ref} (${sha.slice(0, 7)})`,
          }
        : {
            name: 'base',
            ok: false,
            detail: ref
              ? `no commit for ${ref}`
              : 'no default branch (origin/HEAD, main or master)',
            problem: diffProblems.noBase(
              ref
                ? `HEAD has no merge base with ${ref}.`
                : 'Could not find the default branch (origin/HEAD, main or master).',
            ),
          },
    )
  }

  if (diff) {
    const outDir = path.resolve(context.cwd, diff.outDir)
    const read = readStories(outDir, diff)
    checks.push(
      !read.ok
        ? {
            name: 'stories',
            ok: false,
            detail: read.message,
            problem:
              read.problem === 'missing'
                ? storiesMissing(outDir, diff)
                : diffProblems.storiesInvalid(read.message),
          }
        : read.absent.length > 0
          ? {
              name: 'stories',
              ok: false,
              detail: `${read.absent.length} of the pages not in ${diff.outDir}`,
              problem: diffProblems.pagesAbsent(read.absent, diff.outDir, diff.build),
            }
          : read.stories.length === 0
            ? {
                name: 'stories',
                ok: false,
                detail: 'the source lists no story',
                problem: diffProblems.storiesInvalid(`${read.where} lists no story`),
              }
            : {
                name: 'stories',
                ok: true,
                detail: `${read.stories.length} ${read.stories.length === 1 ? 'story' : 'stories'} in ${read.where}`,
              },
    )
  }

  const width = Math.max(...checks.map((c) => c.name.length))
  for (const check of checks) {
    const mark = check.ok ? pc.green('✓') : pc.red('✗')
    context.stdout(
      `${mark} ${check.name.padEnd(width)}  ${check.ok ? check.detail : pc.red(check.detail)}\n`,
    )
    if (!check.ok && check.problem) {
      context.stdout(`  ${' '.repeat(width)}  Fix: ${check.problem.fix}\n`)
      context.stdout(`  ${' '.repeat(width)}  Docs: ${docsUrl(check.problem.docs)}\n`)
    }
  }
  const failed = checks.filter((c) => !c.ok).length
  context.stdout(
    failed === 0 ? 'Ready for dta diff.\n' : `${failed} of ${checks.length} checks failed.\n`,
  )
  return failed === 0 ? 0 : 1
}
