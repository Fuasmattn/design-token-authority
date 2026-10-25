/**
 * Which token a hard-coded value should be: the token values are resolved once, then every
 * candidate is compared with the tokens of its kind. Tokens the build writes come first, then
 * deeper alias chains (semantic before primitive), as in `dta token find`. With `breakpoints`,
 * tokens that have the value at every breakpoint come before those that have it at the default
 * one, and tokens that have it only at other breakpoints are never suggested (TICKET-125).
 */
import {
  breakpointReach,
  describeToken,
  nameToDot,
  reachRank,
  valueMatcher,
  type BreakpointReach,
  type TokenModel,
  type TokenType,
  type TokenValue,
} from '@dta/core'
import { codeNames, type CodeNames } from '../code-names.js'
import type { Config } from '../config/schema.js'
import type { Candidate, ValueKind } from './detect.js'

interface Entry {
  name: string
  type: TokenType
  kinds: Set<ValueKind>
  values: Array<{ value: TokenValue; depth: number }>
  code?: CodeNames
}

export interface Suggestion {
  token: string
  code?: CodeNames
}

export interface TokenIndex {
  entries: Entry[]
  /** Where a token has a value across the breakpoints (TICKET-125). */
  reach: (name: string, holds: (value: TokenValue, type: TokenType) => boolean) => BreakpointReach
}

/**
 * The kind of value each Figma scope is for, as Figma means it: `GAP` is space between and around
 * things, `WIDTH_HEIGHT` the size of a thing (TICKET-147: not spacing, or a size token would be
 * offered for every padding). A token with several scopes is a candidate for each kind.
 */
const SCOPE_KINDS: Readonly<Record<string, ValueKind>> = {
  GAP: 'spacing',
  WIDTH_HEIGHT: 'size',
  CORNER_RADIUS: 'radius',
  STROKE_FLOAT: 'stroke',
  FONT_SIZE: 'font-size',
}

/** What a number or string token is for: from its Figma scopes, else from its name. */
function kindsOf(name: string, type: TokenType, scopes: readonly string[]): Set<ValueKind> {
  const kinds = new Set<ValueKind>()
  if (type === 'color') kinds.add('color')
  const lower = name.toLowerCase()
  if (type === 'fontFamily') {
    kinds.add('font-family')
    return kinds
  }
  if (type === 'string') {
    if (
      scopes.includes('FONT_FAMILY') ||
      /famil|typeface/.test(lower) ||
      lower.split('.').some((segment) => /^fonts?$/.test(segment))
    ) {
      kinds.add('font-family')
    }
    return kinds
  }
  // A DTCG dimension is a length: the same kinds as a number, by scopes or name.
  if (type !== 'number' && type !== 'dimension') return kinds
  for (const scope of scopes) {
    const kind = SCOPE_KINDS[scope]
    if (kind) kinds.add(kind)
  }
  if (kinds.size > 0) return kinds
  const segments = lower.split('.')
  if (segments.some((s) => /^(space|spacing|spacer|gap|padding|margin|inset|gutter)s?$/.test(s))) {
    kinds.add('spacing')
  }
  if (segments.some((s) => /radius|radii|rounded|corner/.test(s))) kinds.add('radius')
  if (segments.some((s) => /^(stroke|border-?width|outline-?width|border)s?$/.test(s))) {
    kinds.add('stroke')
  }
  if (
    segments.some((s) => /^font-?size$|^size$|^text-?size$/.test(s)) &&
    /font|type|text/.test(lower)
  ) {
    kinds.add('font-size')
  } else if (segments.some((s) => /^(sizes?|sizing|width|height|dimensions?)$/.test(s))) {
    // A size by name (`icon.size`, `control.height`), unless the name says font size.
    kinds.add('size')
  }
  return kinds
}

export function buildTokenIndex(model: TokenModel, config: Config | null): TokenIndex {
  const entries: Entry[] = []
  for (const collection of model.collections) {
    for (const token of collection.tokens) {
      const name = nameToDot(token.name)
      const description = describeToken(model, name)
      if (!description) continue
      const figma = token.extensions?.['com.figma'] as { scopes?: unknown } | undefined
      const rawScopes = figma?.scopes
      const scopes = Array.isArray(rawScopes) ? rawScopes.map(String) : []
      const kinds = kindsOf(name, token.type, scopes)
      if (kinds.size === 0) continue
      const values = description.readings
        .filter((reading) => reading.value !== undefined)
        .map((reading) => ({
          value: reading.value as TokenValue,
          depth: reading.chain.length - 1,
        }))
      const code = codeNames(model, config, description, token.extensions)
      entries.push({ name, type: token.type, kinds, values, ...(code ? { code } : {}) })
    }
  }
  const breakpoints = config?.breakpoints
  const reach: TokenIndex['reach'] = (name, holds) =>
    breakpoints
      ? breakpointReach(model, name, holds, {
          collection: breakpoints.collection,
          default: breakpoints.default,
        })
      : 'every'
  return { entries, reach }
}

/** A length in px: `16px` → 16, `1rem` → 16 (16px root). */
const toPx = (value: string) => {
  const number = parseFloat(value)
  return value.endsWith('rem') ? number * 16 : number
}

/** A token's length in px: a number, or a DTCG dimension in px or rem (16px root). */
function tokenPx(value: TokenValue): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string')
    return /^-?\d*\.?\d+(px|rem)?$/.test(value.trim()) ? toPx(value) : null
  if (typeof value === 'object' && 'unit' in value && 'value' in value) {
    const { value: n, unit } = value as { value: unknown; unit: unknown }
    if (typeof n !== 'number') return null
    return unit === 'rem' ? n * 16 : unit === 'px' ? n : null
  }
  return null
}

/** A token's first font family, lower case. */
const firstFamily = (value: TokenValue) =>
  String(Array.isArray(value) ? value[0] : value)
    .split(',')[0]
    .replace(/['"]/g, '')
    .trim()
    .toLowerCase()

/** The token a hard-coded value should be, or null when no token has the value. */
export function suggestToken(
  index: TokenIndex,
  candidate: Candidate,
  options: { near?: boolean } = {},
): Suggestion | null {
  const colour = candidate.kind === 'color' ? valueMatcher(candidate.value, options) : null
  const px =
    candidate.kind !== 'color' && candidate.kind !== 'font-family' ? toPx(candidate.value) : null
  const family = candidate.kind === 'font-family' ? candidate.value.toLowerCase() : null
  const holds = (value: TokenValue, type: TokenType) =>
    colour
      ? colour(value, type)
      : px !== null
        ? tokenPx(value) === px
        : firstFamily(value) === family
  const matches: Array<{ entry: Entry; depth: number; reach: BreakpointReach }> = []
  for (const entry of index.entries) {
    if (!entry.kinds.has(candidate.kind)) continue
    const hit = entry.values.find(({ value }) => holds(value, entry.type))
    if (!hit) continue
    // Only at other breakpoints: replacing the value would change the page at the default one.
    const reach = index.reach(entry.name, holds)
    if (reach === 'other') continue
    matches.push({ entry, depth: hit.depth, reach })
  }
  matches.sort(
    (a, b) =>
      reachRank(a.reach) - reachRank(b.reach) ||
      Number(!a.entry.code) - Number(!b.entry.code) ||
      b.depth - a.depth ||
      (a.entry.name < b.entry.name ? -1 : a.entry.name > b.entry.name ? 1 : 0),
  )
  const best = matches[0]
  if (!best) return null
  return { token: best.entry.name, ...(best.entry.code ? { code: best.entry.code } : {}) }
}
