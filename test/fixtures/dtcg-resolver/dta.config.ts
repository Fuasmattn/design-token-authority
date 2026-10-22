export default {
  figma: { source: 'file' },
  tokens: { dir: 'tokens' },
  // The theme modifier's contexts, built into one theme file each.
  brands: ['light', 'dark'],
  outputs: {
    css: { outDir: 'output/css' },
    tailwind: { outDir: 'output/tailwind' },
  },
}
