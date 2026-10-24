export default {
  tokens: { dir: 'tokens' },
  outputs: { css: { outDir: 'output/css' } },
  lint: {
    rules: {
      'semantic-must-alias': { severity: 'error', collections: ['Semantic', 'Component'] },
    },
  },
}
