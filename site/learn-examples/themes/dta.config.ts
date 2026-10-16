export default {
  tokens: { dir: 'tokens' },
  brands: ['Light', 'Dark'],
  outputs: { css: { outDir: 'output/css' } },
  lint: {
    rules: {
      'semantic-must-alias': { severity: 'error', collections: ['Theme'] },
    },
  },
}
