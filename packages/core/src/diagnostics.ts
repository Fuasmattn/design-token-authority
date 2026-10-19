import type { Diagnostic } from './types.js'

export const hasErrors = (diagnostics: readonly Diagnostic[]): boolean =>
  diagnostics.some((diagnostic) => diagnostic.severity === 'error')

/**
 * One printable line per diagnostic: `error [code] message (file)`. The CLI prints this, and
 * the playground shows the same line, so both read the same.
 */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  const where = diagnostic.file ? ` (${diagnostic.file})` : ''
  return `${diagnostic.severity} [${diagnostic.code}] ${diagnostic.message}${where}`
}
