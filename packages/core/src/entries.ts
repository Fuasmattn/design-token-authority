import { parseAlias } from './alias.js'
import type { Diagnostic, TokenType, TokenValue } from './types.js'
import { isTokenType, TOKEN_TYPES, valueProblem } from './values.js'

/** Internal: reading the tokens out of one parsed token file. Shared by parse and serialize. */

export { TOKEN_TYPES }

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
}

export interface ReadResult {
  entries: Entry[]
  problems: Omit<Diagnostic, 'file'>[]
}

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
  if (/[{}]/.test(key)) return { severity: 'error', text: 'must not contain "{" or "}"' }
  if (key.includes('.')) return { severity: 'warning', text: 'contains "."' }
  return null
}

/**
 * Find the tokens (objects with `$value`) in a file tree, and the problems with the others.
 * Group `$type` and `$deprecated` apply to the tokens below them (DTCG 2025.10).
 */
export function readEntries(tree: Json): ReadResult {
  const entries: Entry[] = []
  const problems: ReadResult['problems'] = []

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
      if (key.startsWith('$')) continue
      const childPath = [...path, key]
      const badName = nameProblem(key)
      if (badName?.severity === 'error') {
        problems.push({
          severity: 'error',
          code: 'invalid-name',
          message: `"${key}" in "${path.join('.') || '(top level)'}": a token or group name ${badName.text}, because aliases use them.`,
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
        if (entry) entries.push(entry)
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
  // Type: the token's own, else (for an alias) the target's, resolved later, else the group's.
  let type = ownType ? node.$type : inherited.type
  const value = node.$value
  if (type === undefined && parseAlias(value)) type = 'alias'
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
  if (problem) {
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
