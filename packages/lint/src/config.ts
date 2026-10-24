import type { Diagnostic } from '@dta/core'
import * as z from 'zod'

const Severity = z
  .enum(['error', 'warn', 'off'])
  .describe('`error` fails `dta lint`, `warn` (the default) reports, `off` disables the rule.')

/** The case styles of `naming-case`. */
export const CASE_STYLES = ['kebab-case', 'camelCase', 'PascalCase', 'snake_case'] as const
export type CaseStyle = (typeof CASE_STYLES)[number]

const ruleSchemas = {
  'semantic-must-alias': z
    .strictObject({
      severity: Severity.optional(),
      collections: z
        .array(z.string())
        .optional()
        .describe('Collections whose tokens must all be aliases.'),
    })
    .describe(
      'Fails when a token in the listed collections holds a raw value instead of an alias.',
    ),
  'naming-pattern': z
    .strictObject({
      severity: Severity.optional(),
      patterns: z
        .record(z.string(), z.string())
        .optional()
        .describe('Collection name → regular expression every path segment must match.'),
    })
    .describe('Fails when a path segment does not match the pattern of its collection.'),
  'naming-case': z
    .strictObject({
      severity: Severity.optional(),
      collections: z
        .record(z.string(), z.enum(CASE_STYLES))
        .optional()
        .describe(
          'Collection name → the case every path segment uses: `kebab-case`, `camelCase`, `PascalCase` or `snake_case`. Scale steps (`700`, `0-5`, `1.5`, `2xl`) fit every style; `$root` is not checked.',
        ),
    })
    .describe('Fails when a path segment is not in the case style of its collection (TICKET-019).'),
  'naming-depth': z
    .strictObject({
      severity: Severity.optional(),
      collections: z
        .record(
          z.string(),
          z
            .strictObject({
              min: z.number().int().positive().optional(),
              max: z.number().int().positive().optional(),
            })
            .refine(
              (range) =>
                range.min === undefined || range.max === undefined || range.min <= range.max,
              {
                message: 'min must not be greater than max',
              },
            )
            .refine((range) => range.min !== undefined || range.max !== undefined, {
              message: 'needs min, max or both',
            }),
        )
        .optional()
        .describe('Collection name → `{ min, max }`: how many path segments a token name has.'),
    })
    .describe(
      'Fails when a token path has fewer or more segments than its collection allows (TICKET-019).',
    ),
  'no-spaces': z
    .strictObject({ severity: Severity.optional() })
    .describe(
      'Reports spaces in collection names and token path segments; some outputs and tools handle them badly (TICKET-019).',
    ),
  'collection-pattern': z
    .strictObject({
      severity: Severity.optional(),
      pattern: z
        .string()
        .optional()
        .describe(
          'Regular expression every collection name must match (not anchored: write `^…$` for the whole name).',
        ),
    })
    .describe('Fails when a collection name does not match the pattern (TICKET-019).'),
  'color-contrast': z
    .strictObject({
      severity: Severity.optional(),
      minRatio: z
        .number()
        .positive()
        .optional()
        .describe('Minimum WCAG contrast ratio (default 4.5, level AA).'),
      pairs: z
        .array(z.tuple([z.string(), z.string()]))
        .optional()
        .describe('`[foreground, background]` token names.'),
    })
    .describe('Checks the contrast of text and background pairs, per mode, through aliases.'),
  'no-duplicate-values': z
    .strictObject({ severity: Severity.optional() })
    .describe('Reports raw values that appear more than once, across all collections and modes.'),
}

/** The `lint` section of the project config. */
export const lintConfigSchema = z.strictObject({
  rules: z
    .strictObject(ruleSchemas)
    .partial()
    .optional()
    .describe(
      'Configurable rules by name, with their options. A configured rule is a warning unless its severity says otherwise.',
    ),
})

export type LintConfig = z.infer<typeof lintConfigSchema>
export type LintSeverity = z.infer<typeof Severity>
export type RuleName = keyof typeof ruleSchemas

/** Options of the rules that passed validation, by rule name. */
export type ValidRules = { [R in RuleName]?: z.infer<(typeof ruleSchemas)[R]> }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function problem(message: string): Diagnostic {
  return { severity: 'error', code: 'invalid-config', message: `Lint config: ${message}` }
}

/**
 * Validates the config rule by rule, so one bad rule does not stop the others. Never throws.
 */
export function readLintConfig(config: unknown): { rules: ValidRules; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = []
  const rules: ValidRules = {}
  if (config === undefined || config === null) return { rules, diagnostics }

  if (!isRecord(config)) {
    return { rules, diagnostics: [problem('expected an object with an optional "rules" key.')] }
  }
  for (const key of Object.keys(config)) {
    if (key !== 'rules') diagnostics.push(problem(`unknown option "${key}" (known: rules).`))
  }
  if (config.rules === undefined) return { rules, diagnostics }
  if (!isRecord(config.rules)) {
    diagnostics.push(problem('"rules" must be an object that maps rule names to their options.'))
    return { rules, diagnostics }
  }

  for (const [name, options] of Object.entries(config.rules)) {
    if (!(name in ruleSchemas)) {
      diagnostics.push(
        problem(`unknown rule "${name}" (known: ${Object.keys(ruleSchemas).join(', ')}).`),
      )
      continue
    }
    const ruleName = name as RuleName
    const parsed = ruleSchemas[ruleName].safeParse(options ?? {})
    if (parsed.success) {
      Object.assign(rules, { [ruleName]: parsed.data })
    } else {
      const issues = parsed.error.issues
        .map((issue) => `rules.${[name, ...issue.path].join('.')}: ${issue.message}`)
        .join('; ')
      diagnostics.push(problem(issues))
    }
  }
  return { rules, diagnostics }
}
