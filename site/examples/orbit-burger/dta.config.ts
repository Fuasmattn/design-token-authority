// Orbit Burger: the landing page's example product (a space burger delivery app) as a real DTA
// token set. `tokens-base/` is "main", `tokens/` is "this change" (Radius.Card 8 → 24,
// Colors.Brand.Primary Nova 500 → 600), so `dta diff --tokens-only --base tokens-base` is real.
// The site builds both states into scoped CSS with scripts/build-example.ts.
export default {
  figma: { source: 'file' },
  tokens: { dir: 'tokens' },
  brands: ['OrbitBurger'],
  outputs: {
    css: { outDir: 'output/css' },
  },
  // `dta diff --base <ref>` in this folder renders the website's Orbit Burger stories (the site
  // build, from the repository root) at both states and explains the changes by these tokens.
  diff: {
    setup: 'pnpm install --frozen-lockfile --prefer-offline',
    build: 'pnpm -C ../.. build',
    outDir: '../../dist',
    stories: { type: 'static-site', manifest: 'stories/manifest.json' },
    viewports: [1280],
  },
  lint: {
    rules: {
      'semantic-must-alias': { severity: 'error', collections: ['Brand'] },
      'no-duplicate-values': { severity: 'off' },
      'color-contrast': {
        severity: 'error',
        minRatio: 7,
        pairs: [
          ['Colors.Text.Default', 'Colors.Surface.Default'],
          ['Colors.Text.Default', 'Colors.Surface.Raised'],
          ['Colors.Text.Muted', 'Colors.Surface.Default'],
        ],
      },
    },
  },
}
