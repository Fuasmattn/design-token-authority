/**
 * Style Dictionary formatter: Tailwind v4 @theme CSS output (TICKET-010)
 *
 * Generates a `tailwind.css` file with a Tailwind v4 `@theme {}` block.
 * Tailwind v4 reads CSS custom properties under `@theme` at build time to
 * create its utility classes.
 *
 * Color tokens reference the existing CSS custom properties (`var(--...)`) so
 * that a single Tailwind config works with runtime brand switching. All other
 * token categories use their transformed values directly.
 *
 * Mapping strategy (in priority order):
 *   1. Path-based: well-known path prefixes (Colors/*, Dimensions/spacing/*, etc.)
 *   2. Type+scope: $type and Figma scopes determine the Tailwind namespace
 *   3. Fallback: unmapped tokens use --{full-path} (available as CSS vars)
 *
 * Consuming project:
 *   @import './build/tailwind/tailwind.css';
 */

import type { FormatFn } from 'style-dictionary/types'

/**
 * Sanitize a path segment for use in a CSS custom property name.
 * Mirrors the segment normalization in the name/kebab-deduped transform.
 */
function toKebab(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Maps a token path to a [cssPropertyPrefix, keyStartIndex] pair.
 * Returns null for paths that don't map to a known Tailwind v4 @theme property.
 */
function getPropertyPrefixByPath(path: string[]): [string, number] | null {
  const [top, sub] = path
  switch (top) {
    case 'Colors':
      return ['--color-', 1]
    case 'Dimensions':
      if (sub === 'spacing') return ['--spacing-', 2]
      if (sub === 'breakpoints') return ['--breakpoint-', 2]
      return null
    case 'Borders':
      if (sub === 'border-radius') return ['--radius-', 2]
      if (sub === 'border-width') return ['--border-width-', 2]
      return null
    case 'Effects':
      if (sub === 'opacity') return ['--opacity-', 2]
      if (sub === 'blur') return ['--blur-', 2]
      return null
    case 'Typography':
      if (sub === 'font-family') return ['--font-', 2]
      if (sub === 'font-size') return ['--font-size-', 2]
      if (sub === 'font-weight') return ['--font-weight-', 2]
      if (sub === 'line-height') return ['--leading-', 2]
      return null
    default:
      return null
  }
}

/**
 * Determine the Tailwind v4 CSS property prefix from token $type and Figma scopes.
 * Returns [prefix, category] or null if the token can't be mapped.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPropertyPrefixByType(token: any): [string, string] | null {
  const type: string = token.$type ?? token.type
  const scopes: string[] = token.$extensions?.['com.figma']?.scopes ?? []

  if (type === 'color') return ['--color-', 'color']

  if (type === 'number') {
    if (scopes.includes('FONT_SIZE')) return ['--font-size-', 'font-size']
    if (scopes.includes('FONT_WEIGHT')) return ['--font-weight-', 'font-weight']
    if (scopes.includes('LINE_HEIGHT')) return ['--leading-', 'leading']
    if (scopes.includes('OPACITY')) return ['--opacity-', 'opacity']
    if (scopes.includes('CORNER_RADIUS')) return ['--radius-', 'radius']
    if (scopes.includes('GAP') || scopes.includes('WIDTH_HEIGHT')) return ['--spacing-', 'spacing']
    if (scopes.includes('STROKE_FLOAT')) return ['--border-width-', 'border-width']
    if (scopes.includes('EFFECT_FLOAT')) return ['--blur-', 'blur']
    return null
  }

  if (type === 'string') {
    if (scopes.includes('FONT_FAMILY')) return ['--font-', 'font']
    return null
  }

  return null
}

export const tailwindV4Formatter: FormatFn = ({ dictionary, options }) => {
  const lines: string[] = []

  for (const token of dictionary.allTokens) {
    // 1. Try path-based mapping (well-known structures)
    const pathResult = getPropertyPrefixByPath(token.path)

    let property: string
    let isColor = false

    if (pathResult) {
      const [prefix, keyStart] = pathResult
      const suffix = token.path.slice(keyStart).map(toKebab).join('-')
      property = `${prefix}${suffix}`
      isColor = prefix === '--color-'
    } else {
      // 2. Try type+scope-based mapping
      const typeResult = getPropertyPrefixByType(token)
      if (typeResult) {
        const [prefix, category] = typeResult
        const fullKey = token.path.map(toKebab).join('-')
        property = `${prefix}${fullKey}`
        isColor = category === 'color'
      } else {
        // 3. Fallback: generic custom property (no Tailwind utility generation)
        property = `--${token.path.map(toKebab).join('-')}`
      }
    }

    // In DTCG mode (usesDtcg), Style Dictionary stores the transformed value in
    // token.$value rather than token.value — mirror the SD v4 built-in format pattern.
    const rawValue = options.usesDtcg ? token.$value : token.value

    // Colors reference the existing CSS custom property for runtime brand switching.
    // When resolvedValues is true (per-brand static builds), use the actual value instead.
    const resolvedValues = (options as { resolvedValues?: boolean }).resolvedValues ?? false
    const value = isColor && !resolvedValues ? `var(--${token.name})` : String(rawValue)

    lines.push(`  ${property}: ${value};`)
  }

  return [
    '/* Auto-generated by figma-variables-style-dictionary */',
    '@theme {',
    ...lines,
    '}',
    '',
  ].join('\n')
}
