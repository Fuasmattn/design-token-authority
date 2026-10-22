import { parseAlias } from './alias.js'
import { isRefObject, pointerSegments } from './references.js'
import type { Diagnostic } from './types.js'

/**
 * Group `$extends` (DTCG 2025.10, Format §6): a group inherits the tokens and properties of
 * another group, deep-merged; a local token at the same path replaces the inherited one
 * entirely. The target is a group in the same file, named like an alias (`"{button}"`) or with a
 * pointer (`{ "$ref": "#/button" }`).
 *
 * The expansion is a view: local token objects are the file's own (so writing back edits the
 * file), inherited ones are copies, listed in `inherited`.
 */

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isGroup = (value: unknown): value is Json => isObject(value) && !('$value' in value)

export interface Expanded {
  tree: Json
  /** Token objects that a group got through `$extends`, not written in the file there. */
  inherited: WeakSet<object>
  problems: Omit<Diagnostic, 'file'>[]
}

function hasExtends(node: unknown): boolean {
  if (!isGroup(node)) return false
  if ('$extends' in node) return true
  return Object.entries(node).some(([key, child]) => !key.startsWith('$') && hasExtends(child))
}

function targetPath(value: unknown): string[] | null {
  const alias = parseAlias(value)
  if (alias) return alias
  if (isRefObject(value) && value.$ref.startsWith('#/')) return pointerSegments(value.$ref)
  return null
}

export function expandExtends(tree: Json): Expanded {
  const inherited = new WeakSet<object>()
  const problems: Expanded['problems'] = []
  if (!hasExtends(tree)) return { tree, inherited, problems }

  const memo = new Map<string, Json>()
  const stack: string[] = []
  const reported = new Set<string>()
  const error = (code: string, message: string, path: string[]) =>
    problems.push({ severity: 'error', code, message, path })

  const find = (path: string[]): unknown => {
    let node: unknown = tree
    for (const key of path) node = isObject(node) ? node[key] : undefined
    return node
  }

  const copy = (group: Json): Json => {
    const clone = structuredClone(group)
    const mark = (node: unknown) => {
      if (!isObject(node)) return
      if ('$value' in node) inherited.add(node)
      else for (const [key, child] of Object.entries(node)) if (!key.startsWith('$')) mark(child)
    }
    mark(clone)
    return clone
  }

  const merge = (base: Json, local: Json): Json => {
    const out: Json = { ...base }
    delete out.$extends
    for (const [key, value] of Object.entries(local)) {
      if (key === '$extends') continue
      out[key] = isGroup(value) && isGroup(out[key]) ? merge(out[key] as Json, value) : value
    }
    return out
  }

  const expand = (group: Json, path: string[]): Json => {
    const key = path.join('.')
    const done = memo.get(key)
    if (done) return done
    if (stack.includes(key)) {
      // Every group in the circle is reported once, at its own path.
      const cycle = [...stack.slice(stack.indexOf(key)), key]
      const text = cycle.map((k) => `"${k || '(top level)'}"`).join(' → ')
      for (const member of new Set(cycle)) {
        if (reported.has(member)) continue
        reported.add(member)
        error(
          'circular-extends',
          `Group "${member || '(top level)'}" extends in a circle: ${text}.`,
          member ? member.split('.') : [],
        )
      }
      return group
    }
    stack.push(key)
    const local: Json = {}
    for (const [name, child] of Object.entries(group))
      local[name] = !name.startsWith('$') && isGroup(child) ? expand(child, [...path, name]) : child

    let result = local
    if ('$extends' in group) {
      const target = targetPath(group.$extends)
      const node = target ? find(target) : undefined
      const where = `"${key || '(top level)'}"`
      if (!target) {
        error(
          'invalid-extends',
          `Group ${where} has $extends ${JSON.stringify(group.$extends)}; use a group name like "{button}" or { "$ref": "#/button" }.`,
          path,
        )
      } else if (node === undefined) {
        error(
          'invalid-extends',
          `Group ${where} extends "${target.join('.')}", which is not in this file.`,
          path,
        )
      } else if (!isGroup(node)) {
        error(
          'invalid-extends',
          `Group ${where} extends "${target.join('.')}", which is a token; $extends needs a group.`,
          path,
        )
      } else {
        const base = expand(node, target)
        result = merge(copy(base), local)
      }
    }
    stack.pop()
    memo.set(key, result)
    return result
  }

  return { tree: expand(tree, []), inherited, problems }
}
