/**
 * Style Dictionary formatter: Tailwind v3 theme output (TICKET-009)
 *
 * Generates a `tailwind.tokens.ts` file that exports a Tailwind v3-compatible
 * `theme.extend` object. Color tokens are output as CSS variable references
 * (`var(--...)`) to support runtime brand switching. All other token categories
 * use their transformed values directly.
 *
 * Token path → Tailwind theme key mapping:
 *   Colors/*                   → colors
 *   Dimensions/spacing/*       → spacing
 *   Dimensions/breakpoints/*   → screens
 *   Dimensions/sizing/*        → size  (custom key, no Tailwind built-in equivalent)
 *   Borders/border-radius/*    → borderRadius
 *   Borders/border-width/*     → borderWidth
 *   Effects/opacity/*          → opacity
 *   Effects/blur/*             → blur
 *   Typography/font-family/*   → fontFamily
 *   Typography/font-size/*     → fontSize
 *   Typography/font-weight/*   → fontWeight
 *   Typography/line-height/*   → lineHeight
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
function getCategory(path: string[]): [string, number] | null {
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

export const tailwindV3Formatter: FormatFn = ({ dictionary, options }) => {
  const theme: ThemeMap = {}

  for (const token of dictionary.allTokens) {
    const result = getCategory(token.path)
    if (!result) continue

    const [category, keyStart] = result
    const key = token.path.slice(keyStart).map(toKebab).join('-')

    if (!theme[category]) theme[category] = {}

    // Colors always reference the CSS custom property so runtime brand switching works.
    // All other categories use the transformed value directly.
    // In DTCG mode (usesDtcg), Style Dictionary stores the transformed value in
    // token.$value rather than token.value — mirror the SD v4 built-in format pattern.
    const rawValue = options.usesDtcg ? token.$value : token.value
    const value = category === 'colors' ? `var(--${token.name})` : String(rawValue)

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
