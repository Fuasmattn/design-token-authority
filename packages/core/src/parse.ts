import { referenceOf } from './references.js'
import { readResolver } from './resolver.js'
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
/** DTCG 2025.10 token files: `app.tokens` or `app.tokens.json`, one collection, one mode. */
const TOKENS_FILE = /^(.+)\.tokens(?:\.json)?$/

/** The mode name of a collection read from a `.tokens` file, which has no modes. */
export const SINGLE_MODE = 'Value'

/**
 * The collection and mode a token file holds: `{Collection}.{Mode}.json`, or a DTCG `.tokens` /
 * `.tokens.json` file (the whole base name is the collection, in one mode, `Value`). Null for
 * any other name.
 */
export function tokenFileParts(fileName: string): { collection: string; mode: string } | null {
  const tokens = TOKENS_FILE.exec(fileName)
  if (tokens) return { collection: tokens[1], mode: SINGLE_MODE }
  const match = FILE_NAME.exec(fileName)
  return match ? { collection: match[1], mode: match[2] } : null
}

/** Whether a file in a tokens directory holds tokens (not a resolver document or other JSON). */
export function isTokenFileName(fileName: string): boolean {
  if (fileName.endsWith('.resolver.json')) return false
  return TOKENS_FILE.test(fileName) || fileName.endsWith('.json')
}

/** Detect how a file was formatted so serialize can write it back the same way. */
export function detectFormat(content: string): Pick<FileSource, 'indent' | 'trailingNewline'> {
  const indent = /\n([ \t]+)\S/.exec(content)?.[1] ?? '  '
  return { indent, trailingNewline: content.endsWith('\n') }
}

export interface ParseOptions {
  /** The resolver document to use, by file name; default: the only `*.resolver.json`. */
  resolver?: string
  /** The context to read for each modifier of a resolver document by default. */
  modifiers?: Record<string, string>
}

/**
 * Turns token files into a token model: per-mode DTCG files (`{Collection}.{Mode}.json`),
 * `.tokens` files, or a DTCG 2025.10 resolver document (`*.resolver.json`) and the files it
 * names. Never throws on bad input: problems come back as diagnostics.
 */
export function parseTokenFiles(files: TokenFileInput[], options: ParseOptions = {}): ParseResult {
  const resolvers = files.filter((f) => f.fileName.endsWith('.resolver.json'))
  const chosen = options.resolver
    ? (resolvers.find(
        (f) => f.fileName === options.resolver || f.fileName.endsWith(`/${options.resolver}`),
      ) ?? null)
    : resolvers.length === 1
      ? resolvers[0]
      : null
  if (options.resolver && !chosen) {
    return {
      model: { collections: [] },
      diagnostics: [
        {
          severity: 'error',
          code: 'resolver-not-found',
          message: `The resolver document "${options.resolver}" is not in the tokens directory.`,
          file: options.resolver,
        },
      ],
    }
  }
  if (!chosen && resolvers.length > 1) {
    return {
      model: { collections: [] },
      diagnostics: [
        {
          severity: 'error',
          code: 'several-resolvers',
          message: `The tokens directory has several resolver documents (${resolvers.map((f) => `"${f.fileName}"`).join(', ')}); name the one to use in tokens.resolver.`,
        },
      ],
    }
  }
  if (!chosen) {
    return parseInputs(files)
  }
  const read = readResolver(chosen, files, options.modifiers ?? {})
  const result = parseInputs(read.inputs)
  for (const collection of result.model.collections) {
    const mode = read.defaults[collection.name]
    if (mode && collection.modes.includes(mode)) collection.defaultMode = mode
  }
  const unused = files.filter(
    (f) =>
      f !== chosen &&
      !read.used.has(f.fileName) &&
      isTokenFileName(f.fileName.split('/').pop() ?? ''),
  )
  return {
    model: result.model,
    diagnostics: [
      ...read.diagnostics,
      ...result.diagnostics,
      ...unused.map(
        (f): Diagnostic => ({
          severity: 'warning',
          code: 'not-in-resolver',
          message: `"${f.fileName}" is not part of the resolver document "${chosen.fileName}" and was not read.`,
          file: f.fileName,
        }),
      ),
    ],
  }
}

/** A token file, or (from a resolver document) a tree that names its collection and mode. */
export interface ParseInput extends TokenFileInput {
  collection?: string
  mode?: string
}

function parseInputs(files: ParseInput[]): ParseResult {
  const diagnostics: Diagnostic[] = []
  const collections = new Map<string, Collection>()
  // Sort by collection, then mode, so the result does not depend on the order of the input.
  const partsOf = (f: ParseInput) =>
    f.collection !== undefined && f.mode !== undefined
      ? { collection: f.collection, mode: f.mode }
      : tokenFileParts(f.fileName)
  const parts = (f: ParseInput) => {
    const found = partsOf(f)
    return found ? [found.collection, found.mode] : [f.fileName, '']
  }
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  const sorted = [...files].sort((a, b) => {
    const [ca, ma] = parts(a)
    const [cb, mb] = parts(b)
    return compare(ca, cb) || compare(ma, mb) || compare(a.fileName, b.fileName)
  })
  const explained = new Set<string>()

  for (const input of sorted) {
    const { fileName, content } = input
    const fail = (code: string, message: string) =>
      diagnostics.push({ severity: 'error', code, message, file: fileName })

    const match = partsOf(input)
    if (!match) {
      fail(
        'invalid-file-name',
        `"${fileName}" must be named {Collection}.{Mode}.json, or {Collection}.tokens(.json) for a collection with one mode.`,
      )
      continue
    }
    const { collection: collectionName, mode: modeName } = match
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
      const first = collection.sources[modeName]?.fileName
      fail(
        'duplicate-file',
        `"${fileName}" repeats collection "${collectionName}" mode "${modeName}"${first ? `, which "${first}" already holds` : ''}.`,
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
          ...(entry.deprecated !== undefined ? { deprecated: entry.deprecated } : {}),
        }
        collection.tokens.push(token)
        byName.set(nameKey(entry.path), token)
      } else if (
        existing.type !== entry.type &&
        existing.type !== ALIAS_PENDING &&
        entry.type !== ALIAS_PENDING
      ) {
        explained.add(`${collectionName}|${nameKey(entry.path)}|${modeName}`)
        diagnostics.push({
          severity: 'error',
          code: 'type-mismatch',
          message: `Token "${entry.path.join('.')}" is ${entry.type} in mode "${modeName}" but ${existing.type} in an earlier mode; the first type is kept.`,
          file: fileName,
          path: entry.path,
        })
      } else {
        // A mode with its own $type settles the type of an alias that had none so far.
        if (existing.type === ALIAS_PENDING) existing.type = entry.type
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

  settleAliasTypes([...collections.values()], diagnostics)

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

/** The type an alias without `$type` (on itself or a group) has until its target is known. */
const ALIAS_PENDING = 'alias' as Token['type']

/**
 * DTCG 2025.10: an alias without a `$type` of its own or from a group has the type of the
 * token it points to. Follows the chain through the whole model; a chain that ends nowhere or
 * in a circle leaves the token without a type, which is reported and drops it.
 */
function settleAliasTypes(collections: Collection[], diagnostics: Diagnostic[]) {
  const byDot = new Map<string, Token>()
  for (const collection of collections)
    for (const token of collection.tokens) byDot.set(token.name.join('.'), token)

  const typeOf = (token: Token, seen: Set<Token>): Token['type'] | null => {
    if (token.type !== ALIAS_PENDING) return token.type
    if (seen.has(token)) return null
    seen.add(token)
    for (const value of Object.values(token.values)) {
      const reference = referenceOf(value)
      const next =
        reference && reference.part.length === 0 ? byDot.get(reference.target.join('.')) : undefined
      const type = next ? typeOf(next, seen) : null
      if (type) return type
    }
    return null
  }

  for (const collection of collections) {
    collection.tokens = collection.tokens.filter((token) => {
      if (token.type !== ALIAS_PENDING) return true
      const type = typeOf(token, new Set())
      if (type) {
        token.type = type
        return true
      }
      diagnostics.push({
        severity: 'error',
        code: 'missing-type',
        message: `Token "${token.name.join('.')}" has no $type, and the token its alias points to gives none either.`,
        path: token.name,
      })
      return false
    })
  }
}
