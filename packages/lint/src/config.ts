import type { Diagnostic } from '@dta/core'
import { z } from 'zod'

const Severity = z.enum(['error', 'warn', 'off'])

const ruleSchemas = {
  'semantic-must-alias': z.strictObject({
    severity: Severity.optional(),
    /** Collections whose tokens must all be aliases. */
    collections: z.array(z.string()).optional(),
  }),
  'naming-pattern': z.strictObject({
    severity: Severity.optional(),
    /** Collection name → regular expression every path segment must match. */
    patterns: z.record(z.string(), z.string()).optional(),
  }),
  'color-contrast': z.strictObject({
    severity: Severity.optional(),
    /** Minimum WCAG contrast ratio (default 4.5, level AA). */
    minRatio: z.number().positive().optional(),
    /** `[foreground, background]` token names. */
    pairs: z.array(z.tuple([z.string(), z.string()])).optional(),
  }),
  'no-duplicate-values': z.strictObject({ severity: Severity.optional() }),
}

/** The `lint` section of the project config. */
export const lintConfigSchema = z.strictObject({
  rules: z.strictObject(ruleSchemas).optional(),
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
