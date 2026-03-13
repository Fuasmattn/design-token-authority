/**
 * TICKET-007: `dtf build` command.
 *
 * Runs the Style Dictionary build pipeline to generate output targets
 * (CSS, JS, Tailwind, etc.) from local token JSON files.
 *
 * Currently delegates to the existing style-dictionary.config.ts.
 * Future work (output target tickets) will make this config-driven.
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { Config } from '../config/index.js'

export interface BuildOptions {
  verbose?: boolean
}

export async function runBuild(config: Config, options: BuildOptions): Promise<void> {
  const tokensDir = config.tokens?.dir ?? 'tokens'

  p.intro(pc.bgCyan(pc.black(' dtf build ')))

  if (options.verbose) {
    const outputs = config.outputs ? Object.keys(config.outputs).join(', ') : 'default'
    p.log.message(
      `${pc.dim('Source:')} ${tokensDir}\n${pc.dim('Outputs:')} ${outputs}`,
    )
  }

  // Dynamic import to avoid loading Style Dictionary until the build command runs.
  // Type assertion needed because style-dictionary types may not be present.
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

  // ---- Build ----

  const sd = new StyleDictionary({
    source: [`${tokensDir}/**/*.json`],
    platforms: {
      css: {
        transformGroup: 'design-system/css',
        buildPath: config.outputs?.css?.outDir ? `${config.outputs.css.outDir}/` : 'build/css/',
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
        buildPath: config.outputs?.tailwind?.outDir
          ? `${config.outputs.tailwind.outDir}/`
          : 'build/tailwind/',
        files: [{ destination: 'tailwind.tokens.ts', format: 'tailwind/v3' }],
      },
      'tailwind-v4': {
        transformGroup: 'design-system/css',
        buildPath: config.outputs?.tailwind?.outDir
          ? `${config.outputs.tailwind.outDir}/`
          : 'build/tailwind/',
        files: [{ destination: 'tailwind.css', format: 'tailwind/v4' }],
      },
    },
  })

  const s = p.spinner()
  s.start('Running Style Dictionary build...')

  await sd.buildAllPlatforms()

  s.stop('Build complete')

  const targets = ['css/variables.css', 'js/colorpalette.js', 'tailwind/tailwind.tokens.ts', 'tailwind/tailwind.css']
  p.note(
    targets.map((t) => pc.dim(`build/${t}`)).join('\n'),
    'Generated files',
  )

  p.outro('Build complete!')
}
