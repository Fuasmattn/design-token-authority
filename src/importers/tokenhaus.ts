/**
 * Converts a tokenHaus plugin export (single-file, multi-mode DTCG)
 * into per-mode token files matching our pipeline format.
 *
 * tokenHaus format:
 *   - Single JSON file with top-level keys = Figma collection names
 *   - Root $extensions.com.figma.modes maps collection IDs to mode IDs
 *   - Leaf tokens have $type, $value, $extensions
 *   - Multi-mode tokens: $value is { "Light": "#fff", "Dark": "#000" }
 *   - Single-mode tokens: $value is a scalar
 *   - Aliases use dot-notation: {🎨 theme.main.color.base.100}
 */

import { TokensFile } from '../token_types.js'

/** Metadata keys at the root level that are NOT collections */
const ROOT_META_KEYS = new Set(['$name', '$description', '$extensions'])

interface TokenHausToken {
  $type: string
  $value: unknown
  $description?: string
  $extensions?: Record<string, unknown>
}

function isLeafToken(obj: unknown): obj is TokenHausToken {
  return typeof obj === 'object' && obj !== null && '$type' in obj && '$value' in obj
}

/**
 * Walk a token tree and collect all leaf tokens with their dot-separated paths.
 */
function collectTokens(
  obj: Record<string, unknown>,
  path: string[],
  result: Array<{ path: string[]; token: TokenHausToken }>,
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue
    if (isLeafToken(value)) {
      result.push({ path: [...path, key], token: value })
    } else if (typeof value === 'object' && value !== null) {
      collectTokens(value as Record<string, unknown>, [...path, key], result)
    }
  }
}

/**
 * Set a nested value in an object using a path array.
 */
function setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current = obj
  for (let i = 0; i < path.length - 1; i++) {
    if (!(path[i] in current) || typeof current[path[i]] !== 'object') {
      current[path[i]] = {}
    }
    current = current[path[i]] as Record<string, unknown>
  }
  current[path[path.length - 1]] = value
}

/**
 * Convert a tokenHaus export into per-mode token files.
 *
 * Returns a map of filename → TokensFile, where filenames follow
 * the convention {CollectionName}.{ModeName}.json
 */
/**
 * Strip collection name prefixes from alias references.
 *
 * tokenHaus aliases use the format {CollectionName.path.to.token}.
 * Since our per-mode files don't nest tokens under the collection name,
 * we need to strip the collection prefix so Style Dictionary can resolve them.
 */
function rewriteAlias(value: unknown, collectionNames: Set<string>): unknown {
  if (typeof value !== 'string') return value
  const match = value.match(/^\{(.+)\}$/)
  if (!match) return value

  const ref = match[1]
  // Check if the reference starts with any known collection name
  for (const name of collectionNames) {
    if (ref.startsWith(name + '.')) {
      return `{${ref.substring(name.length + 1)}}`
    }
  }
  return value
}

export function convertTokenHausExport(data: Record<string, unknown>): Record<string, TokensFile> {
  const result: Record<string, TokensFile> = {}

  // Collect all collection names first for alias rewriting
  const collectionNames = new Set<string>()
  for (const key of Object.keys(data)) {
    if (!ROOT_META_KEYS.has(key)) {
      collectionNames.add(key)
    }
  }

  for (const [collectionName, collectionData] of Object.entries(data)) {
    if (ROOT_META_KEYS.has(collectionName)) continue
    if (typeof collectionData !== 'object' || collectionData === null) continue

    const tokens: Array<{ path: string[]; token: TokenHausToken }> = []
    collectTokens(collectionData as Record<string, unknown>, [], tokens)

    for (const { path, token } of tokens) {
      const { $type, $value, $description, $extensions } = token

      // Build the token object without $value (added per mode below)
      const baseToken: Record<string, unknown> = { $type }
      if ($description) baseToken.$description = $description
      if ($extensions) baseToken.$extensions = $extensions

      if (typeof $value === 'object' && $value !== null && !Array.isArray($value)) {
        // Multi-mode: $value is { "ModeName": value, ... }
        for (const [modeName, modeValue] of Object.entries($value as Record<string, unknown>)) {
          const fileName = `${collectionName}.${modeName}.json`
          if (!result[fileName]) result[fileName] = {}
          setNestedValue(result[fileName], path, {
            ...baseToken,
            $value: rewriteAlias(modeValue, collectionNames),
          })
        }
      } else {
        // Single-mode: $value is scalar — use "Mode 1" as default mode name
        const fileName = `${collectionName}.Mode 1.json`
        if (!result[fileName]) result[fileName] = {}
        setNestedValue(result[fileName], path, {
          ...baseToken,
          $value: rewriteAlias($value, collectionNames),
        })
      }
    }
  }

  return result
}
