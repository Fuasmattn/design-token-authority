export interface LintViolation {
  rule: string
  severity: 'error' | 'warn'
  /** Graph id of the token (`Collection.Mode/Group/Token`), or `Collection.Mode` for a file. */
  tokenPath: string
  /** `Collection.Mode.json`; empty for problems that span files. */
  file: string
  message: string
}

export interface LintResult {
  violations: LintViolation[]
  errorCount: number
  warningCount: number
  /** Problems with the lint configuration itself. */
  diagnostics: import('@dta/core').Diagnostic[]
}
