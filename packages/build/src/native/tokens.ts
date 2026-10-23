/**
 * The tokens of the native outputs (spec native-outputs, TICKET-011–013): every built token
 * resolved from the model, shared or per brand, at the default breakpoint, with what kind of
 * value it is. The platform formatters only print.
 */
import {
  FONT_WEIGHT_KEYWORDS,
  nameToDot,
  resolve,
  toColor,
  toSrgb,
  type Collection,
  type Color,
  type ColorValue,
  type Diagnostic,
  type ModeSelection,
  type Token,
  type TokenModel,
  type TokenType,
  type TokenValue,
} from '@dta/core'
import { dimensionKind } from '../formatters/dimension-kind.js'

/** What a native platform writes a value as. */
export type NativeValue =
  | { kind: 'color'; color: Color }
  /** Points (iOS), dp (Android): px, and rem × 16. */
  | { kind: 'length'; value: number }
  /** Points (iOS), sp (Android). */
  | { kind: 'font-size'; value: number }
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  /** Milliseconds. */
  | { kind: 'duration'; value: number }

export interface NativeToken {
  /** The token's name segments: `['Colors', 'Brand', 'Primary']`. */
  path: string[]
  type: TokenType
  value: NativeValue
  /** The alias chain in dot form, the token first: `['Colors.Brand.Primary', 'Colors.Blue.500']`. */
  chain: string[]
}

export interface NativeBrand {
  /** As configured: `BrandA`. */
  name: string
  /** The value of every brand token in this brand, in the order of `NativeTokens.brandPaths`. */
  tokens: NativeToken[]
}

export interface NativeTokens {
  /** Tokens with one value in every brand (all tokens without brands). */
  shared: NativeToken[]
  /** Tokens whose value differs by brand, one list per brand, the same paths in each. */
  brands: NativeBrand[]
  /** Tokens of types no native output writes yet, by type: `{ shadow: 3 }`. */
  unsupported: Partial<Record<TokenType, number>>
}

export interface NativeOptions {
  brands?: readonly string[]
  /** The breakpoint collection and the mode that holds without a media query. */
  breakpoints?: { collection: string; default: string }
}

const COMPOSITES = new Set<TokenType>([
  'shadow',
  'typography',
  'border',
  'gradient',
  'transition',
  'cubicBezier',
  'strokeStyle',
])

/** `16`, `16px`, `1rem` or `{ value, unit }` in px; null for anything else. */
function pixels(value: TokenValue): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const match = /^(-?\d*\.?\d+)(px|rem)?$/.exec(value.trim())
    if (!match) return null
    return match[2] === 'rem' ? Number(match[1]) * 16 : Number(match[1])
  }
  if (typeof value === 'object' && value !== null && 'unit' in value && 'value' in value) {
    const { value: number, unit } = value as { value: unknown; unit: unknown }
    if (typeof number !== 'number') return null
    return unit === 'rem' ? number * 16 : unit === 'px' ? number : null
  }
  return null
}

const scopesOf = (token: Token): string[] => {
  const figma = token.extensions?.['com.figma'] as { scopes?: unknown } | undefined
  const raw = figma?.scopes
  return Array.isArray(raw) ? raw.map(String) : []
}

/**
 * What a number or dimension token is for: its Figma scopes, else the words of its name. As in
 * the CSS: opacity is a fraction (`50` → `0.5`), line heights and font weights stay numbers.
 */
function lengthKind(token: Token): 'length' | 'font-size' | 'opacity' | 'number' {
  const scopes = scopesOf(token)
  if (scopes.includes('FONT_SIZE')) return 'font-size'
  if (scopes.includes('OPACITY')) return 'opacity'
  if (['LINE_HEIGHT', 'FONT_WEIGHT', 'PARAGRAPH_SPACING'].some((s) => scopes.includes(s))) {
    return scopes.includes('PARAGRAPH_SPACING') ? 'length' : 'number'
  }
  if (
    ['GAP', 'WIDTH_HEIGHT', 'CORNER_RADIUS', 'STROKE_FLOAT', 'EFFECT_FLOAT'].some((scope) =>
      scopes.includes(scope),
    )
  ) {
    return 'length'
  }
  const words = token.name.join(' ').toLowerCase()
  if (/opacity|alpha|line[- ]?height|leading|weight|z[- ]?index|ratio|scale|duration/.test(words)) {
    return 'number'
  }
  const kind = dimensionKind(token.name)
  if (kind === 'font-size' || (/\bsize\b/.test(words) && /font|type|text/.test(words))) {
    return 'font-size'
  }
  if (kind !== null) return 'length'
  if (/size|width|height|stroke|border/.test(words)) return 'length'
  return token.type === 'dimension' ? 'length' : 'number'
}

function colorOf(value: TokenValue): { color: Color; clipped: boolean } | null {
  if (typeof value === 'string') {
    const color = toColor(value)
    return color ? { color, clipped: false } : null
  }
  if (typeof value === 'object' && value !== null && 'colorSpace' in value) {
    return toSrgb(value as ColorValue)
  }
  return null
}

/** A resolved value as a native platform writes it; null when it has no native form. */
function nativeValue(token: Token, type: TokenType, value: TokenValue): NativeValue | null {
  switch (type) {
    case 'color': {
      const color = colorOf(value)
      return color && { kind: 'color', color: color.color }
    }
    case 'number':
    case 'dimension': {
      const px = pixels(value)
      if (px === null) return null
      const kind = lengthKind(token)
      return kind === 'opacity' ? { kind: 'number', value: px / 100 } : { kind, value: px }
    }
    case 'fontWeight': {
      const weight =
        typeof value === 'number' ? value : FONT_WEIGHT_KEYWORDS[String(value).toLowerCase()]
      return weight === undefined ? null : { kind: 'number', value: weight }
    }
    case 'fontFamily':
      return { kind: 'string', value: Array.isArray(value) ? value.join(', ') : String(value) }
    case 'string':
      return typeof value === 'string' ? { kind: 'string', value } : null
    case 'boolean':
      return typeof value === 'boolean' ? { kind: 'boolean', value } : null
    case 'duration': {
      if (typeof value !== 'object' || value === null || !('unit' in value)) return null
      const { value: number, unit } = value as { value: number; unit: string }
      return { kind: 'duration', value: unit === 's' ? number * 1000 : number }
    }
    default:
      return null
  }
}

/** The breakpoint collection's default mode, and every multi-mode collection that has the brand. */
function selection(
  model: TokenModel,
  brand: string | undefined,
  breakpoint: { collection: Collection; mode: string } | undefined,
): ModeSelection {
  const chosen: ModeSelection = {}
  if (breakpoint) chosen[breakpoint.collection.name] = breakpoint.mode
  if (brand !== undefined) {
    for (const collection of model.collections) {
      if (collection === breakpoint?.collection || collection.modes.length < 2) continue
      if (collection.modes.includes(brand)) chosen[collection.name] = brand
    }
  }
  return chosen
}

/**
 * The tokens of `model` (the built collections) for the native outputs, resolved in `fullModel`
 * (aliases may point into collections that are not built). Notes about what is left out (other
 * breakpoints, other modes, unknown brands, colours clipped to sRGB) go into `diagnostics`.
 */
export function nativeTokens(
  fullModel: TokenModel,
  model: TokenModel,
  options: NativeOptions,
  diagnostics: Diagnostic[],
): NativeTokens {
  const note = (code: string, message: string) =>
    diagnostics.push({ severity: 'warning', code, message })

  const screens = options.breakpoints
    ? fullModel.collections.find((c) => c.name === options.breakpoints?.collection)
    : undefined
  const breakpoint =
    screens && options.breakpoints && screens.modes.includes(options.breakpoints.default)
      ? { collection: screens, mode: options.breakpoints.default }
      : undefined
  const brands = (options.brands ?? []).filter((brand) => {
    const known = fullModel.collections.some(
      (c) => c !== breakpoint?.collection && c.modes.length > 1 && c.modes.includes(brand),
    )
    if (!known) {
      note(
        'unknown-brand',
        `"${brand}" is not a mode of any multi-mode collection, so the native outputs have no theme for it.`,
      )
    }
    return known
  })

  // What the native files leave out: the other breakpoints, and the other modes of a collection
  // no brand selects (resolver modifiers such as dark mode).
  const listed = (modes: string[]) =>
    `${modes.map((mode) => `"${mode}"`).join(', ')} ${modes.length === 1 ? 'is' : 'are'}`
  for (const collection of model.collections) {
    if (collection.modes.length < 2) continue
    if (collection === breakpoint?.collection) {
      const left = collection.modes.filter((mode) => mode !== breakpoint.mode)
      note(
        'native-breakpoints',
        `The native outputs use the default breakpoint "${breakpoint.mode}" of "${collection.name}"; ${listed(left)} not in them (native apps have no media queries).`,
      )
      continue
    }
    if (brands.some((brand) => collection.modes.includes(brand))) continue
    const used = collection.defaultMode ?? collection.modes[0]
    note(
      'native-modes',
      `The native outputs read "${collection.name}" in its default mode "${used}"; ${listed(collection.modes.filter((mode) => mode !== used))} not in them.`,
    )
  }

  const unsupported: Partial<Record<TokenType, number>> = {}
  /** Tokens left out, by reason, for one note each: never silently. */
  const left = { value: [] as string[], brand: [] as string[], kind: [] as string[] }
  const clipped = new Set<string>()
  const resolveIn = (
    token: Token,
    chosen: ModeSelection,
  ): { token: NativeToken; collections: string[] } | 'failed' | 'no-native-form' => {
    const result = resolve(fullModel, token.name, chosen)
    // Dangling and circular aliases are reported by the build already.
    if (!result.ok) return 'failed'
    const value = nativeValue(token, result.type, result.value)
    if (value === null) return 'no-native-form'
    if (value.kind === 'color' && colorOf(result.value)?.clipped) clipped.add(nameToDot(token.name))
    return {
      token: {
        path: token.name,
        type: result.type,
        value,
        chain: result.chain.map((step) => nameToDot(step.name)),
      },
      collections: result.chain.map((step) => step.collection),
    }
  }

  // A brand token is one whose alias chain goes through a collection a brand selects, whatever
  // its values: so a token does not move between DesignTokens and the theme when values change.
  const brandCollections = new Set(
    fullModel.collections
      .filter(
        (c) =>
          c !== breakpoint?.collection &&
          c.modes.length > 1 &&
          brands.some((brand) => c.modes.includes(brand)),
      )
      .map((c) => c.name),
  )
  const shared: NativeToken[] = []
  const perBrand: NativeToken[][] = brands.map(() => [])
  for (const collection of model.collections) {
    for (const token of collection.tokens) {
      const name = nameToDot(token.name)
      if (COMPOSITES.has(token.type)) {
        unsupported[token.type] = (unsupported[token.type] ?? 0) + 1
        continue
      }
      const contexts = brands.length === 0 ? [undefined] : brands
      const results = contexts.map((brand) =>
        resolveIn(token, selection(fullModel, brand, breakpoint)),
      )
      if (results.includes('failed')) {
        // Failing everywhere is a broken alias (reported by the build); in some brands only, a
        // theme member that one brand cannot give.
        if (!results.every((result) => result === 'failed')) left.brand.push(name)
        continue
      }
      if (results.includes('no-native-form')) {
        left.value.push(name)
        continue
      }
      const resolved = results as Array<{ token: NativeToken; collections: string[] }>
      const kinds = new Set(resolved.map((result) => result.token.value.kind))
      if (kinds.size > 1) {
        left.kind.push(name)
        continue
      }
      const byBrand = resolved.some((result) =>
        result.collections.some((c) => brandCollections.has(c)),
      )
      if (!byBrand) shared.push(resolved[0].token)
      else resolved.forEach((result, i) => perBrand[i].push(result.token))
    }
  }
  const names = (list: string[]) =>
    `${list
      .slice(0, 3)
      .map((name) => `"${name}"`)
      .join(', ')}${list.length > 3 ? ` and ${list.length - 3} more` : ''}`
  const count = (list: string[]) => `${list.length} token${list.length === 1 ? '' : 's'}`
  if (left.value.length > 0) {
    note(
      'native-value-skipped',
      `${count(left.value)} with a value the native outputs cannot write (such as 50% or 1em) ${left.value.length === 1 ? 'is' : 'are'} left out: ${names(left.value)}.`,
    )
  }
  if (left.brand.length > 0) {
    note(
      'native-brand-skipped',
      `${count(left.brand)} that do not resolve in every brand ${left.brand.length === 1 ? 'is' : 'are'} left out of the native outputs: ${names(left.brand)}.`,
    )
  }
  if (left.kind.length > 0) {
    note(
      'native-kind-skipped',
      `${count(left.kind)} with a different kind of value per brand ${left.kind.length === 1 ? 'is' : 'are'} left out of the native outputs: ${names(left.kind)}.`,
    )
  }
  if (clipped.size > 0) {
    note(
      'native-color-clipped',
      `${clipped.size} colour token${clipped.size === 1 ? ' is' : 's are'} outside sRGB; the native outputs write ${clipped.size === 1 ? 'it' : 'them'} clipped to sRGB.`,
    )
  }
  return {
    shared,
    brands: brands.map((name, i) => ({ name, tokens: perBrand[i] })),
    unsupported,
  }
}
