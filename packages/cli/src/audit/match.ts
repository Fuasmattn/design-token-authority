/**
 * Which token a hard-coded value should be: the token values are resolved once, then every
 * candidate is compared with the tokens of its kind. Tokens the build writes come first, then
 * deeper alias chains (semantic before primitive), as in `dta token find`.
 */
import {
  describeToken,
  nameToDot,
  valueMatcher,
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
  if (scopes.includes('GAP') || scopes.includes('WIDTH_HEIGHT')) kinds.add('spacing')
  if (scopes.includes('CORNER_RADIUS')) kinds.add('radius')
  if (scopes.includes('STROKE_FLOAT')) kinds.add('stroke')
  if (scopes.includes('FONT_SIZE')) kinds.add('font-size')
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
  return { entries }
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
  const matches: Array<{ entry: Entry; depth: number }> = []
  for (const entry of index.entries) {
    if (!entry.kinds.has(candidate.kind)) continue
    for (const { value, depth } of entry.values) {
      const hit = colour
        ? colour(value, entry.type)
        : px !== null
          ? tokenPx(value) === px
          : firstFamily(value) === family
      if (hit) {
        matches.push({ entry, depth })
        break
      }
    }
  }
  matches.sort(
    (a, b) =>
      Number(!a.entry.code) - Number(!b.entry.code) ||
      b.depth - a.depth ||
      (a.entry.name < b.entry.name ? -1 : a.entry.name > b.entry.name ? 1 : 0),
  )
  const best = matches[0]
  if (!best) return null
  return { token: best.entry.name, ...(best.entry.code ? { code: best.entry.code } : {}) }
}
