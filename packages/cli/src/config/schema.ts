import { lintConfigSchema } from '@dta/lint'
import { diffConfigSchema } from '@dta/visual-diff'
import { z } from 'zod'

// The descriptions are the config reference on the website: it is generated from the JSON
// Schema of this schema (configJsonSchema), so describe every key a user can write.

const name = z.string().min(1)

const figma = z
  .strictObject({
    fileKey: name
      .optional()
      .describe('Key of the Figma file (from its URL: figma.com/file/<key>/…).'),
    personalAccessToken: name
      .optional()
      .describe(
        'Figma personal access token. Prefer the FIGMA_PERSONAL_ACCESS_TOKEN environment variable.',
      ),
    source: z
      .enum(['api', 'file'])
      .optional()
      .describe(
        'How tokens are sourced: `api` (REST API, Enterprise plans only) or `file` (an exported file, `dta pull --from-file`).',
      ),
  })
  .describe('Where `dta pull` and `dta push` find the Figma file.')

const outDir = name.describe('Folder the files are written to, relative to the project.')

const outputs = z
  .strictObject({
    css: z
      .strictObject({
        outDir,
        prefix: z.string().default('--').describe('Accepted, not used yet.'),
      })
      .optional()
      .describe(
        'CSS custom properties: `variables.css`, `base.css` and one theme file per brand (default folder `output/css`).',
      ),
    tailwind: z
      .strictObject({
        outDir,
        version: z
          .literal([3, 4])
          .default(4)
          .describe('Accepted, not used yet: every build writes both Tailwind versions.'),
      })
      .optional()
      .describe('Tailwind theme files (default folder `output/tailwind`).'),
    ios: z
      .strictObject({
        outDir,
        lang: z.literal('swift').default('swift').describe('Target language.'),
      })
      .optional()
      .describe('Accepted and cleaned by `dta clean`; `dta build` writes no Swift files yet.'),
    android: z
      .strictObject({
        outDir,
        lang: z.enum(['xml', 'compose']).default('xml').describe('Target language.'),
      })
      .optional()
      .describe(
        'Accepted and cleaned by `dta clean`; `dta build` writes no XML or Compose files yet.',
      ),
    /** Removed in v2 (TICKET-067): rejected with a message that says so instead of "unrecognized key". */
    docs: z
      .never({
        error: 'was removed in v2: DTA no longer generates a token docs page. Delete this key.',
      })
      .optional()
      .describe('Removed in v2; rejected.'),
  })
  .describe(
    'Where `dta build` writes. CSS, JavaScript and Tailwind files are always written; these keys move them.',
  )

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
  $schema: z
    .string()
    .optional()
    .describe('URL of this JSON Schema, for editor support in `dta.config.json`. Ignored by DTA.'),
  figma: figma.prefault({}),
  collections: z.array(name).optional().describe('Collections to include (default: all of them).'),
  /** @deprecated Use `collections`. Kept so v1 configs still load. */
  layers: z
    .strictObject({
      primitives: name.optional().describe('Deprecated.'),
      brand: name.optional().describe('Deprecated.'),
      dimension: name.optional().describe('Deprecated.'),
    })
    .optional()
    .describe('Deprecated: use `collections`. Kept so v1 configs still load.'),
  brands: z
    .array(name)
    .optional()
    .describe(
      'Modes to build into one theme file each (brands, or themes such as Light and Dark).',
    ),
  tokens: z
    .strictObject({
      dir: name.default('tokens').describe('Folder of the token files.'),
      stripEmojis: z
        .boolean()
        .default(false)
        .describe('Strip emoji characters from collection and mode names in file names.'),
    })
    .prefault({})
    .describe('Where the token files live.'),
  outputs: outputs.optional(),
  lint: lint.optional().describe('`dta lint` rules (also run by `dta push`).'),
  diff: diffConfigSchema
    .optional()
    .describe('What `dta diff` builds and renders: the project build and its stories.'),
  push: z
    .strictObject({
      skipConfirmation: z
        .boolean()
        .optional()
        .describe('Skip the typed confirmation before pushing to Figma (CI, automation).'),
    })
    .optional()
    .describe('`dta push` settings.'),
})

/** What a user may write in a config file (defaults not yet applied). */
export type ConfigInput = z.input<typeof configSchema>

/** A validated config with defaults applied. */
export type Config = z.output<typeof configSchema>

/**
 * The config as a JSON Schema (draft 2020-12), describing what a user may write (defaults not
 * applied). Used for editor support and for the config reference on the website.
 */
export function configJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(configSchema, {
    target: 'draft-2020-12',
    io: 'input',
    unrepresentable: 'throw',
  }) as Record<string, unknown>
}
