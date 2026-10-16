// DTA's own design tokens (DTA Drafting Table), built with DTA for the website.
// Theme modes use the brand layer for now: `dta build` writes one theme per mode,
// selected with [data-brand="light"] / [data-brand="graphite"].
export default {
  figma: { source: 'file' },
  tokens: { dir: 'tokens' },
  brands: ['Light', 'Graphite'],
  outputs: {
    css: { outDir: 'output/css' },
  },
  lint: {
    rules: {
      'semantic-must-alias': { severity: 'error', collections: ['Theme'] },
      'no-duplicate-values': { severity: 'off' },
    },
  },
}
