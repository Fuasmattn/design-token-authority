import { indexTokens } from './lookup.js'
import { nameToDot } from './names.js'
import { nestedReferences, partOf, referenceOf } from './references.js'
import type { Reference } from './references.js'
import type { Diagnostic, TokenModel, TokenName, TokenType, TokenValue } from './types.js'
import { formatValue, valueProblem } from './values.js'

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

/**
 * Names are unique across collections (a project invariant), so a token name identifies one
 * token. Returns an error diagnostic for every name used in more than one collection.
 */
export function checkUniqueNames(model: TokenModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const [name, found] of indexTokens(model)) {
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
 * Resolves a token to its final value by following aliases and `$ref` pointers. A reference
 * finds its target by (unique) name and reads it in the mode selected for the target's
 * collection, like Figma. A `$ref` into a value (`#/a/b/$value/components/0`) takes that part of
 * the target's resolved value. References inside a composite value (a shadow's `color`, a
 * typography's `fontSize`) are resolved too, so `value` holds no references. `chain` lists the
 * top-level steps. Problems come back as diagnostics.
 */
export function resolve(
  model: TokenModel,
  name: TokenName,
  selection: ModeSelection = {},
): ResolveResult {
  return resolveIn(indexTokens(model), name, selection, new Set())
}

type Index = ReturnType<typeof indexTokens>

function resolveIn(
  byName: Index,
  name: TokenName,
  selection: ModeSelection,
  active: Set<string>,
): ResolveResult {
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
  let via: Reference | undefined

  for (;;) {
    const here = nameToDot(current)
    const found = byName.get(here)?.[0]
    if (!found) {
      if (!referrer) return fail('unknown-token', `There is no token "${here}".`, current)
      const isGroup = [...byName.keys()].some((key) => key.startsWith(`${here}.`))
      const what = via?.kind === 'ref' ? `points with ${via.text} at` : 'aliases'
      return fail(
        'dangling-alias',
        isGroup
          ? `"${nameToDot(referrer)}" ${what} "${here}", which is a group, not a token.`
          : `"${nameToDot(referrer)}" ${what} "${here}", which does not exist.`,
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
    if (seen.has(visit) || active.has(visit)) {
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

    const reference = referenceOf(value)
    if (reference && reference.part.length > 0) {
      // A pointer into a value: resolve the target, then take the part.
      const inner = new Set([...active, ...seen])
      const target = resolveIn(byName, reference.target, selection, inner)
      chain.push(...target.chain)
      if (!target.ok) return { ...target, chain }
      const part = partOf(target.value, reference.part)
      if (part === undefined) {
        return fail(
          'dangling-alias',
          `"${here}" points with ${reference.text} at a part of "${nameToDot(reference.target)}" that its value does not have.`,
          token.name,
        )
      }
      const problem = valueProblem(token.type, part)
      if (problem) {
        return fail(
          'alias-type-mismatch',
          `"${here}" is ${token.type}, but ${reference.text} gives ${formatValue(part as TokenValue)}: the value ${problem}.`,
          token.name,
        )
      }
      return { ok: true, value: part as TokenValue, type: token.type, chain }
    }
    if (!reference) {
      // A value: resolve the references inside it (composite parts, colour components …).
      const inner = new Set([...active, ...seen])
      const deep = resolveParts(byName, value, selection, inner, token.name)
      if (!deep.ok) return { ok: false, chain, diagnostics: deep.diagnostics }
      if (deep.value !== value) {
        const problem = valueProblem(token.type, deep.value)
        if (problem) {
          return fail(
            'alias-type-mismatch',
            `"${here}" is ${token.type}, but its references give ${formatValue(deep.value)}: the value ${problem}.`,
            token.name,
          )
        }
      }
      return { ok: true, value: deep.value, type: token.type, chain }
    }
    expectedType = token.type
    referrer = token.name
    via = reference
    current = reference.target
  }
}

type PartsResult = { ok: true; value: TokenValue } | { ok: false; diagnostics: Diagnostic[] }

/** The value with every reference inside it replaced by what it resolves to. */
function resolveParts(
  byName: Index,
  value: TokenValue,
  selection: ModeSelection,
  active: Set<string>,
  owner: TokenName,
): PartsResult {
  const references = nestedReferences(value)
  if (references.length === 0) return { ok: true, value }
  const result = structuredClone(value) as unknown
  for (const reference of references) {
    const target = resolveIn(byName, reference.target, selection, active)
    if (!target.ok) {
      const first = target.diagnostics[0]
      const missing = first?.code === 'unknown-token'
      return {
        ok: false,
        diagnostics: [
          {
            severity: 'error',
            code: missing ? 'dangling-alias' : (first?.code ?? 'dangling-alias'),
            message: missing
              ? `"${nameToDot(owner)}" refers to "${nameToDot(reference.target)}" in ${reference.at.join('.')}, which does not exist.`
              : (first?.message ?? ''),
            path: owner,
          },
        ],
      }
    }
    const part = reference.part.length > 0 ? partOf(target.value, reference.part) : target.value
    if (part === undefined) {
      return {
        ok: false,
        diagnostics: [
          {
            severity: 'error',
            code: 'dangling-alias',
            message: `"${nameToDot(owner)}" points with ${reference.text} at a part of "${nameToDot(reference.target)}" that its value does not have.`,
            path: owner,
          },
        ],
      }
    }
    setPart(result, reference.at, part)
  }
  return { ok: true, value: result as TokenValue }
}

function setPart(root: unknown, at: string[], value: unknown) {
  let node = root as Record<string, unknown>
  for (const key of at.slice(0, -1)) node = node[key] as Record<string, unknown>
  node[at[at.length - 1]] = value
}
