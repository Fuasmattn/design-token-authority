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
  // dta diff renders the design system stories of the built site (/stories/manifest.json).
  diff: {
    build: 'pnpm build',
    outDir: 'dist',
    stories: { type: 'static-site', manifest: 'stories/manifest.json' },
    viewports: [1280],
    // Three workflow files: the repository is public (dta init --diff).
    workflow: 'split',
    // Vercel preview of the report (project dta-diff-reports); the report workflow passes
    // VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID to this step only.
    publish: 'sh scripts/dta-diff-publish.sh',
  },
  lint: {
    rules: {
      'semantic-must-alias': { severity: 'error', collections: ['Theme'] },
      'no-duplicate-values': { severity: 'off' },
    },
  },
}
