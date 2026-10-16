import { lintConfigSchema } from '@dta/lint'
import { z } from 'zod'

const name = z.string().min(1)

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
  /** Removed in v2 (TICKET-067): rejected with a message that says so instead of "unrecognized key". */
  docs: z
    .never({
      error: 'was removed in v2: DTA no longer generates a token docs page. Delete this key.',
    })
    .optional(),
})

/** The lint section is the schema of `@dta/lint`; a bad regular expression is rejected early. */
const lint = lintConfigSchema.superRefine((value, context) => {
  for (const [collection, pattern] of Object.entries(
    value.rules?.['naming-pattern']?.patterns ?? {},
  )) {
    try {
      new RegExp(pattern)
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'must be a valid regular expression',
        path: ['rules', 'naming-pattern', 'patterns', collection],
      })
    }
  }
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
  lint: lint.optional(),
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
