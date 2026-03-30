/**
 * TICKET-008: Project configuration schema.
 *
 * Defines the shape and validation logic for dta.config.ts files.
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

export interface OutputTargetDocs {
  outDir: string
}

export interface OutputTargets {
  css?: OutputTargetCSS
  tailwind?: OutputTargetTailwind
  ios?: OutputTargetIOS
  android?: OutputTargetAndroid
  docs?: OutputTargetDocs
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `collections` (string[]) instead. Kept for backward compatibility.
 */
export interface LayerMapping {
  primitives?: string
  brand?: string
  dimension?: string
}

// ---------------------------------------------------------------------------
// Figma connection
// ---------------------------------------------------------------------------

export interface FigmaConnection {
  fileKey?: string
  personalAccessToken?: string
  /** How tokens are sourced: 'api' (REST API, Enterprise only) or 'file' (plugin export) */
  source?: 'api' | 'file'
}

// ---------------------------------------------------------------------------
// Lint config
// ---------------------------------------------------------------------------

export type LintSeverity = 'error' | 'warn' | 'off'

export interface LintRuleSemanticMustAlias {
  severity?: LintSeverity
  /** Collection names whose tokens must all be aliases (no raw values). */
  collections?: string[]
}

export interface LintRuleNamingPattern {
  severity?: LintSeverity
  /** Map of collection name → regex pattern that token names must match. */
  patterns?: Record<string, string>
}

export interface LintRuleColorContrast {
  severity?: LintSeverity
  /** Minimum WCAG contrast ratio (default: 4.5 for AA). */
  minRatio?: number
  /** Pairs of token paths to check contrast between: [[foreground, background], ...] */
  pairs?: Array<[string, string]>
}

export interface LintRuleNoDuplicateValues {
  severity?: LintSeverity
}

export interface LintRules {
  'semantic-must-alias'?: LintRuleSemanticMustAlias
  'naming-pattern'?: LintRuleNamingPattern
  'color-contrast'?: LintRuleColorContrast
  'no-duplicate-values'?: LintRuleNoDuplicateValues
}

export interface LintConfig {
  rules?: LintRules
}

// ---------------------------------------------------------------------------
// Push config
// ---------------------------------------------------------------------------

export interface PushConfig {
  /**
   * Skip the typed confirmation prompt before pushing to Figma.
   * When false (default), users must type "push variables to figma" to confirm.
   * Set to true for CI pipelines or automation where interactive prompts are not possible.
   */
  skipConfirmation?: boolean
}

// ---------------------------------------------------------------------------
// Full config
// ---------------------------------------------------------------------------

export interface Config {
  figma: FigmaConnection
  /** Collection names to include in the build (auto-discovered or manually specified) */
  collections?: string[]
  /**
   * @deprecated Use `collections` instead. Kept for backward compatibility.
   * If both `layers` and `collections` are set, `collections` takes precedence.
   */
  layers?: LayerMapping
  brands?: string[]
  tokens?: {
    dir: string
    /** Strip emoji characters from collection/mode names in filenames (default: false) */
    stripEmojis?: boolean
  }
  outputs?: OutputTargets
  lint?: LintConfig
  push?: PushConfig
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

  // figma (required object, but individual fields are optional for file-based import)
  const figmaRaw = requireObject(obj.figma, 'figma')
  const source = figmaRaw.source as FigmaConnection['source']
  if (source !== undefined && source !== 'api' && source !== 'file') {
    throw new ConfigValidationError('figma.source', "must be 'api' or 'file'")
  }
  const figma: FigmaConnection = {
    fileKey: optionalString(figmaRaw.fileKey, 'figma.fileKey'),
    personalAccessToken: optionalString(figmaRaw.personalAccessToken, 'figma.personalAccessToken'),
    source,
  }

  // collections (optional — replaces layers)
  let collections: string[] | undefined
  if (obj.collections !== undefined) {
    if (!Array.isArray(obj.collections)) {
      throw new ConfigValidationError('collections', 'must be an array of strings')
    }
    collections = obj.collections.map((c: unknown, i: number) =>
      requireString(c, `collections[${i}]`),
    )
  }

  // layers (optional, deprecated — kept for backward compatibility)
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
  const tokens: Config['tokens'] = {
    dir:
      typeof tokensRaw.dir === 'string' && tokensRaw.dir.length > 0
        ? tokensRaw.dir
        : DEFAULT_TOKENS_DIR,
    stripEmojis: tokensRaw.stripEmojis === true,
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

    if (outputsRaw.docs !== undefined) {
      const docsRaw = requireObject(outputsRaw.docs, 'outputs.docs')
      outputs.docs = {
        outDir: requireString(docsRaw.outDir, 'outputs.docs.outDir'),
      }
    }
  }

  // lint (optional)
  let lint: LintConfig | undefined
  if (obj.lint !== undefined) {
    const lintRaw = requireObject(obj.lint, 'lint')
    lint = {}

    if (lintRaw.rules !== undefined) {
      const rulesRaw = requireObject(lintRaw.rules, 'lint.rules')
      const rules: LintRules = {}

      const validSeverities: LintSeverity[] = ['error', 'warn', 'off']
      function validateSeverity(value: unknown, field: string): LintSeverity | undefined {
        if (value === undefined) return undefined
        if (typeof value !== 'string' || !validSeverities.includes(value as LintSeverity)) {
          throw new ConfigValidationError(field, "must be 'error', 'warn', or 'off'")
        }
        return value as LintSeverity
      }

      if (rulesRaw['semantic-must-alias'] !== undefined) {
        const ruleRaw = requireObject(
          rulesRaw['semantic-must-alias'],
          'lint.rules.semantic-must-alias',
        )
        const ruleCollections = ruleRaw.collections
        if (ruleCollections !== undefined && !Array.isArray(ruleCollections)) {
          throw new ConfigValidationError(
            'lint.rules.semantic-must-alias.collections',
            'must be an array of strings',
          )
        }
        rules['semantic-must-alias'] = {
          severity: validateSeverity(ruleRaw.severity, 'lint.rules.semantic-must-alias.severity'),
          collections: ruleCollections as string[] | undefined,
        }
      }

      if (rulesRaw['naming-pattern'] !== undefined) {
        const ruleRaw = requireObject(rulesRaw['naming-pattern'], 'lint.rules.naming-pattern')
        if (ruleRaw.patterns !== undefined) {
          const patternsRaw = requireObject(ruleRaw.patterns, 'lint.rules.naming-pattern.patterns')
          // Validate each pattern is a valid regex
          for (const [key, val] of Object.entries(patternsRaw)) {
            if (typeof val !== 'string') {
              throw new ConfigValidationError(
                `lint.rules.naming-pattern.patterns.${key}`,
                'must be a regex string',
              )
            }
            try {
              new RegExp(val as string)
            } catch {
              throw new ConfigValidationError(
                `lint.rules.naming-pattern.patterns.${key}`,
                'must be a valid regex',
              )
            }
          }
        }
        rules['naming-pattern'] = {
          severity: validateSeverity(ruleRaw.severity, 'lint.rules.naming-pattern.severity'),
          patterns: ruleRaw.patterns as Record<string, string> | undefined,
        }
      }

      if (rulesRaw['color-contrast'] !== undefined) {
        const ruleRaw = requireObject(rulesRaw['color-contrast'], 'lint.rules.color-contrast')
        if (ruleRaw.minRatio !== undefined && typeof ruleRaw.minRatio !== 'number') {
          throw new ConfigValidationError('lint.rules.color-contrast.minRatio', 'must be a number')
        }
        if (ruleRaw.pairs !== undefined && !Array.isArray(ruleRaw.pairs)) {
          throw new ConfigValidationError(
            'lint.rules.color-contrast.pairs',
            'must be an array of [foreground, background] pairs',
          )
        }
        rules['color-contrast'] = {
          severity: validateSeverity(ruleRaw.severity, 'lint.rules.color-contrast.severity'),
          minRatio: ruleRaw.minRatio as number | undefined,
          pairs: ruleRaw.pairs as Array<[string, string]> | undefined,
        }
      }

      if (rulesRaw['no-duplicate-values'] !== undefined) {
        const ruleRaw = requireObject(
          rulesRaw['no-duplicate-values'],
          'lint.rules.no-duplicate-values',
        )
        rules['no-duplicate-values'] = {
          severity: validateSeverity(ruleRaw.severity, 'lint.rules.no-duplicate-values.severity'),
        }
      }

      lint.rules = rules
    }
  }

  // push (optional)
  let push: PushConfig | undefined
  if (obj.push !== undefined) {
    const pushRaw = requireObject(obj.push, 'push')
    push = {}
    if (pushRaw.skipConfirmation !== undefined) {
      if (typeof pushRaw.skipConfirmation !== 'boolean') {
        throw new ConfigValidationError('push.skipConfirmation', 'must be a boolean')
      }
      push.skipConfirmation = pushRaw.skipConfirmation
    }
  }

  return { figma, collections, layers, brands, tokens, outputs, lint, push }
}

// ---------------------------------------------------------------------------
// defineConfig helper — provides autocompletion in consuming projects
// ---------------------------------------------------------------------------

export function defineConfig(config: Config): Config {
  return config
}
