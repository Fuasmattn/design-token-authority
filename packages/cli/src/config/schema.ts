import { z } from 'zod'

const name = z.string().min(1)

const regex = z.string().refine(
  (value) => {
    try {
      new RegExp(value)
      return true
    } catch {
      return false
    }
  },
  { error: 'must be a valid regular expression' },
)

const severity = z.enum(['error', 'warn', 'off'])

const figma = z.strictObject({
  fileKey: name.optional(),
  personalAccessToken: name.optional(),
  /** How tokens are sourced: 'api' (REST API, Enterprise only) or 'file' (plugin export). */
  source: z.enum(['api', 'file']).optional(),
})

const outputs = z.strictObject({
  css: z.strictObject({ outDir: name, prefix: z.string().default('--') }).optional(),
  tailwind: z.strictObject({ outDir: name, version: z.literal([3, 4]).default(4) }).optional(),
  ios: z.strictObject({ outDir: name, lang: z.literal('swift').default('swift') }).optional(),
  android: z
    .strictObject({ outDir: name, lang: z.enum(['xml', 'compose']).default('xml') })
    .optional(),
  docs: z.strictObject({ outDir: name }).optional(),
})

const lintRules = z.strictObject({
  'semantic-must-alias': z
    .strictObject({ severity: severity.optional(), collections: z.array(name).optional() })
    .optional(),
  'naming-pattern': z
    .strictObject({
      severity: severity.optional(),
      /** Collection name -> regex that token names must match. */
      patterns: z.record(z.string(), regex).optional(),
    })
    .optional(),
  'color-contrast': z
    .strictObject({
      severity: severity.optional(),
      minRatio: z.number().positive().optional(),
      /** [foreground, background] token paths. */
      pairs: z.array(z.tuple([name, name])).optional(),
    })
    .optional(),
  'no-duplicate-values': z.strictObject({ severity: severity.optional() }).optional(),
})

/** The shape of `dta.config.*`. Unknown keys are rejected so typos do not pass silently. */
export const configSchema = z.strictObject({
  figma: figma.prefault({}),
  /** Collection names to include in the build (auto-discovered when omitted). */
  collections: z.array(name).optional(),
  /** @deprecated Use `collections`. Kept so v1 configs still load. */
  layers: z
    .strictObject({
      primitives: name.optional(),
      brand: name.optional(),
      dimension: name.optional(),
    })
    .optional(),
  brands: z.array(name).optional(),
  tokens: z
    .strictObject({
      dir: name.default('tokens'),
      /** Strip emoji characters from collection and mode names in file names. */
      stripEmojis: z.boolean().default(false),
    })
    .prefault({}),
  outputs: outputs.optional(),
  lint: z.strictObject({ rules: lintRules.optional() }).optional(),
  push: z
    .strictObject({
      /** Skip the typed confirmation before pushing to Figma (CI, automation). */
      skipConfirmation: z.boolean().optional(),
    })
    .optional(),
})

/** What a user may write in a config file (defaults not yet applied). */
export type ConfigInput = z.input<typeof configSchema>

/** A validated config with defaults applied. */
export type Config = z.output<typeof configSchema>
