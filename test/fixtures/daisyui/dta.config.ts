export default {
  figma: { source: 'file' },
  tokens: { dir: 'tokens', stripEmojis: true },
  outputs: {
    css: { outDir: 'output/css' },
    tailwind: { outDir: 'output/tailwind', version: 4 },
    docs: { outDir: 'output/docs' },
  },
}
