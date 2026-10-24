const ALIAS_PATTERN = /^\{([^{}]+)\}$/

/**
 * Parses a DTCG alias reference like `{Colors.Foundation.Blue.700}` into its
 * path segments. Returns `null` for anything that is not a well-formed alias.
 */
export function parseAlias(value: unknown): string[] | null {
  if (typeof value !== 'string') return null

  const match = ALIAS_PATTERN.exec(value)
  if (!match) return null

  const segments = match[1].split('.')
  if (segments.some((segment) => segment.trim() === '')) return null

  return segments
}
