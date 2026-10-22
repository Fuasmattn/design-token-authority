import { parseAlias } from './alias.js'
import { isRefObject, refProblem } from './references.js'
import { parseColor, toHex } from './color.js'
import { toSrgb } from './color-spaces.js'
import type {
  ColorSpace,
  ColorValue,
  DimensionValue,
  DurationValue,
  TokenType,
  TokenValue,
} from './types.js'

/**
 * Token types and values of DTCG 2025.10 (Format and Color modules), plus `string` and
 * `boolean`, which Figma variables have and DTCG does not. Values are kept as written;
 * this module validates, formats and compares them.
 */

export const TOKEN_TYPES: readonly TokenType[] = [
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'strokeStyle',
  'border',
  'transition',
  'shadow',
  'gradient',
  'typography',
  'string',
  'boolean',
]

export const isTokenType = (value: unknown): value is TokenType =>
  typeof value === 'string' && (TOKEN_TYPES as readonly string[]).includes(value)

/** Component ranges per colour space: `[min, max, maxExclusive]`; `undefined` = unbounded. */
type Range = [number | undefined, number | undefined, boolean?]
const UNIT: Range = [0, 1]
const HUE: Range = [0, 360, true]
const PERCENT: Range = [0, 100]
const COLOR_SPACES: Record<ColorSpace, Range[]> = {
  srgb: [UNIT, UNIT, UNIT],
  'srgb-linear': [UNIT, UNIT, UNIT],
  hsl: [HUE, PERCENT, PERCENT],
  hwb: [HUE, PERCENT, PERCENT],
  lab: [PERCENT, [undefined, undefined], [undefined, undefined]],
  lch: [PERCENT, [0, undefined], HUE],
  oklab: [UNIT, [undefined, undefined], [undefined, undefined]],
  oklch: [UNIT, [0, undefined], HUE],
  'display-p3': [UNIT, UNIT, UNIT],
  'a98-rgb': [UNIT, UNIT, UNIT],
  'prophoto-rgb': [UNIT, UNIT, UNIT],
  rec2020: [UNIT, UNIT, UNIT],
  'xyz-d65': [UNIT, UNIT, UNIT],
  'xyz-d50': [UNIT, UNIT, UNIT],
}

export const FONT_WEIGHT_KEYWORDS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  'extra-light': 200,
  'ultra-light': 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  'semi-bold': 600,
  'demi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  'ultra-bold': 800,
  black: 900,
  heavy: 900,
  'extra-black': 950,
  'ultra-black': 950,
}

const STROKE_STYLES = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'outset', 'inset']
const LINE_CAPS = ['round', 'butt', 'square']

/** Dimension and duration strings of the earlier DTCG drafts (`"4px"`, `"200ms"`), still read. */
const DIMENSION_TEXT = /^(-?(?:\d+\.?\d*|\.\d+))(px|rem)$/
const DURATION_TEXT = /^(-?(?:\d+\.?\d*|\.\d+))(ms|s)$/

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
/** An alias or a `$ref`: allowed for a whole value and for each part of it. */
const isAlias = (value: unknown) => parseAlias(value) !== null || isRefObject(value)

/** Checks a value against its type. Returns what is wrong, or `null` for a valid value. */
export function valueProblem(type: TokenType, value: unknown): string | null {
  if (isRefObject(value)) return refProblem(value)
  if (isAlias(value)) return null
  if (isObject(value) && '$ref' in value) return '$ref must be the only property of its object'
  switch (type) {
    case 'string':
    case 'boolean':
    case 'number':
      // The Figma types read any scalar, as DTA always has (Figma exports and plugins mix them).
      return typeof value === 'string' || typeof value === 'boolean' || isNumber(value)
        ? null
        : 'must be a string, number or boolean'
    case 'color':
      return colorProblem(value)
    case 'dimension':
      return unitProblem(value, ['px', 'rem'], DIMENSION_TEXT)
    case 'duration':
      return unitProblem(value, ['ms', 's'], DURATION_TEXT)
    case 'fontFamily':
      if (typeof value === 'string' && value.trim() !== '') return null
      if (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((v) => typeof v === 'string' && v.trim() !== '')
      )
        return null
      return 'must be a font name or a list of font names'
    case 'fontWeight':
      if (isNumber(value)) return value >= 1 && value <= 1000 ? null : 'must be between 1 and 1000'
      if (typeof value === 'string' && value in FONT_WEIGHT_KEYWORDS) return null
      return `must be a number from 1 to 1000 or one of: ${Object.keys(FONT_WEIGHT_KEYWORDS).join(', ')}`
    case 'cubicBezier':
      if (!Array.isArray(value) || value.length !== 4) return 'must be a list of four numbers'
      if (value.some((v) => !isNumber(v) && !isAlias(v))) return 'must be a list of four numbers'
      if ([value[0], value[2]].some((x) => isNumber(x) && (x < 0 || x > 1)))
        return 'the x values (first and third) must be between 0 and 1'
      return null
    case 'strokeStyle':
      return strokeStyleProblem(value)
    case 'border':
      return compositeProblem(value, { color: 'color', width: 'dimension', style: 'strokeStyle' })
    case 'transition':
      return compositeProblem(value, {
        duration: 'duration',
        delay: 'duration',
        timingFunction: 'cubicBezier',
      })
    case 'shadow':
      if (Array.isArray(value)) {
        if (value.length === 0) return 'must not be an empty list'
        for (const [i, item] of value.entries()) {
          if (isAlias(item)) continue
          const problem = shadowProblem(item)
          if (problem) return `shadow ${i + 1}: ${problem}`
        }
        return null
      }
      return shadowProblem(value)
    case 'gradient':
      if (!Array.isArray(value) || value.length === 0) return 'must be a list of gradient stops'
      for (const [i, item] of value.entries()) {
        if (isAlias(item)) continue
        const problem = compositeProblem(item, { color: 'color', position: 'number' })
        if (problem) return `stop ${i + 1}: ${problem}`
        if (typeof (item as Json).position === 'string' && !isAlias((item as Json).position))
          return `stop ${i + 1}: position must be a number`
      }
      return null
    case 'typography':
      return compositeProblem(value, {
        fontFamily: 'fontFamily',
        fontSize: 'dimension',
        fontWeight: 'fontWeight',
        letterSpacing: 'dimension',
        lineHeight: 'number',
      })
  }
}

function colorProblem(value: unknown): string | null {
  // A hex (or other) string stays a valid colour, as DTA has always read it.
  if (typeof value === 'string') return null
  if (!isObject(value)) return 'must be a colour object or a hex string'
  const { colorSpace, components, alpha, hex } = value
  if (typeof colorSpace !== 'string' || !(colorSpace in COLOR_SPACES))
    return `has an unknown colorSpace ${JSON.stringify(colorSpace)}; use one of: ${Object.keys(COLOR_SPACES).join(', ')}`
  const ranges = COLOR_SPACES[colorSpace as ColorSpace]
  if (!Array.isArray(components) || components.length !== ranges.length)
    return `needs ${ranges.length} components for ${colorSpace}`
  for (const [i, component] of components.entries()) {
    if (component === 'none' || isRefObject(component)) continue
    if (!isNumber(component)) return `component ${i + 1} must be a number or "none"`
    const [min, max, exclusive] = ranges[i]
    const tooLow = min !== undefined && component < min
    const tooHigh = max !== undefined && (exclusive ? component >= max : component > max)
    if (tooLow || tooHigh) {
      const bound = exclusive
        ? `from ${min} to below ${max}`
        : `from ${min ?? '-∞'} to ${max ?? '∞'}`
      return `component ${i + 1} of ${colorSpace} must be ${bound}`
    }
  }
  if (alpha !== undefined && !isRefObject(alpha) && (!isNumber(alpha) || alpha < 0 || alpha > 1))
    return 'alpha must be between 0 and 1'
  if (hex !== undefined && (typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex)))
    return 'hex must be a 6-digit hex colour like #3366ff'
  for (const key of Object.keys(value))
    if (!lenient && !['colorSpace', 'components', 'alpha', 'hex'].includes(key))
      return `has an unknown property "${key}"`
  return null
}

const PART_TYPES: Partial<Record<TokenType, Record<string, TokenType>>> = {
  shadow: {
    color: 'color',
    offsetX: 'dimension',
    offsetY: 'dimension',
    blur: 'dimension',
    spread: 'dimension',
  },
  border: { color: 'color', width: 'dimension', style: 'strokeStyle' },
  transition: { duration: 'duration', delay: 'duration', timingFunction: 'cubicBezier' },
  gradient: { color: 'color', position: 'number' },
  typography: {
    fontFamily: 'fontFamily',
    fontSize: 'dimension',
    fontWeight: 'fontWeight',
    letterSpacing: 'dimension',
    lineHeight: 'number',
  },
}

/**
 * The type a part of a value has (`at` as in a nested reference: `['color']`, `[1, 'blur']`,
 * `['components', 0]`), or undefined where the format gives none. A reference there must point at
 * a token of that type.
 */
export function partType(type: TokenType, at: readonly (string | number)[]): TokenType | undefined {
  const keys = at.filter((key) => !/^\d+$/.test(String(key))).map(String)
  const indexed = at.length > 0 && /^\d+$/.test(String(at[0]))
  if (type === 'color')
    return keys[0] === 'components' || keys[0] === 'alpha' ? 'number' : undefined
  if ((type === 'dimension' || type === 'duration') && at.length === 1 && keys[0] === 'value')
    return 'number'
  if (type === 'cubicBezier') return at.length === 1 ? 'number' : undefined
  if (type === 'strokeStyle')
    return keys[0] === 'dashArray' && at.length === 2 ? 'dimension' : undefined
  if (type === 'shadow' && keys.length === 0 && indexed && at.length === 1) return 'shadow'
  if (keys.length !== 1) return undefined
  return PART_TYPES[type]?.[keys[0]]
}

/** A number with any CSS unit or none (`0`, `100%`, `1em`, `1.5vh`): what earlier drafts wrote. */
const LEGACY_LENGTH = /^-?(?:\d+\.?\d*|\.\d+)(?:[a-z]+|%)?$/i

/** While true, `valueProblem` accepts what {@link isLegacyValue} keeps. Only set synchronously. */
let lenient = false

/**
 * Values earlier drafts and exports wrote that 2025.10 does not allow, but that DTA keeps (with a
 * `legacy-value` warning) so existing files keep working: a dimension or duration as a number
 * with any unit or none ("0", "100%", "1em", "1.5vh"), also inside a composite, and a colour object with properties the
 * Color module does not name. Everything else that `valueProblem` reports is an error.
 */
export function isLegacyValue(type: TokenType, value: unknown): boolean {
  lenient = true
  try {
    return valueProblem(type, value) === null
  } finally {
    lenient = false
  }
}

function unitProblem(value: unknown, units: string[], text: RegExp): string | null {
  if (lenient && typeof value === 'string' && LEGACY_LENGTH.test(value.trim())) return null
  if (typeof value === 'string') {
    return text.test(value.trim())
      ? null
      : `must be an object { value, unit } with unit ${units.join(' or ')}`
  }
  if (!isObject(value)) return `must be an object { value, unit } with unit ${units.join(' or ')}`
  if (!isNumber(value.value) && !isRefObject(value.value)) return 'value must be a number'
  if (!isRefObject(value.unit) && (typeof value.unit !== 'string' || !units.includes(value.unit)))
    return `unit must be ${units.map((u) => `"${u}"`).join(' or ')}`
  for (const key of Object.keys(value))
    if (key !== 'value' && key !== 'unit') return `has an unknown property "${key}"`
  return null
}

function strokeStyleProblem(value: unknown): string | null {
  if (typeof value === 'string')
    return STROKE_STYLES.includes(value) ? null : `must be one of: ${STROKE_STYLES.join(', ')}`
  if (!isObject(value)) return 'must be a keyword or an object { dashArray, lineCap }'
  const { dashArray, lineCap } = value
  if (!Array.isArray(dashArray) || dashArray.length === 0)
    return 'dashArray must be a list of dimensions'
  for (const item of dashArray) {
    const problem = valueProblem('dimension', item)
    if (problem) return `dashArray: ${problem}`
  }
  if (typeof lineCap !== 'string' || !LINE_CAPS.includes(lineCap))
    return `lineCap must be one of: ${LINE_CAPS.join(', ')}`
  for (const key of Object.keys(value))
    if (key !== 'dashArray' && key !== 'lineCap') return `has an unknown property "${key}"`
  return null
}

function shadowProblem(value: unknown): string | null {
  const problem = compositeProblem(
    value,
    {
      color: 'color',
      offsetX: 'dimension',
      offsetY: 'dimension',
      blur: 'dimension',
      spread: 'dimension',
    },
    ['inset'],
  )
  if (problem) return problem
  const inset = (value as Json).inset
  return inset === undefined || typeof inset === 'boolean' ? null : 'inset must be true or false'
}

/** An object with exactly these sub-values (plus `optional` keys), each a value or an alias. */
function compositeProblem(
  value: unknown,
  parts: Record<string, TokenType>,
  optional: string[] = [],
): string | null {
  if (!isObject(value)) return `must be an object with ${Object.keys(parts).join(', ')}`
  for (const [key, type] of Object.entries(parts)) {
    if (!(key in value)) return `is missing "${key}"`
    const problem = valueProblem(type, value[key])
    if (problem) return `${key} ${problem}`
  }
  for (const key of Object.keys(value))
    if (!(key in parts) && !optional.includes(key)) return `has an unknown property "${key}"`
  return null
}

const trim = (n: number) => String(Number(n.toFixed(4)))

/** `#3366ff` for sRGB (with alpha as `#rrggbbaa`), otherwise the CSS colour function. */
export function formatColor(value: ColorValue): string {
  const parts = value.components.map((c) => (c === 'none' ? 'none' : trim(c)))
  const alpha = value.alpha ?? 1
  if (value.colorSpace === 'srgb' && value.components.every((c) => c !== 'none'))
    return toHex({
      r: value.components[0] as number,
      g: value.components[1] as number,
      b: value.components[2] as number,
      ...(alpha !== 1 ? { a: alpha } : {}),
    })
  const slash = alpha !== 1 ? ` / ${trim(alpha)}` : ''
  if (['hsl', 'hwb', 'lab', 'lch', 'oklab', 'oklch'].includes(value.colorSpace)) {
    const [a, b, c] =
      value.colorSpace === 'hsl' || value.colorSpace === 'hwb'
        ? [parts[0], `${parts[1]}%`, `${parts[2]}%`].map((p) => (p === 'none%' ? 'none' : p))
        : parts
    return `${value.colorSpace}(${a} ${b} ${c}${slash})`
  }
  return `color(${value.colorSpace} ${parts.join(' ')}${slash})`
}

const formatUnit = (value: DimensionValue | DurationValue | string) =>
  typeof value === 'string' ? value : `${trim(value.value)}${value.unit}`

/**
 * A value as one line of text, for messages, reports and queries. Aliases stay as written.
 * Composite values read like their CSS shorthand.
 */
export function formatValue(value: TokenValue): string {
  if (typeof value !== 'object' || value === null) return String(value)
  if (Array.isArray(value)) {
    const list = value as unknown[]
    if (list.length === 4 && list.every((v) => typeof v === 'number'))
      return `cubic-bezier(${list.map((v) => trim(v as number)).join(', ')})`
    if (list.every((v) => typeof v === 'string'))
      return (list as string[]).map((v) => (/[\s,]/.test(v) ? `"${v}"` : v)).join(', ')
    return list.map((v) => formatValue(v as TokenValue)).join(', ')
  }
  const v = value as unknown as Json
  if (isRefObject(v)) return `$ref "${v.$ref}"`
  const sub = (key: string) => formatValue(v[key] as TokenValue)
  if ('colorSpace' in v) return formatColor(v as unknown as ColorValue)
  if ('unit' in v && 'value' in v) return formatUnit(v as unknown as DimensionValue)
  if ('offsetX' in v)
    return [
      v.inset === true ? 'inset' : '',
      sub('offsetX'),
      sub('offsetY'),
      sub('blur'),
      sub('spread'),
      sub('color'),
    ]
      .filter(Boolean)
      .join(' ')
  if ('position' in v) return `${sub('color')} ${trim(Number(v.position) * 100)}%`
  if ('fontFamily' in v && 'fontSize' in v)
    return `${sub('fontWeight')} ${sub('fontSize')}/${sub('lineHeight')} ${sub('fontFamily')}, letter-spacing ${sub('letterSpacing')}`
  if ('width' in v && 'style' in v) return `${sub('width')} ${sub('style')} ${sub('color')}`
  if ('timingFunction' in v) return `${sub('duration')} ${sub('timingFunction')} ${sub('delay')}`
  if ('dashArray' in v)
    return `dashed ${(v.dashArray as TokenValue[]).map((d) => formatValue(d)).join(' ')}, ${String(v.lineCap)} caps`
  return JSON.stringify(value)
}

/**
 * sRGB hex of a colour value: hex strings, sRGB objects, the `hex` of other objects, else the
 * object converted (and clipped) to sRGB. Null for anything that is not a colour.
 */
export function colorHex(value: unknown): string | null {
  if (typeof value === 'string') {
    const parsed = parseColor(value)
    return parsed.ok ? toHex(parsed.color) : null
  }
  if (isObject(value) && 'colorSpace' in value) {
    const color = value as unknown as ColorValue
    if (color.colorSpace === 'srgb' && color.components.every((c) => c !== 'none'))
      return formatColor(color)
    if (typeof color.hex === 'string' && (color.alpha ?? 1) === 1) return color.hex.toLowerCase()
    if (colorProblem(color) === null) return toHex(toSrgb(color).color)
  }
  return null
}

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (isObject(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    )
  return value
}

/**
 * Whether two values mean the same. Colours compare by sRGB hex where both have one
 * (`#3366FF` = `#3366ff` = the sRGB object), dimension and duration strings of the earlier
 * drafts equal their object form, everything else compares structurally.
 */
export function sameValue(a: TokenValue, b: TokenValue): boolean {
  if (a === b) return true
  const hexA = colorHex(a)
  if (hexA !== null && hexA === colorHex(b)) return true
  const unitOf = (value: TokenValue) => {
    if (typeof value === 'string') {
      const match = DIMENSION_TEXT.exec(value.trim()) ?? DURATION_TEXT.exec(value.trim())
      return match ? { value: Number(match[1]), unit: match[2] } : null
    }
    return isObject(value) && 'unit' in value && 'value' in value && !('colorSpace' in value)
      ? { value: Number(value.value), unit: String(value.unit) }
      : null
  }
  const unitA = unitOf(a)
  const unitB = unitOf(b)
  if (unitA && unitB) return unitA.value === unitB.value && unitA.unit === unitB.unit
  if (typeof a !== 'object' || typeof b !== 'object') return false
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}
