/** A token's path inside its collection, e.g. `['Colors', 'Brand', 'Primary']`. */
export type TokenName = string[]

/**
 * The types of DTCG 2025.10 plus `string` and `boolean`, which Figma variables have and DTCG
 * does not.
 */
export type TokenType =
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'cubicBezier'
  | 'number'
  | 'strokeStyle'
  | 'border'
  | 'transition'
  | 'shadow'
  | 'gradient'
  | 'typography'
  | 'string'
  | 'boolean'

/** An alias, `{Group.Token}`: allowed for a whole value and for each part of a composite. */
export type Alias = string

export type ColorSpace =
  | 'srgb'
  | 'srgb-linear'
  | 'hsl'
  | 'hwb'
  | 'lab'
  | 'lch'
  | 'oklab'
  | 'oklch'
  | 'display-p3'
  | 'a98-rgb'
  | 'prophoto-rgb'
  | 'rec2020'
  | 'xyz-d65'
  | 'xyz-d50'

/** A DTCG 2025.10 colour. A hex string (`#3366ff`) is a valid colour value too. */
export interface ColorValue {
  colorSpace: ColorSpace
  components: (number | 'none')[]
  alpha?: number
  /** sRGB fallback, `#rrggbb`. */
  hex?: string
}

export interface DimensionValue {
  value: number
  unit: 'px' | 'rem'
}

export interface DurationValue {
  value: number
  unit: 'ms' | 's'
}

type Part<T> = T | Alias

export interface StrokeStyleObject {
  dashArray: Part<DimensionValue>[]
  lineCap: 'round' | 'butt' | 'square'
}

export interface BorderValue {
  color: Part<ColorValue | string>
  width: Part<DimensionValue>
  style: Part<string | StrokeStyleObject>
}

export interface TransitionValue {
  duration: Part<DurationValue>
  delay: Part<DurationValue>
  timingFunction: Part<number[]>
}

export interface ShadowObject {
  color: Part<ColorValue | string>
  offsetX: Part<DimensionValue>
  offsetY: Part<DimensionValue>
  blur: Part<DimensionValue>
  spread: Part<DimensionValue>
  inset?: boolean
}

export interface GradientStop {
  color: Part<ColorValue | string>
  position: Part<number>
}

export interface TypographyValue {
  fontFamily: Part<string | string[]>
  fontSize: Part<DimensionValue>
  fontWeight: Part<number | string>
  letterSpacing: Part<DimensionValue>
  lineHeight: Part<number>
}

/**
 * Raw value as written in the token file, never resolved: an alias is the string
 * `{Group.Token}`. Scalars cover `string`, `boolean`, `number`, hex colours, font names and
 * weight keywords and the `"4px"` / `"200ms"` strings of earlier DTCG drafts.
 */
export type TokenValue =
  | string
  | number
  | boolean
  | ColorValue
  | DimensionValue
  | DurationValue
  | string[]
  | number[]
  | StrokeStyleObject
  | BorderValue
  | TransitionValue
  | ShadowObject
  | Part<ShadowObject>[]
  | Part<GradientStop>[]
  | TypographyValue

export interface Token {
  name: TokenName
  type: TokenType
  /** One value per mode of the collection. A mode may be missing. */
  values: Record<string, TokenValue>
  description?: string
  /** `$deprecated`: `true`, or the explanation. Inherited from groups; `false` is left out. */
  deprecated?: true | string
  /**
   * For a token several resolver modifiers change: the sets' value and, per modifier in
   * resolution order, the value each context that changes the token gives. The build writes
   * CSS from it that combines the modifiers freely.
   */
  layers?: TokenLayers
  /** The `$extensions` object (including `com.figma`), kept as written. */
  extensions?: Record<string, unknown>
}

/**
 * The file a mode was read from. It lets `serializeTokenFiles` reproduce the original
 * content (key order, unknown fields, formatting). Treat it as opaque.
 */
export interface FileSource {
  fileName: string
  tree: Record<string, unknown>
  indent: string
  trailingNewline: boolean
}

export interface TokenLayers {
  /** The value the sets give, before any modifier; absent when no set defines the token. */
  base?: TokenValue
  axes: Array<{ axis: string; contexts: Record<string, TokenValue> }>
}

export interface Collection {
  name: string
  /** Mode names, sorted. */
  modes: string[]
  /**
   * The mode read when nothing selects one (a resolver modifier's `default`, or the context the
   * config names). Absent: the first mode.
   */
  defaultMode?: string
  /** A resolver modifier: its contexts are the modes, selected with `data-<modifier>` in CSS. */
  modifier?: boolean
  /**
   * A combination of resolver modifiers (`brand × theme`): each mode joins one context per
   * modifier (`b × dark`), and a selection by modifier name picks the mode.
   */
  axes?: string[]
  tokens: Token[]
  /** Opaque, by mode. Absent for modes that were created in memory. */
  sources: Record<string, FileSource>
}

export interface TokenModel {
  collections: Collection[]
}

export interface TokenFileInput {
  /** Base file name, `{Collection}.{Mode}.json`. */
  fileName: string
  content: string
}

export type DiagnosticSeverity = 'error' | 'warning'

/**
 * A page of DTA's documentation a diagnostic points to. Each surface renders it its own way:
 * the CLI prints the repository path (`DOC_PATHS`), the website links its own page.
 */
export type DocId = 'token-files' | 'lint-rules'

export interface Diagnostic {
  severity: DiagnosticSeverity
  /** Stable machine-readable code, e.g. `invalid-json`, `missing-type`. */
  code: string
  /** What is wrong, without the pointer to the docs (that is `docs`). */
  message: string
  file?: string
  /** Token path the problem is about. */
  path?: string[]
  /** The documentation that explains it; `formatDiagnostic` adds "See …". */
  docs?: DocId
}

export interface ParseResult {
  model: TokenModel
  diagnostics: Diagnostic[]
}
