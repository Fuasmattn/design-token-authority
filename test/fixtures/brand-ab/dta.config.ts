export default {
  figma: { source: 'file' },
  tokens: { dir: 'tokens' },
  brands: ['BrandA', 'BrandB'],
  breakpoints: {
    collection: 'ScreenType',
    default: 'Mobile',
    modes: { Tablet: '(min-width: 768px)', Desktop: '(min-width: 1024px)' },
  },
  outputs: {
    css: { outDir: 'output/css' },
    tailwind: { outDir: 'output/tailwind' },
  },
  lint: {
    rules: {
      'semantic-must-alias': { severity: 'error', collections: ['Brand(Alias)', 'ScreenType'] },
      'naming-pattern': { severity: 'warn', patterns: { 'Brand(Alias)': '^[A-Z][A-Za-z ]*$' } },
      'color-contrast': {
        severity: 'warn',
        minRatio: 4.5,
        pairs: [
          ['Colors.Text.Default', 'Colors.Surface.Default'],
          ['Colors.Text.On Primary', 'Colors.Brand.Primary'],
          ['Colors.Text.Muted', 'Colors.Surface.Muted'],
        ],
      },
      'no-duplicate-values': { severity: 'warn' },
    },
  },
}
