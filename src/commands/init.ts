/**
 * TICKET-007: `figma-tokens init` command (stub).
 *
 * Full implementation is deferred to TICKET-015 (init wizard).
 * This stub creates a minimal figma-tokens.config.ts in the current directory.
 */

import * as fs from 'fs'
import * as path from 'path'
import { green, brightRed } from '../utils.js'

export interface InitOptions {
  verbose?: boolean
}

const TEMPLATE = `import { defineConfig } from 'figma-tokens'

export default defineConfig({
  figma: {
    fileKey: process.env.FIGMA_FILE_KEY!,
    personalAccessToken: process.env.FIGMA_PERSONAL_ACCESS_TOKEN!,
  },

  // Map your Figma collection names to semantic layer roles.
  // Uncomment and adjust to match your Figma variable structure.
  // layers: {
  //   primitives: 'Primitives(Global)',
  //   brand: 'Brand(Alias)',
  //   dimension: 'ScreenType',
  // },

  // Brand names = mode names in your brand collection.
  // brands: ['BrandA', 'BrandB'],

  tokens: {
    dir: 'tokens',
  },

  // Output targets — uncomment and configure what you need.
  // outputs: {
  //   css: {
  //     outDir: 'build/css',
  //     prefix: '--ds',
  //   },
  //   tailwind: {
  //     outDir: 'build/tailwind',
  //     version: 4,
  //   },
  // },
})
`

export async function runInit(_options: InitOptions): Promise<void> {
  const targetPath = path.resolve('figma-tokens.config.ts')

  if (fs.existsSync(targetPath)) {
    console.error(brightRed(`Config file already exists: ${targetPath}`))
    console.error('Remove it first if you want to re-initialize.')
    process.exit(2)
  }

  fs.writeFileSync(targetPath, TEMPLATE, 'utf-8')

  console.log(green(`Created ${path.basename(targetPath)}`))
  console.log('\nNext steps:')
  console.log('  1. Set FIGMA_FILE_KEY and FIGMA_PERSONAL_ACCESS_TOKEN in your .env')
  console.log('  2. Adjust the config to match your Figma variable structure')
  console.log('  3. Run "figma-tokens pull" to export tokens from Figma')
}
