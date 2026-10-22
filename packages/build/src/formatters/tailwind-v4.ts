/**
 * Style Dictionary formatter: Tailwind v4 @theme CSS output (ported from the v1 formatter)
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
 */

import type { FormatFn } from 'style-dictionary/types'
import { dimensionKind } from './dimension-kind.js'

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
function getPropertyPrefixByType(
  type: string | undefined,
  scopes: readonly string[],
  path: readonly string[] = [],
): [string, string] | null {
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

  // DTCG 2025.10 types; a dimension maps by its name, as DTCG files carry no Figma scopes.
  if (type === 'fontFamily') return ['--font-', 'font']
  if (type === 'fontWeight') return ['--font-weight-', 'font-weight']
  if (type === 'shadow') return ['--shadow-', 'shadow']
  if (type === 'cubicBezier') return ['--ease-', 'ease']
  if (type === 'dimension') {
    const kind = dimensionKind(path)
    if (kind === 'radius') return ['--radius-', 'radius']
    if (kind === 'spacing') return ['--spacing-', 'spacing']
    if (kind === 'font-size') return ['--font-size-', 'font-size']
    if (kind === 'blur') return ['--blur-', 'blur']
    if (kind === 'breakpoint') return ['--breakpoint-', 'breakpoint']
    return null
  }

  return null
}

/**
 * The `@theme` property a token becomes in the Tailwind v4 output, e.g. `--color-brand-primary`
 * (utility `bg-brand-primary`). `utility: false` for the generic fallback, which Tailwind turns
 * into no utility class.
 */
export function tailwindThemeProperty(
  path: readonly string[],
  type: string | undefined,
  scopes: readonly string[],
): { property: string; isColor: boolean; utility: boolean } {
  // 1. Path-based mapping (well-known structures)
  const pathResult = getPropertyPrefixByPath([...path])
  if (pathResult) {
    const [prefix, keyStart] = pathResult
    const suffix = path.slice(keyStart).map(toKebab).join('-')
    return { property: `${prefix}${suffix}`, isColor: prefix === '--color-', utility: true }
  }
  // 2. Type+scope-based mapping
  const typeResult = getPropertyPrefixByType(type, scopes, path)
  if (typeResult) {
    const [prefix, category] = typeResult
    return {
      property: `${prefix}${path.map(toKebab).join('-')}`,
      isColor: category === 'color',
      utility: true,
    }
  }
  // 3. Fallback: generic custom property (no Tailwind utility generation)
  return { property: `--${path.map(toKebab).join('-')}`, isColor: false, utility: false }
}

export const tailwindV4Formatter: FormatFn = ({ dictionary, options }) => {
  const lines: string[] = []
  // `inline` (breakpoint tokens, TICKET-091): an `@theme inline` block whose theme variables
  // all read the custom properties, so utilities follow the media queries of variables.css.
  // Tokens without a utility namespace are left out: they would only repeat their own name.
  const inline = (options as { inline?: boolean }).inline ?? false

  for (const token of dictionary.allTokens) {
    const extensions = token.$extensions as Record<string, { scopes?: string[] }> | undefined
    if (inline) {
      const { property, utility } = tailwindThemeProperty(
        token.path,
        (token.$type ?? token.type) as string | undefined,
        extensions?.['com.figma']?.scopes ?? [],
      )
      if (utility) lines.push(`  ${property}: var(--${token.name});`)
      continue
    }
    const { property, isColor } = tailwindThemeProperty(
      token.path,
      (token.$type ?? token.type) as string | undefined,
      extensions?.['com.figma']?.scopes ?? [],
    )

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
    inline ? '@theme inline {' : '@theme {',
    ...lines,
    '}',
    '',
  ].join('\n')
}
