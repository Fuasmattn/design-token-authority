/**
 * TICKET-007 / TICKET-026: `dtf build` command.
 *
 * Runs the Style Dictionary build pipeline to generate output targets
 * (CSS, JS, Tailwind, etc.) from local token JSON files.
 *
 * The build is split into three phases to avoid token collisions when
 * multiple brands exist:
 *
 *   Phase A — Primitives base layer  → build/css/base.css
 *   Phase B — Per-brand semantic     → build/css/themes/{brand}.css
 *                                      build/tailwind/{brand}/tailwind.tokens.ts
 *                                      build/tailwind/{brand}/tailwind.css
 *   Phase C — Shared outputs         → build/css/variables.css (backwards compat)
 *                                      build/js/colorpalette.js
 *                                      build/tailwind/tailwind.tokens.ts (var refs)
 *                                      build/tailwind/tailwind.css (var refs)
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
 * Auto-detect brand names from Brand(Alias).{Brand}.json files in the tokens directory.
 */
function detectBrands(tokensDir: string): string[] {
  if (!fs.existsSync(tokensDir)) return []
  return fs
    .readdirSync(tokensDir)
    .filter((f) => /^Brand\(Alias\)\..*\.json$/.test(f))
    .map((f) => f.replace(/^Brand\(Alias\)\./, '').replace(/\.json$/, ''))
}

export async function runBuild(config: Config, options: BuildOptions): Promise<void> {
  const tokensDir = config.tokens?.dir ?? 'tokens'
  const cssBuildPath = config.outputs?.css?.outDir ? `${config.outputs.css.outDir}/` : 'build/css/'
  const twBuildPath = config.outputs?.tailwind?.outDir
    ? `${config.outputs.tailwind.outDir}/`
    : 'build/tailwind/'

  p.intro(pc.bgCyan(pc.black(' dtf build ')))

  const brands = detectBrands(tokensDir)

  if (options.verbose) {
    const outputs = config.outputs ? Object.keys(config.outputs).join(', ') : 'default'
    p.log.message(
      `${pc.dim('Source:')} ${tokensDir}\n${pc.dim('Outputs:')} ${outputs}\n${pc.dim('Brands:')} ${brands.length ? brands.join(', ') : 'none detected'}`,
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

  // Phase A — Primitives base layer
  s.start('Building primitives base layer...')
  const sdBase = new StyleDictionary({
    source: [`${tokensDir}/Primitives*.json`],
    platforms: {
      'css-base': {
        transformGroup: 'design-system/css',
        buildPath: cssBuildPath,
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
  generatedFiles.push(`${cssBuildPath}base.css`)
  s.stop('Primitives base layer complete')

  // Phase B — Per-brand semantic layers
  if (brands.length > 0) {
    for (const brand of brands) {
      const slug = brand.toLowerCase()
      s.start(`Building brand: ${brand}...`)

      // Ensure output directories exist
      fs.mkdirSync(path.join(cssBuildPath, 'themes'), { recursive: true })
      fs.mkdirSync(path.join(twBuildPath, slug), { recursive: true })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const brandOnly = (token: any) =>
        token.filePath?.includes(`Brand(Alias).${brand}.json`) ?? false

      const sdBrand = new StyleDictionary({
        source: [`${tokensDir}/Primitives*.json`, `${tokensDir}/Brand(Alias).${brand}.json`],
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

  // Phase C — Shared outputs (primitives-only source to avoid brand collisions)
  s.start('Building shared outputs...')
  const sdShared = new StyleDictionary({
    source: [`${tokensDir}/Primitives*.json`],
    platforms: {
      css: {
        transformGroup: 'design-system/css',
        buildPath: cssBuildPath,
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
        buildPath: 'build/js/',
        files: [{ destination: 'colorpalette.js', format: 'javascript/es6' }],
      },
      'tailwind-v3': {
        transformGroup: 'design-system/css',
        buildPath: twBuildPath,
        files: [{ destination: 'tailwind.tokens.ts', format: 'tailwind/v3' }],
      },
      'tailwind-v4': {
        transformGroup: 'design-system/css',
        buildPath: twBuildPath,
        files: [{ destination: 'tailwind.css', format: 'tailwind/v4' }],
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

  // Phase D — Token documentation HTML
  s.start('Generating token docs...')
  const { generateDocsHtml } = await import('../formatters/docs-html.js')
  const docsPath = 'build/docs/'
  fs.mkdirSync(docsPath, { recursive: true })
  const docsHtml = generateDocsHtml(tokensDir, brands)
  fs.writeFileSync(path.join(docsPath, 'index.html'), docsHtml, 'utf-8')
  generatedFiles.push(`${docsPath}index.html`)
  s.stop('Token docs complete')

  p.note(generatedFiles.map((t) => pc.dim(t)).join('\n'), 'Generated files')

  p.outro('Build complete!')
}
