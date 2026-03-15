/**
 * TICKET-007 / TICKET-026: `dtf build` command.
 *
 * Runs the Style Dictionary build pipeline to generate output targets
 * (CSS, JS, Tailwind, etc.) from local token JSON files.
 *
 * Collections are auto-discovered from token files ({Collection}.{Mode}.json).
 * The build is split into phases to avoid token collisions:
 *
 *   Phase A — Base layer (single-mode collections)  → output/css/base.css
 *   Phase B — Per-brand (multi-mode collections)    → output/css/themes/{brand}.css
 *                                                      output/tailwind/{brand}/...
 *   Phase C — Shared outputs (single-mode only)     → output/css/variables.css
 *                                                      output/js/colorpalette.js
 *                                                      output/tailwind/...
 *   Phase D — Token documentation HTML              → output/docs/index.html
 */

import fs from 'node:fs'
import path from 'node:path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { Config } from '../config/index.js'

export interface BuildOptions {
  verbose?: boolean
}

/**
 * Discover all collections and their modes from token files in the directory.
 * Returns a map of collection name → mode names.
 */
function discoverCollections(tokensDir: string): Map<string, string[]> {
  if (!fs.existsSync(tokensDir)) return new Map()
  const collections = new Map<string, string[]>()
  for (const f of fs.readdirSync(tokensDir)) {
    if (!f.endsWith('.json')) continue
    const base = f.replace(/\.json$/, '')
    const dotIdx = base.indexOf('.')
    if (dotIdx === -1) continue
    const collectionName = base.substring(0, dotIdx)
    const modeName = base.substring(dotIdx + 1)
    if (!collections.has(collectionName)) {
      collections.set(collectionName, [])
    }
    collections.get(collectionName)!.push(modeName)
  }
  return collections
}

export async function runBuild(config: Config, options: BuildOptions): Promise<void> {
  const tokensDir = config.tokens?.dir ?? 'tokens'
  const cssBuildPath = config.outputs?.css?.outDir ? `${config.outputs.css.outDir}/` : 'output/css/'
  const twBuildPath = config.outputs?.tailwind?.outDir
    ? `${config.outputs.tailwind.outDir}/`
    : 'output/tailwind/'

  p.intro(pc.bgCyan(pc.black(' dtf build ')))

  // Discover collections from token files
  const allCollections = discoverCollections(tokensDir)

  // Filter to configured collections (if specified), otherwise use all
  const activeCollections = config.collections
    ? new Map([...allCollections].filter(([name]) => config.collections!.includes(name)))
    : allCollections

  // Determine brands: config.brands, or auto-detect from multi-mode collections
  const brands = config.brands ?? []

  // Classify collections: single-mode (base) vs multi-mode (per-brand/mode)
  const singleModeCollections: string[] = []
  const multiModeCollections = new Map<string, string[]>()
  for (const [name, modes] of activeCollections) {
    if (modes.length === 1) {
      singleModeCollections.push(name)
    } else {
      multiModeCollections.set(name, modes)
    }
  }

  if (options.verbose) {
    const outputs = config.outputs ? Object.keys(config.outputs).join(', ') : 'default'
    const collectionNames = [...activeCollections.keys()].join(', ') || 'none'
    p.log.message(
      `${pc.dim('Source:')} ${tokensDir}\n${pc.dim('Outputs:')} ${outputs}\n${pc.dim('Collections:')} ${collectionNames}\n${pc.dim('Brands:')} ${brands.length ? brands.join(', ') : 'none'}`,
    )
  }

  // Dynamic import to avoid loading Style Dictionary until the build command runs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { default: StyleDictionary } = (await import('style-dictionary')) as any
  const { tailwindV3Formatter } = await import('../formatters/tailwind-v3.js')
  const { tailwindV4Formatter } = await import('../formatters/tailwind-v4.js')

  // ---- Register custom transforms (same as style-dictionary.config.ts) ----

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

  const PIXEL_SCOPES = new Set([
    'GAP',
    'WIDTH_HEIGHT',
    'CORNER_RADIUS',
    'STROKE_FLOAT',
    'EFFECT_FLOAT',
  ])

  StyleDictionary.registerTransform({
    name: 'name/kebab-deduped',
    type: 'name',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transform: (token: any) => {
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
      return parts.filter((part: string, i: number) => i === 0 || part !== parts[i - 1]).join('-')
    },
  })

  StyleDictionary.registerTransform({
    name: 'value/dimension-px',
    type: 'value',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter: (token: any) => {
      const scopes: string[] = token.$extensions?.['com.figma']?.scopes ?? []
      return token.$type === 'number' && scopes.some((s: string) => PIXEL_SCOPES.has(s))
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transform: (token: any) => `${token.$value}px`,
  })

  StyleDictionary.registerTransform({
    name: 'value/opacity-decimal',
    type: 'value',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter: (token: any) => {
      const scopes: string[] = token.$extensions?.['com.figma']?.scopes ?? []
      return token.$type === 'number' && scopes.includes('OPACITY')
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transform: (token: any) => String(Number(token.$value) / 100),
  })

  StyleDictionary.registerTransformGroup({
    name: 'design-system/css',
    transforms: [
      ...CSS_BASE_TRANSFORMS,
      'name/kebab-deduped',
      'value/dimension-px',
      'value/opacity-decimal',
    ],
  })

  StyleDictionary.registerFormat({ name: 'tailwind/v3', format: tailwindV3Formatter })
  StyleDictionary.registerFormat({ name: 'tailwind/v4', format: tailwindV4Formatter })

  // Strip self-referencing aliases that cause circular resolution when Brand tokens
  // shadow Primitives tokens with the same path (see style-dictionary.config.ts).
  StyleDictionary.registerPreprocessor({
    name: 'strip-self-refs',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    preprocessor: (dictionary: any) => {
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

  // ---- Build ----

  const s = p.spinner()
  const generatedFiles: string[] = []

  // Build source globs from active collections
  const singleModeGlobs = singleModeCollections.map((name) => `${tokensDir}/${name}.*.json`)

  // For reference context: include one mode from each multi-mode collection so cross-collection
  // references can resolve. Pick the first mode alphabetically to be deterministic.
  const multiModeRefGlobs: string[] = []
  for (const [name, modes] of multiModeCollections) {
    const firstMode = [...modes].sort()[0]
    multiModeRefGlobs.push(`${tokensDir}/${name}.${firstMode}.json`)
  }
  const allSourceGlobs = [...singleModeGlobs, ...multiModeRefGlobs]

  // Filter: only tokens from single-mode collection files
  const singleModeFilePatterns = singleModeCollections.map((name) => `${name}.`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const singleModeOnly = (token: any) =>
    singleModeFilePatterns.some((p) => token.filePath?.includes(`/${p}`)) ?? false

  // Phase A — Base layer (all single-mode collections, with multi-mode as reference context)
  if (singleModeGlobs.length > 0) {
    s.start('Building base layer...')
    const sdBase = new StyleDictionary({
      source: allSourceGlobs,
      preprocessors: ['strip-self-refs'],
      log: { verbosity: 'silent', errors: { brokenReferences: 'warn' } },
      platforms: {
        'css-base': {
          transformGroup: 'design-system/css',
          buildPath: cssBuildPath,
          files: [
            {
              destination: 'base.css',
              format: 'css/variables',
              filter: singleModeOnly,
              options: { selector: ':root', outputReferences: false },
            },
          ],
        },
      },
    })
    await sdBase.buildAllPlatforms()
    generatedFiles.push(`${cssBuildPath}base.css`)
    s.stop('Base layer complete')
  }

  // Phase B — Per-brand/mode builds for multi-mode collections
  if (brands.length > 0 && multiModeCollections.size > 0) {
    for (const brand of brands) {
      const slug = brand.toLowerCase()
      s.start(`Building brand: ${brand}...`)

      // Ensure output directories exist
      fs.mkdirSync(path.join(cssBuildPath, 'themes'), { recursive: true })
      fs.mkdirSync(path.join(twBuildPath, slug), { recursive: true })

      // Gather source files: all single-mode + matching brand mode files
      const brandSourceGlobs = [...singleModeGlobs]
      const brandFilePatterns: string[] = []
      for (const [collName] of multiModeCollections) {
        const pattern = `${tokensDir}/${collName}.${brand}.json`
        brandSourceGlobs.push(pattern)
        brandFilePatterns.push(`${collName}.${brand}.json`)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const brandOnly = (token: any) =>
        brandFilePatterns.some((p) => token.filePath?.includes(p)) ?? false

      const sdBrand = new StyleDictionary({
        source: brandSourceGlobs,
        preprocessors: ['strip-self-refs'],
        log: { verbosity: 'silent', errors: { brokenReferences: 'warn' } },
        platforms: {
          'css-theme': {
            transformGroup: 'design-system/css',
            buildPath: cssBuildPath,
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
            buildPath: `${twBuildPath}${slug}/`,
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
            buildPath: `${twBuildPath}${slug}/`,
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
      generatedFiles.push(
        `${cssBuildPath}themes/${slug}.css`,
        `${twBuildPath}${slug}/tailwind.tokens.ts`,
        `${twBuildPath}${slug}/tailwind.css`,
      )
      s.stop(`Brand ${brand} complete`)
    }
  }

  // Phase C — Shared outputs (single-mode collections, with multi-mode as reference context)
  if (singleModeGlobs.length > 0) {
    s.start('Building shared outputs...')
    const sdShared = new StyleDictionary({
      source: allSourceGlobs,
      preprocessors: ['strip-self-refs'],
      log: { verbosity: 'silent', errors: { brokenReferences: 'warn' } },
      platforms: {
        css: {
          transformGroup: 'design-system/css',
          buildPath: cssBuildPath,
          files: [
            {
              destination: 'variables.css',
              format: 'css/variables',
              filter: singleModeOnly,
              options: { outputReferences: true },
            },
          ],
        },
        js: {
          transformGroup: 'js',
          buildPath: 'output/js/',
          files: [
            { destination: 'colorpalette.js', format: 'javascript/es6', filter: singleModeOnly },
          ],
        },
        'tailwind-v3': {
          transformGroup: 'design-system/css',
          buildPath: twBuildPath,
          files: [
            { destination: 'tailwind.tokens.ts', format: 'tailwind/v3', filter: singleModeOnly },
          ],
        },
        'tailwind-v4': {
          transformGroup: 'design-system/css',
          buildPath: twBuildPath,
          files: [{ destination: 'tailwind.css', format: 'tailwind/v4', filter: singleModeOnly }],
        },
      },
    })
    await sdShared.buildAllPlatforms()
    generatedFiles.push(
      `${cssBuildPath}variables.css`,
      'build/js/colorpalette.js',
      `${twBuildPath}tailwind.tokens.ts`,
      `${twBuildPath}tailwind.css`,
    )
    s.stop('Shared outputs complete')
  }

  // Phase D — Token documentation HTML
  s.start('Generating token docs...')
  const { generateDocsHtml } = await import('../formatters/docs-html.js')
  const docsPath = 'output/docs/'
  fs.mkdirSync(docsPath, { recursive: true })
  const docsHtml = generateDocsHtml(tokensDir, brands)
  fs.writeFileSync(path.join(docsPath, 'index.html'), docsHtml, 'utf-8')
  generatedFiles.push(`${docsPath}index.html`)
  s.stop('Token docs complete')

  p.note(generatedFiles.map((t) => pc.dim(t)).join('\n'), 'Generated files')

  p.outro('Build complete!')
}
