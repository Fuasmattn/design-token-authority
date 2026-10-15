import { isObject, nameKey, readEntries } from './entries.js'
import type {
  Collection,
  Diagnostic,
  FileSource,
  ParseResult,
  Token,
  TokenFileInput,
} from './types.js'

const FILE_NAME = /^([^.]+)\.(.+)\.json$/

/** Detect how a file was formatted so serialize can write it back the same way. */
export function detectFormat(content: string): Pick<FileSource, 'indent' | 'trailingNewline'> {
  const indent = /\n([ \t]+)\S/.exec(content)?.[1] ?? '  '
  return { indent, trailingNewline: content.endsWith('\n') }
}

/**
 * Turns per-mode DTCG token files (`{Collection}.{Mode}.json`) into a token model.
 * Never throws on bad input: problems come back as diagnostics.
 */
export function parseTokenFiles(files: TokenFileInput[]): ParseResult {
  const diagnostics: Diagnostic[] = []
  const collections = new Map<string, Collection>()
  // Sort by collection, then mode, so the result does not depend on the order of the input.
  const parts = (f: TokenFileInput) => FILE_NAME.exec(f.fileName)?.slice(1, 3) ?? [f.fileName, '']
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  const sorted = [...files].sort((a, b) => {
    const [ca, ma] = parts(a)
    const [cb, mb] = parts(b)
    return compare(ca, cb) || compare(ma, mb) || compare(a.fileName, b.fileName)
  })
  const explained = new Set<string>()

  for (const { fileName, content } of sorted) {
    const fail = (code: string, message: string) =>
      diagnostics.push({ severity: 'error', code, message, file: fileName })

    const match = FILE_NAME.exec(fileName)
    if (!match) {
      fail('invalid-file-name', `"${fileName}" must be named {Collection}.{Mode}.json.`)
      continue
    }
    const [, collectionName, modeName] = match
    if (content.trim() === '') {
      fail('empty-file', `"${fileName}" is empty.`)
      continue
    }
    let tree: unknown
    try {
      tree = JSON.parse(content)
    } catch (error) {
      fail('invalid-json', `"${fileName}" is not valid JSON: ${(error as Error).message}`)
      continue
    }
    if (!isObject(tree)) {
      fail('not-an-object', `"${fileName}" must contain a JSON object.`)
      continue
    }

    let collection = collections.get(collectionName)
    if (collection?.modes.includes(modeName)) {
      fail(
        'duplicate-file',
        `"${fileName}" repeats collection "${collectionName}" mode "${modeName}".`,
      )
      continue
    }
    if (!collection) {
      collection = { name: collectionName, modes: [], tokens: [], sources: {} }
      collections.set(collectionName, collection)
    }
    collection.modes.push(modeName)
    collection.sources[modeName] = { fileName, tree, ...detectFormat(content) }

    const { entries, problems } = readEntries(tree)
    for (const problem of problems) diagnostics.push({ ...problem, file: fileName })

    const byName = new Map(collection.tokens.map((t) => [nameKey(t.name), t]))
    for (const entry of entries) {
      const existing = byName.get(nameKey(entry.path))
      if (!existing) {
        const token: Token = {
          name: entry.path,
          type: entry.type,
          values: { [modeName]: entry.value },
          ...(entry.description !== undefined ? { description: entry.description } : {}),
          ...(entry.extensions ? { extensions: entry.extensions } : {}),
        }
        collection.tokens.push(token)
        byName.set(nameKey(entry.path), token)
      } else if (existing.type !== entry.type) {
        explained.add(`${collectionName}|${nameKey(entry.path)}|${modeName}`)
        diagnostics.push({
          severity: 'error',
          code: 'type-mismatch',
          message: `Token "${entry.path.join('.')}" is ${entry.type} in mode "${modeName}" but ${existing.type} in an earlier mode; the first type is kept.`,
          file: fileName,
          path: entry.path,
        })
      } else {
        existing.values[modeName] = entry.value
        if (existing.description === undefined && entry.description !== undefined) {
          existing.description = entry.description
        }
        if (existing.extensions === undefined && entry.extensions) {
          existing.extensions = entry.extensions
        }
      }
    }
  }

  for (const collection of collections.values()) {
    for (const token of collection.tokens) {
      // A type mismatch already explained why a mode has no value for this token.
      const missing = collection.modes.filter(
        (mode) =>
          !(mode in token.values) &&
          !explained.has(`${collection.name}|${nameKey(token.name)}|${mode}`),
      )
      if (missing.length > 0) {
        diagnostics.push({
          severity: 'warning',
          code: 'missing-in-mode',
          message: `Token "${token.name.join('.')}" in collection "${collection.name}" has no value in mode ${missing.map((m) => `"${m}"`).join(', ')}.`,
          path: token.name,
        })
      }
    }
  }

  return { model: { collections: [...collections.values()] }, diagnostics }
}
