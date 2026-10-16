import type { Diagnostic } from '@dta/core'

export const hasErrors = (diagnostics: readonly Diagnostic[]): boolean =>
  diagnostics.some((diagnostic) => diagnostic.severity === 'error')

/** One printable line per diagnostic: `error [code] message (file)`. */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  const where = diagnostic.file ? ` (${diagnostic.file})` : ''
  return `${diagnostic.severity} [${diagnostic.code}] ${diagnostic.message}${where}`
}
