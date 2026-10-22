import { OUTPUT_FORMATS } from '@dta/build'
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
    formats: z
      .array(z.enum(OUTPUT_FORMATS))
      .min(1)
      .optional()
      .describe(
        'Which outputs `dta build` writes: `css`, `tailwind-v4`, `tailwind-v3`, `js` (default: all four). `dta init` writes it from your answer to "Which formats should dta generate?".',
      ),
    css: z
      .strictObject({
        outDir,
        /** Removed (TICKET-117): rejected with a message that says so instead of "unrecognized key". */
        prefix: z
          .never({
            error:
              'was removed: it never had an effect (CSS variable names always start with --). Delete this line.',
          })
          .optional()
          .describe('Removed; rejected. It never had an effect: delete the line.'),
      })
      .optional()
      .describe(
        'CSS custom properties: `variables.css`, `base.css` and one theme file per brand (default folder `output/css`).',
      ),
    tailwind: z
      .strictObject({
        outDir,
        /** Removed (TICKET-091): rejected with a message that says so instead of "unrecognized key". */
        version: z
          .never({
            error:
              "was removed: it never had an effect. `outputs.formats` chooses the Tailwind versions ('tailwind-v4', 'tailwind-v3'). Delete this line.",
          })
          .optional()
          .describe(
            'Removed; rejected. It never had an effect: `formats` chooses the Tailwind versions. Delete the line.',
          ),
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
    'What `dta build` writes and where. `formats` chooses the outputs (all by default); the other keys move them.',
  )

/**
 * The breakpoint collection (TICKET-091). The modes' order in `modes` is the order of the media
 * blocks in the CSS, so the user's queries decide mobile-first or desktop-first.
 */
const breakpoints = z
  .strictObject({
    collection: name.describe('The collection whose modes are breakpoints, e.g. `ScreenType`.'),
    default: name.describe(
      'The mode written on `:root` without a media query: the smallest screen for mobile-first queries (`min-width`), the largest for desktop-first (`max-width`).',
    ),
    modes: z
      .record(
        name,
        name
          .refine((query) => !/^\s*@media\b/i.test(query), {
            message: 'is the media query without "@media", e.g. (min-width: 1024px)',
          })
          .refine((query) => !/^\s*[[.#:&]/.test(query), {
            message:
              'must be a media query such as (min-width: 1024px); selectors are not supported',
          }),
      )
      .refine((modes) => Object.keys(modes).length > 0, { message: 'needs at least one mode' })
      .describe(
        "Every other mode and its media query, without `@media`: `{ Tablet: '(min-width: 768px)', Desktop: '(min-width: 1024px)' }`. The blocks are written in this order, so a later query wins where several match.",
      ),
  })
  .superRefine((value, context) => {
    if (Object.hasOwn(value.modes, value.default)) {
      context.addIssue({
        code: 'custom',
        message: `is the default mode, which is written on :root without a media query: remove it from modes`,
        path: ['modes', value.default],
      })
    }
  })
  .describe(
    'With this section, `dta build` writes the tokens of a breakpoint collection to `variables.css`: the default mode on `:root`, every other mode inside its media query, aliases as `var()` references. Without it, such a collection only resolves aliases.',
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
  breakpoints: breakpoints.optional(),
  tokens: z
    .strictObject({
      dir: name.default('tokens').describe('Folder of the token files.'),
      stripEmojis: z
        .boolean()
        .default(false)
        .describe('Strip emoji characters from collection and mode names in file names.'),
      resolver: name
        .optional()
        .describe(
          'The DTCG resolver document (`*.resolver.json`) in the tokens folder to read; default: the only one there.',
        ),
    })
    .prefault({})
    .describe('Where the token files live.'),
  modifiers: z
    .record(name, name)
    .optional()
    .describe(
      'For a DTCG resolver document: the context each modifier is read in by default, e.g. `{ theme: "light" }`.',
    ),
  outputs: outputs.optional(),
  lint: lint.optional().describe('`dta lint` rules (also run by `dta push`).'),
  diff: diffConfigSchema
    .optional()
    .describe('What `dta diff` builds and renders: the project build and its stories.'),
  audit: z
    .strictObject({
      paths: z
        .array(name)
        .optional()
        .describe('Files and folders `dta audit` scans when no paths are given (default `src`).'),
      ignore: z
        .array(name)
        .optional()
        .describe('Globs of files not to scan, relative to the project (`**/*.test.ts`).'),
      languages: z
        .array(z.enum(['css', 'scss', 'js', 'astro', 'vue', 'svelte', 'html']))
        .optional()
        .describe('Languages to scan (default: all). `js` covers JS, TS, JSX and TSX.'),
      near: z
        .boolean()
        .optional()
        .describe('Also report colours within about 2 % per channel of a token (like `--near`).'),
      baseline: name
        .default('.dta/audit-baseline.json')
        .describe('Accepted findings; `dta audit --update-baseline` writes it.'),
    })
    .optional()
    .describe('`dta audit`: where to look for hard-coded values that should be tokens.'),
  context: z
    .strictObject({
      out: name
        .default('DESIGN.md')
        .describe('Context file for coding agents, relative to the project.'),
    })
    .optional()
    .describe(
      'With this section, `dta build` also writes the context file for coding agents and the pointer in `AGENTS.md`, like `dta context`. Off by default.',
    ),
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
