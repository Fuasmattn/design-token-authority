import type { Diagnostic, TokenType, TokenValue } from './types.js'

/** Internal: reading the tokens out of one parsed token file. Shared by parse and serialize. */

export const TOKEN_TYPES: readonly string[] = ['color', 'number', 'string', 'boolean']

type Json = Record<string, unknown>

export function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface Entry {
  path: string[]
  node: Json
  type: TokenType
  value: TokenValue
  description?: string
  extensions?: Json
}

export interface ReadResult {
  entries: Entry[]
  problems: Omit<Diagnostic, 'file'>[]
}

/** Find the tokens (objects with `$value`) in a file tree, and the problems with the others. */
export function readEntries(tree: Json): ReadResult {
  const entries: Entry[] = []
  const problems: ReadResult['problems'] = []

  const visit = (group: Json, path: string[]) => {
    for (const [key, child] of Object.entries(group)) {
      if (key.startsWith('$')) continue
      const childPath = [...path, key]
      if (!isObject(child)) {
        problems.push({
          severity: 'warning',
          code: 'unexpected-value',
          message: `"${childPath.join('.')}" is neither a token nor a group and was ignored.`,
          path: childPath,
        })
      } else if ('$value' in child) {
        const entry = toEntry(child, childPath, problems)
        if (entry) entries.push(entry)
      } else {
        visit(child, childPath)
      }
    }
  }
  visit(tree, [])
  return { entries, problems }
}

function toEntry(node: Json, path: string[], problems: ReadResult['problems']): Entry | null {
  const name = path.join('.')
  const type = node.$type
  if (type === undefined) {
    problems.push({
      severity: 'error',
      code: 'missing-type',
      message: `Token "${name}" has no $type.`,
      path,
    })
    return null
  }
  if (typeof type !== 'string' || !TOKEN_TYPES.includes(type)) {
    problems.push({
      severity: 'warning',
      code: 'unsupported-type',
      message: `Token "${name}" has unsupported $type ${JSON.stringify(type)}; it is left out of the model and kept as is.`,
      path,
    })
    return null
  }
  const value = node.$value
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    problems.push({
      severity: 'error',
      code: 'invalid-value',
      message: `Token "${name}" has a $value that is not a string, number or boolean.`,
      path,
    })
    return null
  }
  return {
    path,
    node,
    type: type as TokenType,
    value,
    ...(typeof node.$description === 'string' ? { description: node.$description } : {}),
    ...(isObject(node.$extensions) ? { extensions: node.$extensions } : {}),
  }
}

export const nameKey = (path: string[]) => JSON.stringify(path)
