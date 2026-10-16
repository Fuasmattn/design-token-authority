import type { StoryResult } from './compare.js'
import type { TokenChange, TokenChangeKind, TokenChangeSet, TokenState } from './token-changes.js'

/** Identifies the shape of `toJson`'s output; bumped on breaking changes. */
export const TOKEN_CHANGES_SCHEMA = 'dta.diff.tokens/1'

export interface DiffLabels {
  /** How the base was chosen, e.g. `tokens-base` or `merge base with origin/main (1a2b3c4)`. */
  base: string
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

function table(kind: TokenChangeKind, changes: TokenChange[]): string[] {
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

/** Markdown for a pull request comment or a CI summary. */
export function renderTokenChangesMarkdown(set: TokenChangeSet, labels: DiffLabels): string {
  const lines = ['## dta diff: token changes', '']
  lines.push(`Base: ${code(labels.base)} · **${summarizeCounts(set.counts)}**`)
  for (const { kind, title } of SECTIONS) {
    const changes = set.changes.filter((change) => change.kind === kind)
    if (changes.length === 0) continue
    lines.push('', `### ${title} (${changes.length})`, '', ...table(kind, changes))
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
export function summarizeStories(results: StoryResult[]): string {
  const order = ['changed', 'added', 'removed', 'unchanged'] as const
  const parts = order
    .map((status) => [status, results.filter((r) => r.status === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${status}`)
  return parts.length > 0 ? parts.join(' · ') : 'no stories'
}

/** Markdown table of the stories that differ (all stories when `all`). */
export function renderStoriesMarkdown(results: StoryResult[], options: { all?: boolean } = {}) {
  const shown = options.all ? results : results.filter((r) => r.status !== 'unchanged')
  const lines = ['## dta diff: stories', '', `**${summarizeStories(results)}**`]
  if (shown.length > 0) {
    lines.push(
      '',
      '| Story | Viewport | Status | Changed pixels |',
      '| --- | --- | --- | --- |',
      ...shown.map(
        (r) =>
          `| ${code(r.id)} | ${r.viewport}px | ${r.status} | ${r.status === 'changed' || r.status === 'unchanged' ? percent(r.ratio) : '—'} |`,
      ),
    )
  }
  return `${lines.join('\n')}\n`
}

/** Tokens and stories in one versioned JSON document (images as paths in the report folder). */
export function toDiffJson(
  set: TokenChangeSet,
  results: StoryResult[],
  labels: DiffLabels,
): string {
  return `${JSON.stringify(
    {
      schema: DIFF_SCHEMA,
      base: labels.base,
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
