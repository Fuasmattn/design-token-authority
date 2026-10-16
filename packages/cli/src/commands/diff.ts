import fs from 'node:fs'
import path from 'node:path'
import { parseTokenFiles, type TokenFileInput } from '@dta/core'
import {
  diffTokens,
  readStoriesManifest,
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
import { DiffBaseError, resolveDiffBase } from '../io/diff-base.js'
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
 * base with the default branch). For now it reports token changes; rendering and comparing
 * stories comes with the visual part of the epic.
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

  if (format === 'console') {
    ui.intro(banner('diff'))
    ui.log.message(`${pc.dim('Base:')} ${baseInfo.label}`)
    if (total > 0) context.stdout(`\n${consoleReport(set)}\n\n`)
    if (!context.options.tokensOnly) {
      ui.log.info('Visual comparison of stories is not available yet; showing token changes.')
    }
  }
  const document =
    format === 'json'
      ? toJson(set, labels)
      : format === 'markdown'
        ? renderTokenChangesMarkdown(set, labels)
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
  if (format === 'console') {
    const summary = summarizeCounts(set.counts)
    ui.outro(total > 0 ? pc.yellow(summary) : pc.green('No token changes.'))
  }

  return failOnChange && total > 0 ? 1 : 0
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
