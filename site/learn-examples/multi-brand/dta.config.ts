export default {
  tokens: { dir: 'tokens' },
  brands: ['BrandA', 'BrandB'],
  outputs: { css: { outDir: 'output/css' } },
  lint: {
    rules: {
      'semantic-must-alias': { severity: 'error', collections: ['Brand'] },
    },
  },
}
