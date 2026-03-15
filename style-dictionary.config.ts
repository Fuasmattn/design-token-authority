import fs from 'node:fs'
import path from 'node:path'
import StyleDictionary from 'style-dictionary'
import { tailwindV3Formatter } from './src/formatters/tailwind-v3.js'
import { tailwindV4Formatter } from './src/formatters/tailwind-v4.js'

/**
 * Style Dictionary v4 build configuration.
 *
 * Token files in tokens/ use the W3C DTCG format ($type, $value, $description, $extensions).
 * SD v4 reads this format natively — no preprocessing needed.
 *
 * Custom transforms registered below:
 *   - name/kebab-deduped    (TICKET-004) removes adjacent repeated path segments from CSS var names
 *   - value/dimension-px    (TICKET-003) adds px unit to pixel-valued number tokens
 *   - value/opacity-decimal (TICKET-003) converts 0-100 opacity values to 0-1 CSS decimals
 *
 * Build phases (TICKET-026):
 *   Phase A — Primitives base        → build/css/base.css
 *   Phase B — Per-brand semantic     → build/css/themes/{brand}.css
 *                                      build/tailwind/{brand}/tailwind.tokens.ts
 *                                      build/tailwind/{brand}/tailwind.css
 *   Phase C — Shared outputs         → build/css/variables.css (backwards compat)
 *                                      build/js/colorpalette.js
 *                                      build/tailwind/tailwind.tokens.ts (var refs)
 *                                      build/tailwind/tailwind.css (var refs)
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
 */
StyleDictionary.registerTransform({
  name: 'name/kebab-deduped',
  type: 'name',
  transform: (token) => {
    const kebab = token.path
      .map((segment: string) =>
        segment
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
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

// Tailwind formatters
StyleDictionary.registerFormat({ name: 'tailwind/v3', format: tailwindV3Formatter })
StyleDictionary.registerFormat({ name: 'tailwind/v4', format: tailwindV4Formatter })

/**
 * TICKET-026: Strip self-referencing aliases that cause circular resolution.
 *
 * In Figma's multi-collection model, a Brand token like Typography.font-weight.regular
 * can alias {Typography.font-weight.regular} because the reference crosses collection
 * boundaries (Brand → Primitives). In a flat SD run where both collections are loaded
 * as sources, the Brand token shadows the Primitives token and creates a circular ref
 * that causes a stack overflow during resolution.
 *
 * This preprocessor removes tokens whose $value is a self-referencing alias, allowing
 * the Primitives definition to take precedence — matching Figma's runtime behaviour.
 */
StyleDictionary.registerPreprocessor({
  name: 'strip-self-refs',
  preprocessor: (dictionary) => {
    function walk(
      obj: Record<string, unknown>,
      currentPath: string[] = [],
    ): Record<string, unknown> {
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined || typeof value !== 'object') {
          result[key] = value
          continue
        }
        const child = value as Record<string, unknown>
        if ('$value' in child) {
          const val = child['$value']
          if (typeof val === 'string') {
            const refMatch = val.match(/^\{(.+)\}$/)
            if (refMatch && refMatch[1] === [...currentPath, key].join('.')) {
              // Self-referencing alias — skip to let the Primitives definition win
              continue
            }
          }
          result[key] = child
        } else {
          result[key] = walk(child, [...currentPath, key])
        }
      }
      return result
    }
    return walk(dictionary as unknown as Record<string, unknown>)
  },
})

/**
 * Auto-detect brand names from Brand(Alias).{Brand}.json files.
 */
function detectBrands(tokensDir: string): string[] {
  if (!fs.existsSync(tokensDir)) return []
  return fs
    .readdirSync(tokensDir)
    .filter((f) => /^Brand\(Alias\)\..*\.json$/.test(f))
    .map((f) => f.replace(/^Brand\(Alias\)\./, '').replace(/\.json$/, ''))
}

async function build() {
  const tokensDir = 'tokens'
  const brands = detectBrands(tokensDir)

  // Phase A — Primitives base layer
  const sdBase = new StyleDictionary({
    source: [`${tokensDir}/Primitives*.json`],
    platforms: {
      'css-base': {
        transformGroup: 'design-system/css',
        buildPath: 'output/css/',
        files: [
          {
            destination: 'base.css',
            format: 'css/variables',
            options: { selector: ':root', outputReferences: false },
          },
        ],
      },
    },
  })
  await sdBase.buildAllPlatforms()

  // Phase B — Per-brand semantic layers
  for (const brand of brands) {
    const slug = brand.toLowerCase()

    fs.mkdirSync(path.join('output/css/themes'), { recursive: true })
    fs.mkdirSync(path.join('output/tailwind', slug), { recursive: true })

    const brandOnly = (token: { filePath?: string }) =>
      token.filePath?.includes(`Brand(Alias).${brand}.json`) ?? false

    const sdBrand = new StyleDictionary({
      source: [`${tokensDir}/Primitives*.json`, `${tokensDir}/Brand(Alias).${brand}.json`],
      preprocessors: ['strip-self-refs'],
      log: { verbosity: 'silent', errors: { brokenReferences: 'warn' } },
      platforms: {
        'css-theme': {
          transformGroup: 'design-system/css',
          buildPath: 'output/css/',
          files: [
            {
              destination: `themes/${slug}.css`,
              format: 'css/variables',
              filter: brandOnly,
              options: { selector: `[data-brand="${slug}"]`, outputReferences: true },
            },
          ],
        },
        'tailwind-v3-brand': {
          transformGroup: 'design-system/css',
          buildPath: `build/tailwind/${slug}/`,
          files: [
            {
              destination: 'tailwind.tokens.ts',
              format: 'tailwind/v3',
              filter: brandOnly,
              options: { resolvedValues: true },
            },
          ],
        },
        'tailwind-v4-brand': {
          transformGroup: 'design-system/css',
          buildPath: `build/tailwind/${slug}/`,
          files: [
            {
              destination: 'tailwind.css',
              format: 'tailwind/v4',
              filter: brandOnly,
              options: { resolvedValues: true },
            },
          ],
        },
      },
    })
    await sdBrand.buildAllPlatforms()
  }

  // Phase C — Shared outputs (primitives-only to avoid brand collisions)
  const sdShared = new StyleDictionary({
    source: [`${tokensDir}/Primitives*.json`],
    platforms: {
      css: {
        transformGroup: 'design-system/css',
        buildPath: 'output/css/',
        files: [
          {
            destination: 'variables.css',
            format: 'css/variables',
            options: { outputReferences: true },
          },
        ],
      },
      js: {
        transformGroup: 'js',
        buildPath: 'output/js/',
        files: [{ destination: 'colorpalette.js', format: 'javascript/es6' }],
      },
      'tailwind-v3': {
        transformGroup: 'design-system/css',
        buildPath: 'output/tailwind/',
        files: [{ destination: 'tailwind.tokens.ts', format: 'tailwind/v3' }],
      },
      'tailwind-v4': {
        transformGroup: 'design-system/css',
        buildPath: 'output/tailwind/',
        files: [{ destination: 'tailwind.css', format: 'tailwind/v4' }],
      },
    },
  })
  await sdShared.buildAllPlatforms()

  // Phase D — Token documentation HTML
  const { generateDocsHtml } = await import('./src/formatters/docs-html.js')
  fs.mkdirSync('output/docs', { recursive: true })
  fs.writeFileSync('output/docs/index.html', generateDocsHtml(tokensDir, brands), 'utf-8')
}

build()
