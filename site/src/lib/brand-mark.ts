/**
 * The DTA mark as an SVG file (TICKET-144): the site's favicon and the icon in the `dta diff`
 * pull-request comment, one drawing. Colours come from the tokens: the blueprint square
 * (`blueprint.600`) and the ink outline, which is `border.strong` of the theme, so it stays
 * visible on a dark background.
 */
import { resolve, formatValue } from '@dta/core'
import { loadModel, type Theme } from './design-tokens'

const model = loadModel()

function color(name: string[], theme: Theme): string {
  const result = resolve(model, name, { Theme: theme })
  if (!result.ok) throw new Error(`${name.join('.')} does not resolve in ${theme}`)
  return formatValue(result.value)
}

/** The mark's colours for a theme. */
export function markColors(theme: Theme): { fill: string; outline: string } {
  return { fill: color(['blueprint', '600'], theme), outline: color(['border', 'strong'], theme) }
}

/** The mark: an ink outline and a blueprint square offset up-right, on a 32 × 32 grid. */
export function markSvg(theme: Theme): string {
  const { fill, outline } = markColors(theme)
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">',
    `  <rect x="11" y="3" width="18" height="18" rx="4" fill="${fill}"/>`,
    `  <rect x="4" y="10" width="18" height="18" rx="4" fill="none" stroke="${outline}" stroke-width="2.5"/>`,
    '</svg>',
    '',
  ].join('\n')
}

/** Where the files are served: `/brand/dta-mark-light.svg` and `/brand/dta-mark-dark.svg`. */
export const MARK_FILES = { light: 'Light', dark: 'Graphite' } as const satisfies Record<
  string,
  Theme
>

export const svgResponse = (svg: string) =>
  new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } })
