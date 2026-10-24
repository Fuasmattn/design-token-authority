import { parseAlias } from './alias.js'
import type { TokenName } from './types.js'

/**
 * References in DTCG 2025.10: curly aliases (`"{color.blue}"`, whole tokens only) and JSON
 * Pointer `$ref` objects (`{ "$ref": "#/color/blue/$value/components/0" }`), which may point into
 * a value. DTA resolves both by token name (names are unique across collections), so a pointer
 * `#/a/b/$value/x` is the token `a.b` and the part `x` of its value.
 */
export interface Reference {
  kind: 'alias' | 'ref'
  /** The token it points at. */
  target: TokenName
  /** The part of the target's value, for a `$ref` into a value (`['components', '0']`). */
  part: string[]
  /** As written, for messages: `{a.b}` or `$ref "#/a/b/$value"`. */
  text: string
}

/** A reference found inside a value, with where it sits (`['color']`, `['0', 'offsetX']`). */
export interface NestedReference extends Reference {
  at: string[]
}

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Whether a value is a `$ref` object (`{ "$ref": "…" }` and nothing else). */
export function isRefObject(value: unknown): value is { $ref: string } {
  return isObject(value) && typeof value.$ref === 'string' && Object.keys(value).length === 1
}

/** Why a `$ref` cannot be read, or null. Only pointers within the token files are supported. */
export function refProblem(value: { $ref: string }): string | null {
  if (!value.$ref.startsWith('#/'))
    return `$ref "${value.$ref}" must point into the token files with "#/…"; other files and URLs are not read`
  return null
}

/** Decodes a JSON Pointer (`#/a~1b/c`) into its segments (`['a/b', 'c']`). */
export function pointerSegments(pointer: string): string[] {
  const body = pointer.replace(/^#\/?/, '')
  if (body === '') return []
  return body.split('/').map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
}

/** The reference a whole value is, or null for anything else. */
export function referenceOf(value: unknown): Reference | null {
  const alias = parseAlias(value)
  if (alias) return { kind: 'alias', target: alias, part: [], text: value as string }
  if (isRefObject(value) && refProblem(value) === null) {
    const segments = pointerSegments(value.$ref)
    const at = segments.indexOf('$value')
    return {
      kind: 'ref',
      target: at === -1 ? segments : segments.slice(0, at),
      part: at === -1 ? [] : segments.slice(at + 1),
      text: `$ref "${value.$ref}"`,
    }
  }
  return null
}

/** Every reference inside a value (not the value itself), depth first, in document order. */
export function nestedReferences(value: unknown): NestedReference[] {
  const found: NestedReference[] = []
  const walk = (node: unknown, at: string[]) => {
    const children: [string, unknown][] = Array.isArray(node)
      ? node.map((child, i) => [String(i), child])
      : isObject(node) && !isRefObject(node)
        ? Object.entries(node)
        : []
    for (const [key, child] of children) {
      const reference = referenceOf(child)
      if (reference) found.push({ ...reference, at: [...at, key] })
      else walk(child, [...at, key])
    }
  }
  walk(value, [])
  return found
}

/** Every reference a value makes: itself (when it is one) or the ones inside it. */
export function referencesIn(value: unknown): NestedReference[] {
  const top = referenceOf(value)
  return top ? [{ ...top, at: [] }] : nestedReferences(value)
}

/** The part of a value at `part`, or undefined when there is none. */
export function partOf(value: unknown, part: string[]): unknown {
  let node = value
  for (const key of part) {
    if (Array.isArray(node) && /^\d+$/.test(key)) node = node[Number(key)]
    else if (isObject(node) && key in node) node = node[key]
    else return undefined
  }
  return node
}
