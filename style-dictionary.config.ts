import StyleDictionary from 'style-dictionary'

/**
 * Style Dictionary v4 build configuration.
 *
 * Token files in tokens/ use the W3C DTCG format ($type, $value, $description, $extensions).
 * SD v4 reads this format natively — no preprocessing needed.
 *
 * Custom transforms registered below:
 *   - name/kebab-deduped    (TICKET-004) removes adjacent repeated path segments from CSS var names
 *   - value/blur-px         (TICKET-003) adds px unit to EFFECT_FLOAT number tokens
 *   - value/opacity-decimal (TICKET-003) converts 0-100 opacity values to 0-1 CSS decimals
 *
 * Current output targets:
 *   - CSS custom properties  → build/css/variables.css
 *   - JavaScript ES6 exports → build/js/colorpalette.js
 *
 * Additional output targets (Tailwind, iOS, Android) are tracked in docs/tickets/.
 */

// Built-in SD v4 CSS transforms — replicated here so we can compose a custom group
// while replacing 'name/kebab' with 'name/kebab-deduped'.
// Derived from: StyleDictionary.hooks.transformGroups.css (v4.4.0)
const CSS_BASE_TRANSFORMS = [
  'attribute/cti',
  'time/seconds',
  'html/icon',
  'size/rem',
  'color/css',
  'asset/url',
  'fontFamily/css',
  'cubicBezier/css',
  'strokeStyle/css/shorthand',
  'border/css/shorthand',
  'typography/css/shorthand',
  'transition/css/shorthand',
  'shadow/css/shorthand',
]

/**
 * TICKET-004: Deduplicate adjacent repeated segments in CSS variable names.
 *
 * Figma groups like "Effects/blur/blur-xs" naively produce "--effects-blur-blur-xs"
 * when the path is joined with hyphens. This transform deduplicates adjacent repeated
 * hyphen-parts to produce "--effects-blur-xs".
 *
 * Examples:
 *   Effects/blur/blur-xs       → effects-blur-xs       (was effects-blur-blur-xs)
 *   Effects/opacity/opacity-50 → effects-opacity-50    (was effects-opacity-opacity-50)
 *   Colors/Brand/Primary       → colors-brand-primary  (unchanged)
 */
StyleDictionary.registerTransform({
  name: 'name/kebab-deduped',
  type: 'name',
  transform: (token) => {
    const kebab = token.path
      .map((segment: string) =>
        segment
          .toLowerCase()
          .replace(/[\s()]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, ''),
      )
      .join('-')
    const parts = kebab.split('-').filter(Boolean)
    return parts.filter((part, i) => i === 0 || part !== parts[i - 1]).join('-')
  },
})

/**
 * TICKET-003: Add px unit to all Figma "dimension" scopes.
 *
 * Figma exports pixel-valued numbers without units. These scopes all represent
 * pixel values in CSS: spacing (GAP), sizes (WIDTH_HEIGHT), radii (CORNER_RADIUS),
 * strokes (STROKE_FLOAT), and blur/spread effects (EFFECT_FLOAT).
 *
 * Typography-specific scopes (FONT_SIZE, LINE_HEIGHT, LETTER_SPACING, etc.)
 * are intentionally excluded — they may need rem/em and will be handled per output target.
 */
const PIXEL_SCOPES = new Set([
  'GAP',
  'WIDTH_HEIGHT',
  'CORNER_RADIUS',
  'STROKE_FLOAT',
  'EFFECT_FLOAT',
])

StyleDictionary.registerTransform({
  name: 'value/dimension-px',
  type: 'value',
  filter: (token) => {
    const scopes: string[] = token.$extensions?.['com.figma']?.scopes ?? []
    return token.$type === 'number' && scopes.some((s) => PIXEL_SCOPES.has(s))
  },
  transform: (token) => `${token.$value}px`,
})

/**
 * TICKET-003: Convert opacity from 0–100 integer range to 0–1 CSS decimal.
 *
 * Figma stores opacity as a 0–100 percentage integer; CSS `opacity` property
 * expects a 0–1 float. Identified by the Figma OPACITY variable scope.
 */
StyleDictionary.registerTransform({
  name: 'value/opacity-decimal',
  type: 'value',
  filter: (token) => {
    const scopes: string[] = token.$extensions?.['com.figma']?.scopes ?? []
    return token.$type === 'number' && scopes.includes('OPACITY')
  },
  transform: (token) => String(Number(token.$value) / 100),
})

/**
 * Custom CSS transform group: standard CSS transforms with our additions.
 * Replaces 'name/kebab' with 'name/kebab-deduped' and adds unit transforms.
 */
StyleDictionary.registerTransformGroup({
  name: 'design-system/css',
  transforms: [
    ...CSS_BASE_TRANSFORMS,
    'name/kebab-deduped',
    'value/dimension-px',
    'value/opacity-decimal',
  ],
})

async function build() {
  const sd = new StyleDictionary({
    source: ['tokens/**/*.json'],
    platforms: {
      css: {
        transformGroup: 'design-system/css',
        buildPath: 'build/css/',
        files: [
          {
            destination: 'variables.css',
            format: 'css/variables',
            options: {
              outputReferences: true,
            },
          },
        ],
      },
      js: {
        transformGroup: 'js',
        buildPath: 'build/js/',
        files: [
          {
            destination: 'colorpalette.js',
            format: 'javascript/es6',
          },
        ],
      },
    },
  })

  await sd.buildAllPlatforms()
}

build()
