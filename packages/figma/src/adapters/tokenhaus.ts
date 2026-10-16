import type { Diagnostic, TokenFileInput } from '@dta/core'
import { z } from 'zod'
import type { Adapter } from './types.js'

/**
 * Adapter for exports of the tokenHaus Figma plugin (kept for parity with v1
 * `pull --from-file`; whether it stays is decided in TICKET-039).
 *
 * Format: one JSON file whose top-level keys are Figma collection names, with
 * `$extensions.com.figma.modes` at the root. Multi-mode tokens have an object `$value`
 * ({ "Light": "#fff", "Dark": "#000" }); single-mode tokens a scalar. Aliases are prefixed
 * with the collection name, which the per-mode files do not use.
 */

/** Root keys that are metadata, not collections. */
const ROOT_META_KEYS = new Set(['$name', '$description', '$extensions'])

/** The mode name given to tokens that carry a single scalar value. */
const DEFAULT_MODE = 'Mode 1'

const Marker = z.looseObject({
  $extensions: z.looseObject({
    'com.figma': z.looseObject({}).refine((figma) => 'modes' in figma),
  }),
})

const Leaf = z.looseObject({
  $type: z.string(),
  $value: z.unknown().refine((value) => value !== undefined),
  $description: z.string().optional(),
  $extensions: z.record(z.string(), z.unknown()).optional(),
})
type Leaf = z.infer<typeof Leaf>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function collectTokens(
  group: Record<string, unknown>,
  path: string[],
  into: Array<{ path: string[]; token: Leaf }>,
) {
  for (const [key, value] of Object.entries(group)) {
    if (key.startsWith('$')) continue
    const leaf = Leaf.safeParse(value)
    if (leaf.success) into.push({ path: [...path, key], token: leaf.data })
    else if (isRecord(value)) collectTokens(value, [...path, key], into)
  }
}

function setNested(tree: Record<string, unknown>, path: string[], value: unknown) {
  let current = tree
  for (const key of path.slice(0, -1)) {
    if (!isRecord(current[key])) current[key] = {}
    current = current[key] as Record<string, unknown>
  }
  current[path[path.length - 1]] = value
}

/** `{Colors.blue.500}` → `{blue.500}` when `Colors` is a collection of this export. */
function rewriteAlias(value: unknown, collectionNames: Set<string>): unknown {
  if (typeof value !== 'string') return value
  const match = value.match(/^\{(.+)\}$/)
  if (!match) return value
  for (const name of collectionNames) {
    if (match[1].startsWith(name + '.')) return `{${match[1].substring(name.length + 1)}}`
  }
  return value
}

export const tokenHausAdapter: Adapter = {
  format: 'tokenhaus',

  detect: (data) => Marker.safeParse(data).success,

  convert(data) {
    const diagnostics: Diagnostic[] = []
    const collections = Object.keys(data).filter((key) => !ROOT_META_KEYS.has(key))
    const collectionNames = new Set(collections)
    const trees = new Map<string, Record<string, unknown>>()

    for (const collectionName of collections) {
      const collection = data[collectionName]
      if (!isRecord(collection)) continue
      if (collectionName.includes('.')) {
        // File names are split at the first dot, so this collection could not be read back.
        diagnostics.push({
          severity: 'error',
          code: 'invalid-collection-name',
          message: `The collection "${collectionName}" contains a dot, which token file names cannot represent. Rename it in Figma.`,
        })
        continue
      }

      const found: Array<{ path: string[]; token: Leaf }> = []
      collectTokens(collection, [], found)
      for (const { path, token } of found) {
        const base: Record<string, unknown> = { $type: token.$type }
        if (token.$description) base.$description = token.$description
        if (token.$extensions) base.$extensions = token.$extensions

        const perMode = isRecord(token.$value)
          ? Object.entries(token.$value)
          : [[DEFAULT_MODE, token.$value] as const]
        for (const [modeName, modeValue] of perMode) {
          const fileName = `${collectionName}.${modeName}.json`
          const tree = trees.get(fileName) ?? {}
          trees.set(fileName, tree)
          setNested(tree, path, { ...base, $value: rewriteAlias(modeValue, collectionNames) })
        }
      }
    }

    const files: TokenFileInput[] = [...trees].map(([fileName, tree]) => ({
      fileName,
      content: JSON.stringify(tree),
    }))
    return { files, diagnostics }
  },
}
