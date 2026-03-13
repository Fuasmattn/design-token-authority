import { defineConfig } from 'design-token-farm'

export default defineConfig({
  figma: {
    fileKey: process.env.FIGMA_FILE_KEY!,
    personalAccessToken: process.env.FIGMA_PERSONAL_ACCESS_TOKEN!,
  },

  layers: {
    primitives: 'Primitives (Global)',
    brand: 'Brand (Alias)',
    dimension: 'Screen Type',
  },

  brands: ['LEW', 'Bayernwerk'],

  tokens: {
    dir: 'tokens',
  },

  outputs: {
    css: {
      outDir: 'build/css',
      prefix: '--',
    },
    tailwind: {
      outDir: 'build/tailwind',
      version: 4,
    },
  },
})
