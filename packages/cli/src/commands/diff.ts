import fs from 'node:fs'
import path from 'node:path'
import { cssBindings, type BuildOptions } from '@dta/build'
import { parseTokenFiles, type TokenFileInput, type TokenModel } from '@dta/core'
import {
  attributePixels,
  compareStories,
  DEPENDENTS_SCRIPT,
  diffTokens,
  planReverts,
  reviewStories,
  VERDICT_TEXT,
  type Dependent,
  type Review,
  type RevertGroup,
  readStoriesManifest,
  renderStoriesMarkdown,
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
import { formatDiagnostic, hasErrors } from '../io/diagnostics.js'
import { BrowserUnavailableError, launchScreenshotter } from '../io/browser.js'
import { DiffBaseError, resolveDiffBase } from '../io/diff-base.js'
import { CommandFailedError, runCommand } from '../io/run-command.js'
import { serveStatic } from '../io/static-server.js'
import { createBaseWorktree } from '../io/worktree.js'
import { readTokenDir, TokenDirError } from '../io/token-dir.js'
import { banner, createUi } from '../ui.js'

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
  const fail = (message: string) => {
    context.stderr(`dta diff: ${message}\n`)
    return 1
  }

  if (!FORMATS.includes(requested as Format)) {
    return fail(`unknown format "${requested}". Use one of: ${FORMATS.join(', ')}.`)
  }
  const format = requested as Format

  if (context.options.list) return listStories(context, format, fail)

  let headFiles: TokenFileInput[]
  let baseInfo
  try {
    headFiles = readTokenDir(tokensDir, context.cwd)
    baseInfo = resolveDiffBase(context.cwd, tokensDir, base)
  } catch (error) {
    if (error instanceof TokenDirError || error instanceof DiffBaseError) return fail(error.message)
    throw error
  }

  const head = parseTokenFiles(headFiles)
  const before = parseTokenFiles(baseInfo.files)
  const problems = [
    ...before.diagnostics.map((d) => ({ side: 'base', d })),
    ...head.diagnostics.map((d) => ({ side: 'head', d })),
  ]
  if (hasErrors(problems.map((p) => p.d))) {
    for (const { side, d } of problems) context.stderr(`${side}: ${formatDiagnostic(d)}\n`)
    return 1
  }

  const set = diffTokens(before.model, head.model)
  const total = set.changes.length
  const labels = { base: baseInfo.label }
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
      stories = await compareVisually(context, diff, baseInfo.sha, plan.groups, log)
      review = reviewStories(stories, plan.causes, diff.thresholds)
    } catch (error) {
      if (error instanceof BrowserUnavailableError) {
        context.stderr(`dta diff: ${error.message}\n`)
        skip('Showing token changes only.')
      } else if (error instanceof CommandFailedError || error instanceof VisualDiffError) {
        return fail(error.message)
      } else {
        throw error
      }
    }
  }
  if (stories) {
    const reportDir = path.resolve(
      context.cwd,
      typeof context.options.report === 'string' ? context.options.report : '.dta/diff',
    )
    writeReport(reportDir, set, stories, labels, review)
    if (format === 'console') {
      context.stdout(`\n${consoleStories(stories)}\n\n`)
      if (review) context.stdout(`${consoleReview(review)}\n\n`)
      ui.log.message(`${pc.dim('Report:')} ${path.relative(context.cwd, reportDir) || '.'}`)
    }
  }

  const document =
    format === 'json'
      ? stories
        ? toDiffJson(set, stories, labels, review)
        : toJson(set, labels)
      : format === 'markdown'
        ? renderTokenChangesMarkdown(set, labels) +
          (stories ? `\n${renderStoriesMarkdown(stories, { review })}` : '')
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
class VisualDiffError extends Error {}

function readManifest(outDir: string, diff: DiffConfig, side: string) {
  const file = path.join(outDir, diff.stories.manifest)
  if (!fs.existsSync(file)) return null
  let json: unknown
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    throw new VisualDiffError(`${side}: ${diff.stories.manifest} is not valid JSON.`)
  }
  const { stories, diagnostics } = readStoriesManifest(json, { viewports: diff.viewports })
  if (hasErrors(diagnostics)) {
    throw new VisualDiffError(`${side}: ${diagnostics.map(formatDiagnostic).join('; ')}`)
  }
  return stories
}

/**
 * Builds the head and the base (in a temporary worktree), serves both outputs, renders every
 * story at each viewport and compares the screenshots.
 */
async function compareVisually(
  context: CommandContext,
  diff: DiffConfig,
  sha: string,
  groups: RevertGroup[],
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
      throw new VisualDiffError(
        `no stories manifest at ${path.join(diff.outDir, diff.stories.manifest)} after the build.`,
      )
    }

    log(`${pc.dim('Building base:')} ${sha.slice(0, 7)} in a temporary worktree`)
    const worktree = createBaseWorktree(context.cwd, sha)
    cleanup.push(() => worktree.remove())
    if (diff.setup) runCommand(diff.setup, worktree.root)
    let baseStories: StoryRef[] = []
    const baseOut = path.resolve(worktree.projectDir, diff.outDir)
    try {
      if (diff.build) runCommand(diff.build, worktree.projectDir)
      baseStories = readManifest(baseOut, diff, 'base') ?? []
    } catch (error) {
      if (!(error instanceof CommandFailedError)) throw error
      // A base that cannot be built (e.g. before the site existed) has no stories: all are new.
      log(pc.yellow(`The base did not build, so every story counts as added.\n${error.message}`))
    }

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
        ),
      // Changed stories only: revert each changed token in the head page and see what moves.
      attribute: async (story, viewport, comparison) => {
        const started = Date.now()
        const dependents =
          groups.length === 0
            ? {}
            : (((await screenshotter.evaluate(
                `${headServer.url}${story.url}`,
                viewport,
                DEPENDENTS_SCRIPT,
                groups,
              )) as Record<string, Dependent[]> | null) ?? {})
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
  labels: { base: string },
  review?: Review,
) {
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
  fs.writeFileSync(path.join(dir, 'result.json'), toDiffJson(set, stories, labels, review))
  fs.writeFileSync(
    path.join(dir, 'summary.md'),
    `${renderTokenChangesMarkdown(set, labels)}\n${renderStoriesMarkdown(stories, { review })}`,
  )
}

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
  fail: (message: string) => number,
): number {
  const diff = context.config?.diff
  if (!diff) {
    return fail(
      'no `diff` section in the config. Add at least `diff: { outDir: "dist" }` (see the docs).',
    )
  }
  const manifestPath = path.join(diff.outDir, diff.stories.manifest)
  const absolute = path.resolve(context.cwd, manifestPath)
  if (!fs.existsSync(absolute)) {
    const build = diff.build ? `run \`${diff.build}\` first` : 'build the project first'
    return fail(`no stories manifest at ${manifestPath}; ${build}.`)
  }
  let json: unknown
  try {
    json = JSON.parse(fs.readFileSync(absolute, 'utf8'))
  } catch {
    return fail(`${manifestPath} is not valid JSON.`)
  }
  const { stories, diagnostics } = readStoriesManifest(json, { viewports: diff.viewports })
  if (hasErrors(diagnostics)) {
    for (const d of diagnostics) context.stderr(`${manifestPath}: ${formatDiagnostic(d)}\n`)
    return 1
  }

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
  ui.log.message(`${pc.dim('Manifest:')} ${manifestPath}`)
  const idWidth = Math.max(...stories.map((s) => s.id.length), 0)
  const urlWidth = Math.max(...stories.map((s) => s.url.length), 0)
  const rows = stories.map(
    (s) => `${s.id.padEnd(idWidth)}  ${pc.dim(s.url.padEnd(urlWidth))}  ${s.viewports.join(' · ')}`,
  )
  context.stdout(`\n${rows.join('\n')}\n\n`)
  ui.outro(`${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`)
  return 0
}
