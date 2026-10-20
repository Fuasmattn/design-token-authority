/**
 * Where the website shows the documentation a diagnostic points to (TICKET-114). Diagnostics
 * carry a doc id (`Diagnostic.docs` in @dta/core); the CLI prints the repository path for it
 * (`DOC_PATHS`, "See docs/….md."), the website links its own page instead. The wording of the
 * diagnostic stays shared: the site formats it without the pointer and adds the link.
 */
import type { DocId } from '@dta/core'

export interface DocLink {
  /** The page on this site. */
  href: string
  /** The link's text, after "See the". */
  label: string
}

export const DOC_LINKS: Readonly<Record<DocId, DocLink>> = {
  'token-files': { href: '/reference/token-files/', label: 'Token files reference' },
  'lint-rules': { href: '/reference/lint-rules/', label: 'Lint rules reference' },
}
