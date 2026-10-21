/**
 * The two sides of a diff in words (TICKET-109, TICKET-123): "Before" and "With this change",
 * each with its ref and short commit hash, never the git words base and head.
 */

/** What `dta diff` rendered as "with this change": the checkout it ran in. */
export interface DiffHead {
  /** The branch (without `refs/heads/`); absent on a detached HEAD. */
  ref?: string
  /** The commit HEAD points at. */
  sha: string
  /** The repository had uncommitted changes (tracked or untracked, not ignored). */
  uncommitted: boolean
}

const SHA = /^[0-9a-f]{7,40}$/

/**
 * The base in words: `main · 1a2b3c4` from `merge base with origin/main (1a2b3c4)`,
 * `release · 1a2b3c4` from `release (1a2b3c4)`, only the sha when the ref was a sha, and a
 * directory base by its name.
 */
export function baseInWords(base: string): string {
  const match = /^(?:merge base with )?(.*?)\s*\(([0-9a-f]{7,40})\)\s*$/.exec(base)
  if (!match) return base
  const [, ref, sha] = match
  const name = ref.replace(/^(origin|upstream)\//, '')
  return !name || SHA.test(name) ? sha : `${name} · ${sha}`
}

/**
 * The head in words: `feature/x · 9f3c1a2`, only the hash on a detached HEAD, `+ uncommitted
 * changes` when the tree was dirty, and "working tree" for a result without `head` (older
 * results, or a run outside git).
 */
export function headInWords(head: DiffHead | undefined): string {
  if (!head) return 'working tree'
  const sha = head.sha.slice(0, 7)
  return `${head.ref ? `${head.ref} · ${sha}` : sha}${head.uncommitted ? ' + uncommitted changes' : ''}`
}
