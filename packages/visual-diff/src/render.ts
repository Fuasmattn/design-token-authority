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
