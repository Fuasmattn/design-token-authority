import type { LintResult, LintViolation } from './types.js'

/**
 * The wording of a lint report, shared by `dta lint` and the playground so both say the same.
 * Plain text: the CLI adds its colours around these pieces.
 */
export const LINT_MESSAGES = {
  clean: 'No lint violations found.',
  passedWithWarnings: 'Lint passed with warnings.',
  failed: 'Lint failed.',
  /** Heading for violations that span files (their `file` is empty). */
  unknownFile: '(unknown file)',
  /** Count of a rule without violations. */
  noFindings: 'no findings',
} as const

/**
 * The rules `lintTokens` always runs, without a config (the defaults a project without a `lint`
 * section gets). The configurable rules join them through `dta.config.ts`.
 */
export const BUILT_IN_RULES = [
  'no-dangling-aliases',
  'no-circular-aliases',
  'no-default-mode-names',
] as const

/** Violations by file, in the order they were found. */
export function groupViolationsByFile(
  violations: readonly LintViolation[],
): Array<[file: string, violations: LintViolation[]]> {
  const byFile = new Map<string, LintViolation[]>()
  for (const violation of violations) {
    const key = violation.file || LINT_MESSAGES.unknownFile
    byFile.set(key, [...(byFile.get(key) ?? []), violation])
  }
  return [...byFile]
}

/**
 * Violations by rule: the given rules first, in their order and also when nothing violates them,
 * then any other rule in the order found.
 */
export function groupViolationsByRule(
  violations: readonly LintViolation[],
  rules: readonly string[] = BUILT_IN_RULES,
): Array<[rule: string, violations: LintViolation[]]> {
  const byRule = new Map<string, LintViolation[]>(rules.map((rule) => [rule, []]))
  for (const violation of violations) {
    byRule.set(violation.rule, [...(byRule.get(violation.rule) ?? []), violation])
  }
  return [...byRule]
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** The counts of the summary line, errors first: `1 error`, `8 warnings` (none when zero). */
export function lintCounts(
  result: Pick<LintResult, 'errorCount' | 'warningCount'>,
): Array<{ severity: LintViolation['severity']; text: string }> {
  const counts: Array<{ severity: LintViolation['severity']; text: string }> = []
  if (result.errorCount > 0)
    counts.push({ severity: 'error', text: plural(result.errorCount, 'error') })
  if (result.warningCount > 0) {
    counts.push({ severity: 'warn', text: plural(result.warningCount, 'warning') })
  }
  return counts
}

/** The summary line: `1 error, 8 warnings found.`, or the clean message. */
export function formatLintSummary(result: Pick<LintResult, 'errorCount' | 'warningCount'>): string {
  const counts = lintCounts(result)
  return counts.length === 0
    ? LINT_MESSAGES.clean
    : `${counts.map((count) => count.text).join(', ')} found.`
}

/** The count of one rule's violations, errors first: `1 error, 2 warnings`, or `no findings`. */
export function formatRuleCount(violations: readonly LintViolation[]): string {
  const counts = lintCounts({
    errorCount: violations.filter((violation) => violation.severity === 'error').length,
    warningCount: violations.filter((violation) => violation.severity === 'warn').length,
  })
  return counts.length === 0 ? LINT_MESSAGES.noFindings : counts.map((c) => c.text).join(', ')
}
