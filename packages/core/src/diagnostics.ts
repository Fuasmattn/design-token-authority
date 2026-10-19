import type { Diagnostic, DocId } from './types.js'

export const hasErrors = (diagnostics: readonly Diagnostic[]): boolean =>
  diagnostics.some((diagnostic) => diagnostic.severity === 'error')

/**
 * Where each documentation page a diagnostic can point to lives in the repository: what the CLI
 * prints after "See". The website renders the same ids as links to its own pages instead.
 */
export const DOC_PATHS: Readonly<Record<DocId, string>> = {
  'token-files': 'docs/token-files/input-format.md',
}

export interface FormatDiagnosticOptions {
  /**
   * Add the pointer to the docs (`See docs/….md.`) when the diagnostic has one. Default true (the
   * CLI); false where the pointer is shown another way (the website's link).
   */
  docs?: boolean
}

/**
 * One printable line per diagnostic: `error [code] message See docs/….md. (file)`. The CLI
 * prints this, and the playground shows the same line, so both read the same.
 */
export function formatDiagnostic(
  diagnostic: Diagnostic,
  options: FormatDiagnosticOptions = {},
): string {
  const see = diagnostic.docs && options.docs !== false ? ` See ${DOC_PATHS[diagnostic.docs]}.` : ''
  const where = diagnostic.file ? ` (${diagnostic.file})` : ''
  return `${diagnostic.severity} [${diagnostic.code}] ${diagnostic.message}${see}${where}`
}
