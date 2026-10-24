export default {
  figma: { source: 'file' },
  tokens: { dir: 'tokens' },
  // The brand modifier's contexts are brands ([data-brand]); the theme modifier is switched
  // with [data-theme]. Tokens both change combine in CSS (TICKET-137).
  brands: ['a', 'b'],
  outputs: {
    css: { outDir: 'output/css' },
    tailwind: { outDir: 'output/tailwind' },
  },
}
