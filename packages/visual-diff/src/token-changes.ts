import {
  nameToDot,
  parseAlias,
  parseColor,
  resolve,
  toHex,
  type ResolveStep,
  type Token,
  type TokenModel,
  type TokenType,
  type TokenValue,
} from '@dta/core'

export type TokenChangeKind = 'changed' | 'added' | 'removed' | 'affected'

/** A token's value in one mode: as written, and after following aliases (when it resolves). */
export interface TokenState {
  raw: TokenValue
  resolved?: TokenValue
}

export interface TokenChange {
  /**
   * `changed`: the value (or type) written in this mode differs. `added` / `removed`: the token
   * exists in this mode on one side only. `affected`: written the same, but it resolves to a
   * different value because a token in its alias chain changed.
   */
  kind: TokenChangeKind
  collection: string
  mode: string
  /** Dot path, e.g. `Colors.Brand.Primary`. */
  name: string
  /** Type on the head side (base side for removed tokens). */
  type: TokenType
  /** Only when the type changed. */
  typeBefore?: TokenType
  before?: TokenState
  after?: TokenState
  /** For `affected`: the changed, added or removed tokens in its alias chain (dot paths). */
  causes?: string[]
}

export interface TokenChangeSet {
  /** Grouped by kind (changed, added, removed, affected), then by collection, mode and name. */
  changes: TokenChange[]
  counts: Record<TokenChangeKind, number>
}

/** Locale-independent, so output is the same on every machine. */
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const KIND_ORDER: readonly TokenChangeKind[] = ['changed', 'added', 'removed', 'affected']

interface Entry {
  collection: string
  mode: string
  token: Token
  value: TokenValue
}

const keyOf = (collection: string, mode: string, name: string) =>
  `${collection}\u0000${mode}\u0000${name}`

/** One entry per token and mode that has a value. */
function entries(model: TokenModel): Map<string, Entry> {
  const result = new Map<string, Entry>()
  for (const collection of model.collections) {
    for (const token of collection.tokens) {
      for (const mode of collection.modes) {
        const value = token.values[mode]
        if (value === undefined) continue
        result.set(keyOf(collection.name, mode, nameToDot(token.name)), {
          collection: collection.name,
          mode,
          token,
          value,
        })
      }
    }
  }
  return result
}

/** Colours compare by their hex value (`#FFF` equals `#ffffff`); everything else literally. */
function sameValue(type: TokenType, a: TokenValue, b: TokenValue): boolean {
  if (a === b) return true
  if (type !== 'color' || typeof a !== 'string' || typeof b !== 'string') return false
  if (parseAlias(a) || parseAlias(b)) return false
  const left = parseColor(a)
  const right = parseColor(b)
  return left.ok && right.ok && toHex(left.color) === toHex(right.color)
}

interface Resolution {
  state: TokenState
  chain: ResolveStep[]
}

/**
 * Resolves a token in its own mode. Aliases into other collections read their first mode, as
 * `resolve` does without a selection for them.
 */
function resolveEntry(model: TokenModel, entry: Entry): Resolution {
  const result = resolve(model, entry.token.name, { [entry.collection]: entry.mode })
  const state: TokenState = { raw: entry.value }
  if (result.ok) state.resolved = result.value
  return { state, chain: result.chain }
}

/**
 * Compares two token models and lists what changed per collection, mode and token. The models
 * are not modified. Descriptions and `$extensions` are not compared: they do not change how a
 * token looks.
 */
export function diffTokens(base: TokenModel, head: TokenModel): TokenChangeSet {
  const before = entries(base)
  const after = entries(head)
  const direct = new Map<string, TokenChange>()

  for (const [key, entry] of after) {
    const old = before.get(key)
    const name = nameToDot(entry.token.name)
    if (!old) {
      direct.set(key, {
        kind: 'added',
        collection: entry.collection,
        mode: entry.mode,
        name,
        type: entry.token.type,
        after: resolveEntry(head, entry).state,
      })
      continue
    }
    const typeChanged = old.token.type !== entry.token.type
    if (typeChanged || !sameValue(entry.token.type, old.value, entry.value)) {
      direct.set(key, {
        kind: 'changed',
        collection: entry.collection,
        mode: entry.mode,
        name,
        type: entry.token.type,
        ...(typeChanged ? { typeBefore: old.token.type } : {}),
        before: resolveEntry(base, old).state,
        after: resolveEntry(head, entry).state,
      })
    }
  }
  for (const [key, entry] of before) {
    if (after.has(key)) continue
    direct.set(key, {
      kind: 'removed',
      collection: entry.collection,
      mode: entry.mode,
      name: nameToDot(entry.token.name),
      type: entry.token.type,
      before: resolveEntry(base, entry).state,
    })
  }

  const changes = [...direct.values()]
  for (const [key, entry] of after) {
    const old = before.get(key)
    if (!old || direct.has(key) || parseAlias(entry.value) === null) continue
    const was = resolveEntry(base, old)
    const now = resolveEntry(head, entry)
    const resolvedSame =
      was.state.resolved !== undefined && now.state.resolved !== undefined
        ? sameValue(entry.token.type, was.state.resolved, now.state.resolved)
        : was.state.resolved === now.state.resolved
    if (resolvedSame) continue

    // Both chains: a removed alias target only appears in the base chain.
    const causes = new Set<string>()
    for (const step of [...was.chain, ...now.chain]) {
      const stepKey = keyOf(step.collection, step.mode, nameToDot(step.name))
      if (stepKey !== key && direct.has(stepKey)) causes.add(nameToDot(step.name))
    }
    changes.push({
      kind: 'affected',
      collection: entry.collection,
      mode: entry.mode,
      name: nameToDot(entry.token.name),
      type: entry.token.type,
      before: was.state,
      after: now.state,
      causes: [...causes].sort(),
    })
  }

  changes.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      compare(a.collection, b.collection) ||
      compare(a.mode, b.mode) ||
      compare(a.name, b.name),
  )
  const counts = { changed: 0, added: 0, removed: 0, affected: 0 }
  for (const change of changes) counts[change.kind]++
  return { changes, counts }
}
