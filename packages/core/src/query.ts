/**
 * Token queries: what a token resolves to in each context, which tokens resolve to a value,
 * and a filtered list. Read-only, on a parsed model; the CLI (`dta token`) formats the results.
 */
import { parseAlias } from './alias.js'
import { parseColor, type Color } from './color.js'
import { indexTokens } from './lookup.js'
import { nameToDot } from './names.js'
import { nestedReferences } from './references.js'
import { resolve, type ModeSelection } from './resolve.js'
import type { Collection, Token, TokenModel, TokenType, TokenValue } from './types.js'

/** One context a token can be read in, and what it resolves to there. */
export interface TokenReading {
  /**
   * The modes of multi-mode collections the resolution went through, e.g.
   * `{ Brand: 'BrandB' }`. Empty when only single-mode collections are involved.
   */
  modes: Record<string, string>
  /** The raw value of the token itself in this context (a value or an `{alias}`). */
  raw?: TokenValue
  /** The final value, when the chain resolves. */
  value?: TokenValue
  /** Token names along the alias chain, starting with the token itself. */
  chain: string[]
  /** References inside the raw value (a shadow from colour and size tokens), in order. */
  parts?: { at: string; reference: string }[]
  /** Why it did not resolve. */
  error?: string
}

export interface TokenDescription {
  name: string
  type: TokenType
  collection: string
  description?: string
  /** One reading per distinct context, the default context first. */
  readings: TokenReading[]
  /** The Figma metadata the build reads (scopes), for code identifiers. */
  extensions?: Record<string, unknown>
}

export interface TokenSummary {
  name: string
  type: TokenType
  collection: string
  /** Whether the token's own value is an alias in every mode. */
  alias: boolean
}

export interface ValueMatch {
  name: string
  type: TokenType
  collection: string
  modes: Record<string, string>
  value: TokenValue
  /** Number of alias steps to the value: 0 for the token that holds it. */
  depth: number
}

export interface ListFilter {
  collection?: string
  type?: TokenType
  /** Glob on the dot name: `*` matches within a segment, `**` across segments. */
  match?: string
}

export interface FindOptions {
  type?: TokenType
  /** Colours: also match colours within a small distance (about 2 % per channel). */
  near?: boolean
}

const multiModeCollections = (model: TokenModel) =>
  model.collections.filter((collection) => collection.modes.length > 1)

/** The contexts worth reading a token in: the default, then each mode of each multi-mode collection. */
function contexts(model: TokenModel): ModeSelection[] {
  const result: ModeSelection[] = [{}]
  for (const collection of multiModeCollections(model)) {
    for (const mode of collection.modes) result.push({ [collection.name]: mode })
  }
  return result
}

function read(model: TokenModel, token: Token, selection: ModeSelection): TokenReading {
  const result = resolve(model, token.name, selection)
  const multi = new Set(multiModeCollections(model).map((collection) => collection.name))
  const modes: Record<string, string> = {}
  for (const step of result.chain) {
    if (multi.has(step.collection)) modes[step.collection] = step.mode
  }
  const first = result.chain[0]
  const raw = first ? token.values[first.mode] : undefined
  const parts = raw === undefined ? [] : nestedReferences(raw)
  return {
    modes,
    ...(raw !== undefined ? { raw } : {}),
    ...(parts.length > 0
      ? { parts: parts.map((part) => ({ at: part.at.join('.'), reference: part.text })) }
      : {}),
    ...(result.ok ? { value: result.value } : { error: result.diagnostics[0]?.message }),
    chain: result.chain.map((step) => nameToDot(step.name)),
  }
}

/** Every distinct reading of a token: one per combination of modes its chain goes through. */
function readings(model: TokenModel, token: Token, selection?: ModeSelection): TokenReading[] {
  if (selection) return [read(model, token, selection)]
  const seen = new Set<string>()
  const result: TokenReading[] = []
  for (const context of contexts(model)) {
    const reading = read(model, token, context)
    // A context the chain does not go through repeats the default reading.
    const key = JSON.stringify(Object.entries(reading.modes).sort())
    if (seen.has(key)) continue
    seen.add(key)
    result.push(reading)
  }
  return result
}

function locate(model: TokenModel, name: string): { token: Token; collection: Collection } | null {
  return indexTokens(model).get(name)?.[0] ?? null
}

/**
 * What a token is and what it resolves to: in every mode combination its alias chain goes
 * through, or only in the given selection. Returns null for an unknown name.
 */
export function describeToken(
  model: TokenModel,
  name: string,
  selection?: ModeSelection,
): TokenDescription | null {
  const found = locate(model, name)
  if (!found) return null
  const { token, collection } = found
  return {
    name: nameToDot(token.name),
    type: token.type,
    collection: collection.name,
    ...(token.description !== undefined ? { description: token.description } : {}),
    ...(token.extensions ? { extensions: token.extensions } : {}),
    readings: readings(model, token, selection),
  }
}

function globToRegExp(glob: string): RegExp {
  const pattern = glob
    .split('**')
    .map((part) =>
      part
        .split('*')
        .map((text) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^.]*'),
    )
    .join('.*')
  return new RegExp(`^${pattern}$`)
}

/** Token names with type and collection, sorted by name. */
export function listTokens(model: TokenModel, filter: ListFilter = {}): TokenSummary[] {
  const match = filter.match ? globToRegExp(filter.match) : null
  const result: TokenSummary[] = []
  for (const collection of model.collections) {
    if (filter.collection && collection.name !== filter.collection) continue
    for (const token of collection.tokens) {
      if (filter.type && token.type !== filter.type) continue
      const name = nameToDot(token.name)
      if (match && !match.test(name)) continue
      const values = Object.values(token.values)
      result.push({
        name,
        type: token.type,
        collection: collection.name,
        alias: values.length > 0 && values.every((value) => parseAlias(value) !== null),
      })
    }
  }
  return result.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

/** `#rrggbb[aa]`, `#rgb[a]`, `rgb(r g b)` or `rgb(r, g, b)` (0–255); null for anything else. */
export function toColor(value: string): Color | null {
  const hex = parseColor(value)
  if (hex.ok) return hex.color
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/i.exec(
    value.trim(),
  )
  if (!rgb) return null
  const alpha = rgb[4]
    ? rgb[4].endsWith('%')
      ? parseFloat(rgb[4]) / 100
      : parseFloat(rgb[4])
    : undefined
  return {
    r: Number(rgb[1]) / 255,
    g: Number(rgb[2]) / 255,
    b: Number(rgb[3]) / 255,
    ...(alpha !== undefined && alpha !== 1 ? { a: alpha } : {}),
  }
}

const NEAR = 0.02

function colorMatches(a: Color, b: Color, near: boolean): boolean {
  const channels: Array<keyof Color> = ['r', 'g', 'b', 'a']
  const diff = Math.max(...channels.map((c) => Math.abs((a[c] ?? 1) - (b[c] ?? 1))))
  return near ? diff <= NEAR : diff < 0.5 / 255
}

/**
 * A predicate that says whether a token value (of a type) equals the query, with the same rules
 * as `findTokensByValue`: colours as hex or `rgb()` (`near`: within about 2 % per channel),
 * numbers with or without `px`, strings and booleans exactly.
 */
export function valueMatcher(
  query: string,
  options: FindOptions = {},
): (value: TokenValue, type: TokenType) => boolean {
  const color = toColor(query)
  const number = /^-?\d*\.?\d+(px)?$/.test(query.trim()) ? parseFloat(query) : null
  return (value, type) => {
    if (options.type && type !== options.type) return false
    if (type === 'color' && color && typeof value === 'string') {
      const other = toColor(value)
      return other !== null && colorMatches(color, other, Boolean(options.near))
    }
    if (type === 'number' && number !== null) return Number(value) === number
    if (type === 'boolean') return String(value) === query.trim()
    if (type === 'string') return String(value) === query
    return false
  }
}

/**
 * Every token that resolves to the value in some context. Tokens that reach it through aliases
 * come first (deepest chain first: component, then semantic tokens), then the token holding it.
 */
export function findTokensByValue(
  model: TokenModel,
  query: string,
  options: FindOptions = {},
): ValueMatch[] {
  const matches = valueMatcher(query, options)
  const result: ValueMatch[] = []
  for (const collection of model.collections) {
    for (const token of collection.tokens) {
      for (const reading of readings(model, token)) {
        if (reading.value === undefined || !matches(reading.value, token.type)) continue
        result.push({
          name: nameToDot(token.name),
          type: token.type,
          collection: collection.name,
          modes: reading.modes,
          value: reading.value,
          depth: reading.chain.length - 1,
        })
      }
    }
  }
  return result.sort(
    (a, b) => b.depth - a.depth || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  )
}

/** Up to `limit` existing names closest to a name that does not exist (for "did you mean"). */
export function suggestTokenNames(model: TokenModel, name: string, limit = 5): string[] {
  const names = [...indexTokens(model).keys()]
  const lower = name.toLowerCase()
  const distance = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0]
      row[0] = i
      for (let j = 1; j <= b.length; j++) {
        const current = row[j]
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
        previous = current
      }
    }
    return row[b.length]
  }
  return names
    .map((candidate) => {
      const other = candidate.toLowerCase()
      const contains = other.includes(lower) || lower.includes(other) ? -100 : 0
      return { candidate, score: distance(lower, other) + contains }
    })
    .sort((a, b) => a.score - b.score || (a.candidate < b.candidate ? -1 : 1))
    .slice(0, limit)
    .map((entry) => entry.candidate)
}
