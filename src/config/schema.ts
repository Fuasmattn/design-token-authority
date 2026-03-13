/**
 * TICKET-008: Project configuration schema.
 *
 * Defines the shape and validation logic for figma-tokens.config.ts files.
 *
 * NOTE: The ticket specifies Zod for validation, but it could not be installed
 * as a dependency at the time of implementation (registry unavailable).
 * This module uses plain TypeScript validation with the same error semantics.
 * It can be migrated to Zod later by replacing the validate* functions with
 * z.object(...).parse() calls — the Config type itself stays the same.
 */

// ---------------------------------------------------------------------------
// Output target types
// ---------------------------------------------------------------------------

export interface OutputTargetCSS {
  outDir: string
  prefix?: string
}

export interface OutputTargetTailwind {
  outDir: string
  version?: 3 | 4
}

export interface OutputTargetIOS {
  outDir: string
  lang?: 'swift'
}

export interface OutputTargetAndroid {
  outDir: string
  lang?: 'xml' | 'compose'
}

export interface OutputTargets {
  css?: OutputTargetCSS
  tailwind?: OutputTargetTailwind
  ios?: OutputTargetIOS
  android?: OutputTargetAndroid
}

// ---------------------------------------------------------------------------
// Layer mapping
// ---------------------------------------------------------------------------

export interface LayerMapping {
  /** Figma collection name for raw primitive values */
  primitives?: string
  /** Figma collection name for semantic brand aliases */
  brand?: string
  /** Figma collection name for responsive/dimension overrides */
  dimension?: string
}

// ---------------------------------------------------------------------------
// Figma connection
// ---------------------------------------------------------------------------

export interface FigmaConnection {
  fileKey: string
  personalAccessToken: string
}

// ---------------------------------------------------------------------------
// Full config
// ---------------------------------------------------------------------------

export interface Config {
  figma: FigmaConnection
  layers?: LayerMapping
  brands?: string[]
  tokens?: { dir: string }
  outputs?: OutputTargets
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TOKENS_DIR = 'tokens'
const DEFAULT_CSS_PREFIX = '--'
const DEFAULT_TAILWIND_VERSION = 4
const DEFAULT_IOS_LANG = 'swift' as const
const DEFAULT_ANDROID_LANG = 'xml' as const

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export class ConfigValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(`Config validation error at "${field}": ${message}`)
    this.name = 'ConfigValidationError'
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ConfigValidationError(field, 'must be a non-empty string')
  }
  return value
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  return requireString(value, field)
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigValidationError(field, 'must be an object')
  }
  return value as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Validate + apply defaults
// ---------------------------------------------------------------------------

export function validateConfig(raw: unknown): Config {
  const obj = requireObject(raw, 'config')

  // figma (required)
  const figmaRaw = requireObject(obj.figma, 'figma')
  const figma: FigmaConnection = {
    fileKey: requireString(figmaRaw.fileKey, 'figma.fileKey'),
    personalAccessToken: requireString(figmaRaw.personalAccessToken, 'figma.personalAccessToken'),
  }

  // layers (optional)
  let layers: LayerMapping | undefined
  if (obj.layers !== undefined) {
    const layersRaw = requireObject(obj.layers, 'layers')
    layers = {
      primitives: optionalString(layersRaw.primitives, 'layers.primitives'),
      brand: optionalString(layersRaw.brand, 'layers.brand'),
      dimension: optionalString(layersRaw.dimension, 'layers.dimension'),
    }
  }

  // brands (optional)
  let brands: string[] | undefined
  if (obj.brands !== undefined) {
    if (!Array.isArray(obj.brands)) {
      throw new ConfigValidationError('brands', 'must be an array of strings')
    }
    brands = obj.brands.map((b: unknown, i: number) => requireString(b, `brands[${i}]`))
  }

  // tokens (optional, defaults applied)
  const tokensRaw = obj.tokens !== undefined ? requireObject(obj.tokens, 'tokens') : {}
  const tokens = {
    dir:
      typeof tokensRaw.dir === 'string' && tokensRaw.dir.length > 0
        ? tokensRaw.dir
        : DEFAULT_TOKENS_DIR,
  }

  // outputs (optional)
  let outputs: OutputTargets | undefined
  if (obj.outputs !== undefined) {
    const outputsRaw = requireObject(obj.outputs, 'outputs')
    outputs = {}

    if (outputsRaw.css !== undefined) {
      const cssRaw = requireObject(outputsRaw.css, 'outputs.css')
      outputs.css = {
        outDir: requireString(cssRaw.outDir, 'outputs.css.outDir'),
        prefix: typeof cssRaw.prefix === 'string' ? cssRaw.prefix : DEFAULT_CSS_PREFIX,
      }
    }

    if (outputsRaw.tailwind !== undefined) {
      const twRaw = requireObject(outputsRaw.tailwind, 'outputs.tailwind')
      const version = twRaw.version !== undefined ? twRaw.version : DEFAULT_TAILWIND_VERSION
      if (version !== 3 && version !== 4) {
        throw new ConfigValidationError('outputs.tailwind.version', 'must be 3 or 4')
      }
      outputs.tailwind = {
        outDir: requireString(twRaw.outDir, 'outputs.tailwind.outDir'),
        version: version as 3 | 4,
      }
    }

    if (outputsRaw.ios !== undefined) {
      const iosRaw = requireObject(outputsRaw.ios, 'outputs.ios')
      const lang = iosRaw.lang !== undefined ? iosRaw.lang : DEFAULT_IOS_LANG
      if (lang !== 'swift') {
        throw new ConfigValidationError('outputs.ios.lang', "must be 'swift'")
      }
      outputs.ios = {
        outDir: requireString(iosRaw.outDir, 'outputs.ios.outDir'),
        lang,
      }
    }

    if (outputsRaw.android !== undefined) {
      const androidRaw = requireObject(outputsRaw.android, 'outputs.android')
      const lang = androidRaw.lang !== undefined ? androidRaw.lang : DEFAULT_ANDROID_LANG
      if (lang !== 'xml' && lang !== 'compose') {
        throw new ConfigValidationError('outputs.android.lang', "must be 'xml' or 'compose'")
      }
      outputs.android = {
        outDir: requireString(androidRaw.outDir, 'outputs.android.outDir'),
        lang,
      }
    }
  }

  return { figma, layers, brands, tokens, outputs }
}

// ---------------------------------------------------------------------------
// defineConfig helper — provides autocompletion in consuming projects
// ---------------------------------------------------------------------------

export function defineConfig(config: Config): Config {
  return config
}
