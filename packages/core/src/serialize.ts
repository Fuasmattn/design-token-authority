import { isObject, nameKey, readEntries } from './entries.js'
import type { Collection, Token, TokenFileInput } from './types.js'

type Json = Record<string, unknown>

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Turns a token model back into per-mode token files. Files that came from
 * `parseTokenFiles` are updated in place, so an untouched model reproduces the original
 * content (key order, unknown fields, formatting). Output is sorted by file name.
 */
export function serializeTokenFiles(model: { collections: Collection[] }): TokenFileInput[] {
  const files: TokenFileInput[] = []
  for (const collection of model.collections) {
    const tokens = new Map(collection.tokens.map((t) => [nameKey(t.name), t]))
    const baseline = originalMetadata(collection)

    for (const mode of collection.modes) {
      const source = collection.sources[mode]
      const tree: Json = source ? structuredClone(source.tree) : {}
      const fileName = source?.fileName ?? `${collection.name}.${mode}.json`

      const present = new Set<string>()
      for (const entry of readEntries(tree).entries) {
        const key = nameKey(entry.path)
        const token = tokens.get(key)
        if (!token || !(mode in token.values)) {
          removeEntry(tree, entry.path)
          continue
        }
        present.add(key)
        entry.node.$type = token.type
        entry.node.$value = token.values[mode]
        applyMetadata(entry.node, token, baseline.get(key))
      }

      for (const token of collection.tokens) {
        if (!(mode in token.values) || present.has(nameKey(token.name))) continue
        insertEntry(tree, token, mode)
      }

      const text = JSON.stringify(tree, null, source?.indent ?? '  ')
      files.push({ fileName, content: text + ((source?.trailingNewline ?? true) ? '\n' : '') })
    }
  }
  return files.sort((a, b) => (a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0))
}

/** The description/extensions parse derived for each token from the original files. */
function originalMetadata(collection: Collection) {
  const result = new Map<string, { description?: string; extensions?: Json }>()
  for (const mode of collection.modes) {
    const source = collection.sources[mode]
    if (!source) continue
    for (const entry of readEntries(source.tree).entries) {
      const key = nameKey(entry.path)
      const known = result.get(key) ?? {}
      if (known.description === undefined && entry.description !== undefined) {
        known.description = entry.description
      }
      if (known.extensions === undefined && entry.extensions) known.extensions = entry.extensions
      result.set(key, known)
    }
  }
  return result
}

/** Write description/extensions only when the model changed them, so per-mode data survives. */
function applyMetadata(
  node: Json,
  token: Token,
  original: { description?: string; extensions?: Json } | undefined,
) {
  // An empty description means the same as none (Figma reports '' for variables without one).
  if ((token.description || undefined) !== (original?.description || undefined)) {
    if (token.description === undefined) delete node.$description
    else node.$description = token.description
  }
  if (!same(token.extensions, original?.extensions)) {
    if (token.extensions === undefined) delete node.$extensions
    else node.$extensions = structuredClone(token.extensions)
  }
}

function removeEntry(tree: Json, path: string[]) {
  const parents: Json[] = [tree]
  for (const segment of path.slice(0, -1))
    parents.push(parents[parents.length - 1][segment] as Json)
  delete parents[parents.length - 1][path[path.length - 1]]
  // Prune groups that are now empty.
  for (let depth = path.length - 1; depth > 0; depth--) {
    const group = parents[depth]
    if (Object.keys(group).some((k) => !k.startsWith('$') || k === '$value')) break
    delete parents[depth - 1][path[depth - 1]]
  }
}

function insertEntry(tree: Json, token: Token, mode: string) {
  let group = tree
  for (const segment of token.name.slice(0, -1)) {
    if (!isObject(group[segment])) group[segment] = {}
    group = group[segment] as Json
  }
  group[token.name[token.name.length - 1]] = {
    $type: token.type,
    $value: token.values[mode],
    ...(token.description !== undefined ? { $description: token.description } : {}),
    ...(token.extensions ? { $extensions: structuredClone(token.extensions) } : {}),
  }
}
