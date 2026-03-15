/**
 * Style Dictionary formatter: Tailwind v3 theme output (TICKET-009)
 *
 * Generates a `tailwind.tokens.ts` file that exports a Tailwind v3-compatible
 * `theme.extend` object. Color tokens are output as CSS variable references
 * (`var(--...)`) to support runtime brand switching. All other token categories
 * use their transformed values directly.
 *
 * Mapping strategy (in priority order):
 *   1. Path-based: well-known path prefixes (Colors/*, Dimensions/spacing/*, etc.)
 *   2. Type+scope: $type and Figma scopes determine the Tailwind category
 *   3. Fallback: unmapped tokens use first path segment as category
 */

import type { FormatFn } from 'style-dictionary/types'

type ThemeMap = Record<string, Record<string, string>>

/**
 * Sanitize a path segment (or joined key) for use as a Tailwind theme key or CSS identifier.
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
 * Maps a token's path to a [tailwindCategory, keyStartIndex] pair.
 * Returns null for token paths that don't map to a known Tailwind category.
 */
function getCategoryByPath(path: string[]): [string, number] | null {
  const [top, sub] = path
  switch (top) {
    case 'Colors':
      return ['colors', 1]
    case 'Dimensions':
      if (sub === 'spacing') return ['spacing', 2]
      if (sub === 'breakpoints') return ['screens', 2]
      if (sub === 'sizing') return ['size', 2]
      return null
    case 'Borders':
      if (sub === 'border-radius') return ['borderRadius', 2]
      if (sub === 'border-width') return ['borderWidth', 2]
      return null
    case 'Effects':
      if (sub === 'opacity') return ['opacity', 2]
      if (sub === 'blur') return ['blur', 2]
      return null
    case 'Typography':
      if (sub === 'font-family') return ['fontFamily', 2]
      if (sub === 'font-size') return ['fontSize', 2]
      if (sub === 'font-weight') return ['fontWeight', 2]
      if (sub === 'line-height') return ['lineHeight', 2]
      return null
    default:
      return null
  }
}

/**
 * Determine the Tailwind v3 theme category from token $type and Figma scopes.
 * Returns [category, isColor] or null if the token can't be mapped.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCategoryByType(token: any): [string, boolean] | null {
  const type: string = token.$type ?? token.type
  const scopes: string[] = token.$extensions?.['com.figma']?.scopes ?? []

  if (type === 'color') return ['colors', true]

  if (type === 'number') {
    if (scopes.includes('FONT_SIZE')) return ['fontSize', false]
    if (scopes.includes('FONT_WEIGHT')) return ['fontWeight', false]
    if (scopes.includes('LINE_HEIGHT')) return ['lineHeight', false]
    if (scopes.includes('OPACITY')) return ['opacity', false]
    if (scopes.includes('CORNER_RADIUS')) return ['borderRadius', false]
    if (scopes.includes('GAP') || scopes.includes('WIDTH_HEIGHT')) return ['spacing', false]
    if (scopes.includes('STROKE_FLOAT')) return ['borderWidth', false]
    if (scopes.includes('EFFECT_FLOAT')) return ['blur', false]
    return null
  }

  if (type === 'string') {
    if (scopes.includes('FONT_FAMILY')) return ['fontFamily', false]
    return null
  }

  return null
}

export const tailwindV3Formatter: FormatFn = ({ dictionary, options }) => {
  const theme: ThemeMap = {}

  for (const token of dictionary.allTokens) {
    // 1. Try path-based mapping (well-known structures)
    const pathResult = getCategoryByPath(token.path)

    let category: string
    let key: string
    let isColor: boolean

    if (pathResult) {
      const [cat, keyStart] = pathResult
      category = cat
      key = token.path.slice(keyStart).map(toKebab).join('-')
      isColor = cat === 'colors'
    } else {
      // 2. Try type+scope-based mapping
      const typeResult = getCategoryByType(token)
      if (typeResult) {
        const [cat, color] = typeResult
        category = cat
        key = token.path.map(toKebab).join('-')
        isColor = color
      } else {
        // 3. Fallback: use first path segment as category
        category = toKebab(token.path[0])
        key = token.path.slice(1).map(toKebab).join('-') || toKebab(token.path[0])
        isColor = false
      }
    }

    if (!theme[category]) theme[category] = {}

    // In DTCG mode (usesDtcg), Style Dictionary stores the transformed value in
    // token.$value rather than token.value — mirror the SD v4 built-in format pattern.
    const rawValue = options.usesDtcg ? token.$value : token.value

    // Colors reference the CSS custom property so runtime brand switching works.
    // When resolvedValues is true (per-brand static builds), use the actual value instead.
    const resolvedValues = (options as { resolvedValues?: boolean }).resolvedValues ?? false
    const value = isColor && !resolvedValues ? `var(--${token.name})` : String(rawValue)

    theme[category][key] = value
  }

  const categoryBlocks = Object.entries(theme)
    .map(([cat, values]) => {
      const pairs = Object.entries(values)
        .map(([k, v]) => `        '${k}': '${v}'`)
        .join(',\n')
      return `      ${cat}: {\n${pairs},\n      }`
    })
    .join(',\n')

  return [
    `import type { Config } from 'tailwindcss'`,
    ``,
    `export const tokens = {`,
    `  theme: {`,
    `    extend: {`,
    categoryBlocks,
    `    },`,
    `  },`,
    `} satisfies Partial<Config>`,
    ``,
  ].join('\n')
}
