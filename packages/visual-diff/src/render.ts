import type { StoryResult } from './compare.js'
import type { DiffResult } from './result-schema.js'

/** What the story tables need: a story result, or one read back from result.json. */
type StoryRow = Pick<StoryResult, 'id' | 'viewport' | 'status' | 'ratio' | 'attribution'> & {
  images?: { base?: unknown; head?: unknown; diff?: unknown }
}
import type { Review, Verdict } from './review.js'
import { baseInWords, headInWords, type DiffHead } from './sides.js'
import type { TokenChange, TokenChangeKind, TokenChangeSet, TokenState } from './token-changes.js'

/** Identifies the shape of `toJson`'s output; bumped on breaking changes. */
export const TOKEN_CHANGES_SCHEMA = 'dta.diff.tokens/1'

export interface DiffLabels {
  /** How the base was chosen, e.g. `tokens-base` or `merge base with origin/main (1a2b3c4)`. */
  base: string
  /** The checkout that was rendered "with this change" (in git only). */
  head?: DiffHead
  /** Where the report folder was published (absolute URLs). */
  publish?: { url: string; report: string }
}

const SECTIONS: ReadonlyArray<{ kind: TokenChangeKind; title: string }> = [
  { kind: 'changed', title: 'Changed' },
  { kind: 'added', title: 'Added' },
  { kind: 'removed', title: 'Removed' },
  { kind: 'affected', title: 'Affected through aliases' },
]

/** `3 changed · 1 added · 1 removed · 2 affected`, leaving out zeros. */
export function summarizeCounts(counts: TokenChangeSet['counts']): string {
  const parts = SECTIONS.filter(({ kind }) => counts[kind] > 0).map(
    ({ kind }) => `${counts[kind]} ${kind}`,
  )
  return parts.length > 0 ? parts.join(' · ') : 'no changes'
}

const code = (value: unknown) => `\`${String(value).replace(/`/g, "'").replace(/\|/g, '\\|')}\``

/** `{Colors.Blue.500}` → `#0057b8` for aliases, the value alone otherwise. */
export function formatState(state: TokenState | undefined): string {
  if (!state) return '—'
  const raw = code(state.raw)
  if (typeof state.raw === 'string' && state.raw.startsWith('{')) {
    return state.resolved === undefined ? `${raw} → unresolved` : `${raw} → ${code(state.resolved)}`
  }
  return raw
}

const where = (change: TokenChange) => `${change.collection} · ${change.mode}`

function table(kind: TokenChangeKind, all: TokenChange[], limit = Infinity): string[] {
  const changes = all.slice(0, limit)
  const more = all.length > changes.length ? [`| … and ${all.length - changes.length} more |`] : []
  return [...rows(kind, changes), ...more]
}

function rows(kind: TokenChangeKind, changes: TokenChange[]): string[] {
  switch (kind) {
    case 'changed':
      return [
        '| Token | Collection · mode | Before | After |',
        '| --- | --- | --- | --- |',
        ...changes.map(
          (c) =>
            `| ${code(c.name)}${c.typeBefore ? ` (${c.typeBefore} → ${c.type})` : ''} | ${where(c)} | ${formatState(c.before)} | ${formatState(c.after)} |`,
        ),
      ]
    case 'added':
      return [
        '| Token | Collection · mode | Value |',
        '| --- | --- | --- |',
        ...changes.map((c) => `| ${code(c.name)} | ${where(c)} | ${formatState(c.after)} |`),
      ]
    case 'removed':
      return [
        '| Token | Collection · mode | Was |',
        '| --- | --- | --- |',
        ...changes.map((c) => `| ${code(c.name)} | ${where(c)} | ${formatState(c.before)} |`),
      ]
    case 'affected':
      return [
        '| Token | Collection · mode | Before | After | Because of |',
        '| --- | --- | --- | --- | --- |',
        ...changes.map(
          (c) =>
            `| ${code(c.name)} | ${where(c)} | ${code(c.before?.resolved ?? 'unresolved')} | ${code(c.after?.resolved ?? 'unresolved')} | ${(c.causes ?? []).map(code).join(', ')} |`,
        ),
      ]
  }
}

/**
 * Markdown for a pull request comment or a CI summary (`limit`: rows per table). `inWords`
 * names both sides as the report does ("Before" and "With this change", ref and short hash)
 * instead of the base label.
 */
export function renderTokenChangesMarkdown(
  set: TokenChangeSet,
  labels: DiffLabels,
  options: { limit?: number; inWords?: boolean } = {},
): string {
  const lines = ['## dta diff: token changes', '']
  const sides = options.inWords
    ? `Before: ${code(baseInWords(labels.base))} · With this change: ${code(headInWords(labels.head))}`
    : `Base: ${code(labels.base)}`
  lines.push(`${sides} · **${summarizeCounts(set.counts)}**`)
  for (const { kind, title } of SECTIONS) {
    const changes = set.changes.filter((change) => change.kind === kind)
    if (changes.length === 0) continue
    lines.push('', `### ${title} (${changes.length})`, '', ...table(kind, changes, options.limit))
  }
  return `${lines.join('\n')}\n`
}

/** Stable, versioned JSON for CI and agents. */
export function toJson(set: TokenChangeSet, labels: DiffLabels): string {
  return `${JSON.stringify(
    { schema: TOKEN_CHANGES_SCHEMA, base: labels.base, counts: set.counts, changes: set.changes },
    null,
    2,
  )}\n`
}

/** Identifies the shape of `toDiffJson`'s output (tokens and stories). */
export const DIFF_SCHEMA = 'dta.diff/1'

/** Image paths of a story result inside the report folder, e.g. `head/button--variants@1280.png`. */
export function storyImagePaths(result: Pick<StoryResult, 'id' | 'viewport' | 'images'>) {
  const name = `${result.id}@${result.viewport}.png`
  return {
    ...(result.images.base ? { base: `base/${name}` } : {}),
    ...(result.images.head ? { head: `head/${name}` } : {}),
    ...(result.images.diff ? { diff: `diff/${name}` } : {}),
  }
}

const percent = (ratio: number) => `${(ratio * 100).toFixed(ratio < 0.001 && ratio > 0 ? 3 : 2)}%`

/** `2 changed · 1 added · 7 unchanged` for story results. */
export function summarizeStories(results: StoryRow[]): string {
  const order = ['changed', 'added', 'removed', 'unchanged'] as const
  const parts = order
    .map((status) => [status, results.filter((r) => r.status === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${status}`)
  return parts.length > 0 ? parts.join(' · ') : 'no stories'
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  pass: 'Pass',
  review: 'Changes to review',
  fail: 'Fail: unexplained changes above the threshold',
}

/** `action.bg (Theme · Light)` → `` `action.bg` (Theme · Light) `` */
const tokenLabel = (id: string) => {
  const open = id.lastIndexOf(' (')
  return open > 0 ? `${code(id.slice(0, open))}${id.slice(open)}` : code(id)
}

function cause(result: StoryRow): string {
  if (result.status !== 'changed') return '—'
  if (!result.attribution) return 'unexplained'
  const names = result.attribution.tokens.map((t) => code(t.id.split(' (')[0]))
  if (result.attribution.explained) return names.join(', ')
  return names.length > 0 ? `unexplained (partly ${names.join(', ')})` : 'unexplained'
}

const list = (refs: string[], max = 6) =>
  refs.slice(0, max).map(code).join(', ') +
  (refs.length > max ? ` and ${refs.length - max} more` : '')

/**
 * Markdown for the stories: the verdict and the changes grouped by cause (with a review), then
 * a table of the stories that differ (all stories when `all`).
 */
export function renderStoriesMarkdown(
  results: StoryRow[],
  options: { all?: boolean; review?: Review; limit?: number } = {},
) {
  const limit = options.limit ?? Infinity
  const listed = options.all ? results : results.filter((r) => r.status !== 'unchanged')
  const shown = listed.slice(0, limit)
  const lines = ['## dta diff: stories', '']
  const review = options.review
  if (review) {
    const unexplained = review.changed - review.explained
    lines.push(
      `**${VERDICT_TEXT[review.verdict]}** · ${summarizeStories(results)}` +
        (review.changed > 0
          ? ` · ${review.explained} explained by token changes, ${unexplained} unexplained`
          : ''),
    )
    if (review.tokens.length > 0) {
      lines.push('', '### By token change', '')
      for (const group of review.tokens) {
        const values =
          group.before || group.after
            ? ` ${formatState(group.before)} → ${formatState(group.after)}`
            : ''
        const count = group.stories.length
        lines.push(
          `- ${tokenLabel(group.id)}${values} explains ${count} ${count === 1 ? 'story' : 'stories'}: ${list(group.stories)}`,
        )
      }
    }
    if (review.unexplained.length > 0) {
      lines.push(
        '',
        '### Unexplained',
        '',
        '| Story | Changed pixels | Region | Over threshold |',
        '| --- | --- | --- | --- |',
        ...review.unexplained
          .slice(0, limit)
          .map(
            (u) =>
              `| ${code(u.story)} | ${u.pixels} (${percent(u.ratio)}) | ${u.region ? `${u.region.width}×${u.region.height} at ${u.region.x},${u.region.y}` : '—'} | ${u.failing ? 'yes' : 'no'} |`,
          ),
        ...(review.unexplained.length > limit
          ? [`| … and ${review.unexplained.length - limit} more | | | |`]
          : []),
      )
    }
  } else {
    lines.push(`**${summarizeStories(results)}**`)
  }
  if (shown.length > 0) {
    lines.push(
      '',
      ...(review ? ['### Stories', ''] : []),
      '| Story | Viewport | Status | Changed pixels | Cause |',
      '| --- | --- | --- | --- | --- |',
      ...shown.map(
        (r) =>
          `| ${code(r.id)} | ${r.viewport}px | ${r.status} | ${r.status === 'changed' || r.status === 'unchanged' ? percent(r.ratio) : '—'} | ${cause(r)} |`,
      ),
      ...(listed.length > shown.length
        ? [`| … and ${listed.length - shown.length} more | | | | |`]
        : []),
    )
  }
  return `${lines.join('\n')}\n`
}

/** Tokens and stories in one versioned JSON document (images as paths in the report folder). */
export function toDiffJson(
  set: TokenChangeSet,
  results: StoryResult[],
  labels: DiffLabels,
  review?: Review,
): string {
  return `${JSON.stringify(
    {
      schema: DIFF_SCHEMA,
      base: labels.base,
      ...(labels.head ? { head: labels.head } : {}),
      ...(review ? { verdict: review.verdict, review } : {}),
      ...(labels.publish ? { publish: labels.publish } : {}),
      tokens: { counts: set.counts, changes: set.changes },
      stories: results.map(({ images, ...rest }) => ({
        ...rest,
        images: storyImagePaths({ ...rest, images }),
      })),
    },
    null,
    2,
  )}\n`
}

/** GitHub's limit for a comment body is 65,536 characters; leave room for a header. */
export const SUMMARY_MAX_LENGTH = 60_000

const THUMB_WIDTH = 120

/** `<img>` thumbnails (before · with this change · diff) of a published story, for a table cell. */
function thumbnails(story: DiffResult['stories'][number], baseUrl: string): string {
  const img = (label: string, file?: string) =>
    file
      ? `<a href="${baseUrl}/${file}"><img src="${baseUrl}/${file}" width="${THUMB_WIDTH}" alt="${label}"></a>`
      : ''
  return [
    img('before', story.images.base),
    img('with this change', story.images.head),
    img('diff', story.images.diff),
  ]
    .filter(Boolean)
    .join(' ')
}

/** Changed, added and removed stories with their thumbnails (only with a published report). */
function storyThumbnails(result: DiffResult, baseUrl: string, limit: number): string[] {
  const shown = result.stories.filter((s) => s.status !== 'unchanged')
  if (shown.length === 0) return []
  const rows = shown
    .slice(0, limit)
    .map(
      (s) =>
        `| ${code(s.id)} | ${s.viewport}px | ${s.status === 'changed' ? percent(s.ratio) : s.status} | ${thumbnails(s, baseUrl)} |`,
    )
  return [
    '',
    '### Before · with this change · diff',
    '',
    '| Story | Viewport | Changed | Images |',
    '| --- | --- | --- | --- |',
    ...rows,
    ...(shown.length > rows.length ? [`| … and ${shown.length - rows.length} more | | | |`] : []),
  ]
}

/**
 * `summary.md`, from a `result.json`: token changes and stories, short enough for a
 * pull-request comment. With `baseUrl` (where the report folder was published) it links the
 * full report and shows before / with this change / diff thumbnails per story and viewport; without
 * it there are no images. Tables are cut (with "… and N more") until it fits.
 */
export function renderSummaryMarkdown(
  result: DiffResult,
  options: { baseUrl?: string; maxLength?: number } = {},
): string {
  const maxLength = options.maxLength ?? SUMMARY_MAX_LENGTH
  const baseUrl = options.baseUrl?.replace(/\/+$/, '')
  const set: TokenChangeSet = result.tokens
  const labels = { base: result.base, head: result.head }
  const render = (limit?: number) => {
    const link = baseUrl ? `**[Open the full report](${baseUrl}/index.html)**\n\n` : ''
    const thumbs = baseUrl ? storyThumbnails(result, baseUrl, limit ?? Infinity).join('\n') : ''
    return `${link}${renderTokenChangesMarkdown(set, labels, { limit, inWords: true })}\n${renderStoriesMarkdown(result.stories, { review: result.review, limit })}${thumbs ? `${thumbs}\n` : ''}`
  }
  let markdown = render()
  for (let limit = 200; markdown.length > maxLength && limit >= 1; limit = Math.floor(limit / 2)) {
    markdown = render(limit)
  }
  if (markdown.length > maxLength) {
    markdown = `${markdown.slice(0, maxLength - 40)}\n\n… (cut, see the report)\n`
  }
  return markdown
}
