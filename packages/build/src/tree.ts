import { nameToDot, parseAlias, referencesIn } from '@dta/core'
import type { Diagnostic, Token, TokenName, TokenValue } from '@dta/core'

/** The tokens of one collection in one mode: what a single token file holds. */
export interface Source {
  /** `Collection.Mode`, used to decide later which tokens a file is built from. */
  origin: string
  tokens: Array<{ token: Token; value: TokenValue }>
}

type Tree = Record<string, unknown>

export interface MergedTokens {
  /** DTCG token tree, as Style Dictionary reads it. */
  tree: Tree
  /** Origin of every token, by dot path (the last source that defines a path wins). */
  origins: Map<string, string>
}

function leaf(token: Token, value: TokenValue) {
  const node: Record<string, unknown> = { $type: token.type, $value: value }
  if (token.description) node.$description = token.description
  if (token.extensions) node.$extensions = structuredClone(token.extensions)
  return node
}

function isLeaf(node: unknown): boolean {
  return typeof node === 'object' && node !== null && '$value' in node
}

/**
 * Merges sources in order into one tree. A token defined by a later source replaces the
 * earlier one at the same path completely (Style Dictionary's behaviour for token files).
 * Tokens that alias their own path are removed afterwards: a Brand token that shadows a
 * Primitive of the same name would otherwise be a circular reference.
 */
export function mergeSources(sources: Source[]): MergedTokens {
  const tree: Tree = {}
  const origins = new Map<string, string>()

  for (const source of sources) {
    for (const { token, value } of source.tokens) {
      let node = tree
      for (const segment of token.name.slice(0, -1)) {
        if (typeof node[segment] !== 'object' || node[segment] === null || isLeaf(node[segment])) {
          node[segment] = {}
        }
        node = node[segment] as Tree
      }
      node[token.name[token.name.length - 1]] = leaf(token, value)
      origins.set(nameToDot(token.name), source.origin)
    }
  }

  // Drop self-referencing aliases.
  for (const [dotPath] of origins) {
    const segments = dotPath.split('.')
    const parents: Tree[] = [tree]
    for (const segment of segments.slice(0, -1))
      parents.push(parents[parents.length - 1][segment] as Tree)
    const parent = parents[parents.length - 1]
    const node = parent[segments[segments.length - 1]] as Record<string, unknown> | undefined
    const value = node?.$value
    if (typeof value === 'string' && parseAlias(value)?.join('.') === dotPath) {
      delete parent[segments[segments.length - 1]]
      origins.delete(dotPath)
    }
  }

  return { tree, origins }
}

/** Warnings for aliases whose target is not in the merged tokens. */
export function brokenReferences(
  merged: MergedTokens,
  emitted: (dotPath: string) => boolean,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const walk = (node: Tree, path: TokenName) => {
    for (const [key, child] of Object.entries(node)) {
      if (typeof child !== 'object' || child === null) continue
      const childPath = [...path, key]
      if (isLeaf(child)) {
        const value = (child as { $value: unknown }).$value
        const target = typeof value === 'string' ? parseAlias(value) : null
        if (target && emitted(childPath.join('.')) && !merged.origins.has(target.join('.'))) {
          diagnostics.push({
            severity: 'warning',
            code: 'broken-reference',
            message: `"${childPath.join('.')}" aliases "${target.join('.')}", which does not exist.`,
            path: childPath,
          })
        }
      } else {
        walk(child as Tree, childPath)
      }
    }
  }
  walk(merged.tree, [])
  return diagnostics
}

function valueAt(tree: Tree, dotPath: string): unknown {
  let node: unknown = tree
  for (const segment of dotPath.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Tree)[segment]
  }
  return isLeaf(node) ? (node as { $value: unknown }).$value : undefined
}

/**
 * Tokens from origins `through` whose alias chain, through tokens from `through` only, reaches a
 * token from an origin in `to` (by dot path). A theme repeats them (TICKET-093): CSS resolves
 * `var()` where the property is declared, so a `:root` declaration that aliases a brand token
 * would keep the root's brand inside a nested `[data-brand]`.
 */
export function aliasesInto(
  merged: MergedTokens,
  to: (origin: string) => boolean,
  through: (origin: string) => boolean,
): Set<string> {
  const memo = new Map<string, boolean>()
  const reaches = (dotPath: string, seen: Set<string>): boolean => {
    const known = memo.get(dotPath)
    if (known !== undefined) return known
    if (seen.has(dotPath)) return false
    seen.add(dotPath)
    // The alias, or every reference inside a composite (a shadow's colour, …).
    const targets = referencesIn(valueAt(merged.tree, dotPath)).map((r) => r.target.join('.'))
    const result = targets.some((target) => {
      const origin = merged.origins.get(target)
      return origin !== undefined && (to(origin) || (through(origin) && reaches(target, seen)))
    })
    memo.set(dotPath, result)
    return result
  }
  const out = new Set<string>()
  for (const [dotPath, origin] of merged.origins) {
    if (through(origin) && reaches(dotPath, new Set())) out.add(dotPath)
  }
  return out
}
