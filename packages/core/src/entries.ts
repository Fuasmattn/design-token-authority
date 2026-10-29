import { expandExtends } from './extends.js'
import { referenceOf } from './references.js'
import type { Diagnostic, TokenType, TokenValue } from './types.js'
import { isLegacyValue, isTokenType, TOKEN_TYPES, valueProblem } from './values.js'

/** Internal: reading the tokens out of one parsed token file. Shared by parse and serialize. */

type Json = Record<string, unknown>

export function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface Entry {
  path: string[]
  node: Json
  type: TokenType
  /** Whether the type came from the token's own `$type` (not from a group). */
  ownType: boolean
  value: TokenValue
  description?: string
  extensions?: Json
  deprecated?: true | string
  /** Whether the token came from a group's `$extends` (it is not written at this path). */
  inherited?: boolean
  /** For an alias without `$type`: the group's type, used when the target gives none. */
  groupType?: string
}

export interface ReadResult {
  entries: Entry[]
  problems: Omit<Diagnostic, 'file'>[]
}

/** The DTCG 2025.10 properties of tokens and groups. */
const DTCG_KEYS = new Set([
  '$type',
  '$value',
  '$description',
  '$extensions',
  '$deprecated',
  '$extends',
  '$root',
])
/** Keys a file may have at the top level that other tools write (a JSON Schema link, themes). */
const FILE_KEYS = new Set(['$schema', '$metadata', '$themes'])

/** Group defaults that apply to the tokens below them. */
interface Inherited {
  type?: unknown
  deprecated?: unknown
}

/**
 * DTCG 2025.10 (Format §5) forbids `{`, `}` and `.` in names. Braces break aliases, so they are
 * an error. A dot stays readable in DTA (its aliases resolve dotted segments, and scales like
 * `size.4.5` are common in Figma), so it is a warning that other tools may not read the name.
 */
function nameProblem(key: string): { severity: 'error' | 'warning'; text: string } | null {
  if (/[{}]/.test(key))
    return { severity: 'error', text: 'must not contain "{" or "}", because aliases use them' }
  if (key.includes('.')) return { severity: 'warning', text: 'contains "."' }
  return null
}

/**
 * Find the tokens (objects with `$value`) in a file tree, and the problems with the others.
 * DTCG 2025.10: group `$type` and `$deprecated` apply to the tokens below them, `$extends`
 * groups get the tokens of the group they extend, and `$root` is a token named `$root`.
 */
export function readEntries(file: Json): ReadResult {
  const entries: Entry[] = []
  const expanded = expandExtends(file)
  const problems: ReadResult['problems'] = [...expanded.problems]
  const tree = expanded.tree

  const visit = (group: Json, path: string[], inherited: Inherited) => {
    const here: Inherited = {
      type: '$type' in group ? group.$type : inherited.type,
      deprecated: '$deprecated' in group ? group.$deprecated : inherited.deprecated,
    }
    if ('$type' in group && path.length > 0 && !isTokenType(group.$type)) {
      problems.push({
        severity: 'error',
        code: 'unknown-type',
        message: `Group "${path.join('.')}" has unknown $type ${JSON.stringify(group.$type)}; use one of: ${TOKEN_TYPES.join(', ')}.`,
        path,
      })
    }
    for (const [key, child] of Object.entries(group)) {
      if (
        key.startsWith('$') &&
        !DTCG_KEYS.has(key) &&
        !(path.length === 0 && FILE_KEYS.has(key))
      ) {
        problems.push({
          severity: 'warning',
          code: 'reserved-name',
          message: `"${[...path, key].join('.')}": names starting with $ are reserved for DTCG properties, so it is ignored.`,
          path: [...path, key],
        })
        continue
      }
      if (key.startsWith('$') && key !== '$root') continue
      const childPath = [...path, key]
      if (key === '$root' && !(isObject(child) && '$value' in child)) {
        problems.push({
          severity: 'error',
          code: 'invalid-root',
          message: `"${childPath.join('.')}": $root is the group's own token and needs a $value.`,
          path: childPath,
        })
        continue
      }
      const badName = key === '$root' ? null : nameProblem(key)
      if (badName?.severity === 'error') {
        problems.push({
          severity: 'error',
          code: 'invalid-name',
          message: `"${key}" in "${path.join('.') || '(top level)'}": a token or group name ${badName.text}.`,
          path: childPath,
        })
        continue
      }
      if (badName) {
        problems.push({
          severity: 'warning',
          code: 'name-with-dot',
          message: `"${key}" in "${path.join('.') || '(top level)'}" ${badName.text}. DTA reads it, but DTCG 2025.10 does not allow dots in names, so other tools may not.`,
          path: childPath,
        })
      }
      if (!isObject(child)) {
        problems.push({
          severity: 'warning',
          code: 'unexpected-value',
          message: `"${childPath.join('.')}" is neither a token nor a group and was ignored.`,
          path: childPath,
        })
      } else if ('$value' in child) {
        const nested = Object.keys(child).filter((k) => !k.startsWith('$'))
        if (nested.length > 0) {
          problems.push({
            severity: 'error',
            code: 'token-with-children',
            message: `"${childPath.join('.')}" has a $value and also contains ${nested.map((k) => `"${k}"`).join(', ')}; a token cannot hold other tokens or groups.`,
            path: childPath,
          })
          continue
        }
        const entry = toEntry(child, childPath, here, problems)
        if (entry)
          entries.push(expanded.inherited.has(child) ? { ...entry, inherited: true } : entry)
      } else {
        visit(child, childPath, here)
      }
    }
  }
  visit(tree, [], {})
  return { entries, problems }
}

function deprecation(value: unknown): true | string | undefined {
  if (value === true) return true
  if (typeof value === 'string') return value
  return undefined
}

function toEntry(
  node: Json,
  path: string[],
  inherited: Inherited,
  problems: ReadResult['problems'],
): Entry | null {
  const name = path.join('.')
  const ownType = '$type' in node
  // Type: the token's own, else (for an alias) the target's, resolved later, else the group's
  // (DTCG 2025.10 §5.2.2).
  const value = node.$value
  // A reference into a value (`#/size/s/$value/value`) gets the type of that part.
  const alias = referenceOf(value) !== null
  let type = ownType ? node.$type : alias ? 'alias' : inherited.type
  if (type === undefined) {
    problems.push({
      severity: 'error',
      code: 'missing-type',
      message: `Token "${name}" has no $type, and no group above it sets one.`,
      path,
    })
    return null
  }
  if (type === 'alias') {
    // The type of an alias without one comes from its target; parse fills it in.
    return {
      path,
      node,
      type: 'alias' as TokenType,
      ownType: false,
      value: value as string,
      ...(typeof inherited.type === 'string' ? { groupType: inherited.type } : {}),
      ...metadata(node, inherited),
    }
  }
  if (!isTokenType(type)) {
    problems.push({
      severity: 'error',
      code: 'unknown-type',
      message: `Token "${name}" has unknown $type ${JSON.stringify(type)}; use one of: ${TOKEN_TYPES.join(', ')}.`,
      path,
    })
    return null
  }
  const problem = valueProblem(type, value)
  if (problem && isLegacyValue(type, value)) {
    problems.push({
      severity: 'warning',
      code: 'legacy-value',
      message: `Token "${name}" (${type}): the $value ${problem} in DTCG 2025.10; it is kept as written.`,
      path,
    })
  } else if (problem) {
    problems.push({
      severity: 'error',
      code: 'invalid-value',
      message: `Token "${name}" (${type}): the $value ${problem}.`,
      path,
    })
    return null
  }
  return { path, node, type, ownType, value: value as TokenValue, ...metadata(node, inherited) }
}

function metadata(node: Json, inherited: Inherited) {
  const deprecated = deprecation('$deprecated' in node ? node.$deprecated : inherited.deprecated)
  return {
    ...(typeof node.$description === 'string' ? { description: node.$description } : {}),
    ...(isObject(node.$extensions) ? { extensions: node.$extensions } : {}),
    ...(deprecated !== undefined ? { deprecated } : {}),
  }
}

export const nameKey = (path: string[]) => JSON.stringify(path)
