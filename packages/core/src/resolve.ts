import { parseAlias } from './alias.js'
import { nameToDot } from './names.js'
import type {
  Collection,
  Diagnostic,
  Token,
  TokenModel,
  TokenName,
  TokenType,
  TokenValue,
} from './types.js'

/** Which mode to read in each collection, by collection name. Missing → the first mode. */
export type ModeSelection = Record<string, string>

export interface ResolveStep {
  collection: string
  mode: string
  name: TokenName
}

export type ResolveResult =
  | { ok: true; value: TokenValue; type: TokenType; chain: ResolveStep[] }
  | { ok: false; diagnostics: Diagnostic[]; chain: ResolveStep[] }

interface Located {
  token: Token
  collection: Collection
}

function index(model: TokenModel): Map<string, Located[]> {
  const byName = new Map<string, Located[]>()
  for (const collection of model.collections) {
    for (const token of collection.tokens) {
      const key = nameToDot(token.name)
      byName.set(key, [...(byName.get(key) ?? []), { token, collection }])
    }
  }
  return byName
}

/**
 * Names are unique across collections (a project invariant), so a token name identifies one
 * token. Returns an error diagnostic for every name used in more than one collection.
 */
export function checkUniqueNames(model: TokenModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const [name, found] of index(model)) {
    const collections = [...new Set(found.map((f) => f.collection.name))]
    if (collections.length > 1) {
      diagnostics.push({
        severity: 'error',
        code: 'duplicate-name',
        message: `Token "${name}" exists in several collections (${collections.map((c) => `"${c}"`).join(', ')}); names must be unique across collections.`,
        path: found[0].token.name,
      })
    }
  }
  return diagnostics
}

/**
 * Resolves a token to its final value by following aliases. An alias finds its target by
 * (unique) name and reads it in the mode selected for the target's collection, like Figma.
 * Problems come back as diagnostics.
 */
export function resolve(
  model: TokenModel,
  name: TokenName,
  selection: ModeSelection = {},
): ResolveResult {
  const byName = index(model)
  const chain: ResolveStep[] = []
  const seen = new Set<string>()
  const fail = (code: string, message: string, path: TokenName): ResolveResult => ({
    ok: false,
    chain,
    diagnostics: [{ severity: 'error', code, message, path }],
  })

  let current: TokenName = name
  let expectedType: TokenType | undefined
  let referrer: TokenName | undefined

  for (;;) {
    const here = nameToDot(current)
    const found = byName.get(here)?.[0]
    if (!found) {
      if (!referrer) return fail('unknown-token', `There is no token "${here}".`, current)
      const isGroup = [...byName.keys()].some((key) => key.startsWith(`${here}.`))
      return fail(
        'dangling-alias',
        isGroup
          ? `"${nameToDot(referrer)}" aliases "${here}", which is a group, not a token.`
          : `"${nameToDot(referrer)}" aliases "${here}", which does not exist.`,
        referrer,
      )
    }
    const { token, collection } = found
    const mode = selection[collection.name] ?? collection.modes[0]
    if (!collection.modes.includes(mode)) {
      return fail(
        'unknown-mode',
        `Collection "${collection.name}" has no mode "${mode}".`,
        token.name,
      )
    }

    const visit = `${collection.name}|${mode}|${here}`
    chain.push({ collection: collection.name, mode, name: token.name })
    if (seen.has(visit)) {
      const cycle = chain.map((step) => nameToDot(step.name)).join(' → ')
      return fail('circular-alias', `Circular alias chain: ${cycle}`, name)
    }
    seen.add(visit)

    if (expectedType !== undefined && token.type !== expectedType) {
      return fail(
        'alias-type-mismatch',
        `"${nameToDot(referrer ?? name)}" is ${expectedType} but aliases "${here}", which is ${token.type}.`,
        referrer ?? name,
      )
    }
    const value = token.values[mode]
    if (value === undefined) {
      return fail(
        'missing-value',
        `Token "${here}" has no value in mode "${mode}" of "${collection.name}".`,
        token.name,
      )
    }

    const alias = parseAlias(value)
    if (!alias) return { ok: true, value, type: token.type, chain }
    expectedType = token.type
    referrer = token.name
    current = alias
  }
}
