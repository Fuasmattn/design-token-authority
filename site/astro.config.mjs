// @ts-check
import preact from '@astrojs/preact'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightLinksValidator from 'starlight-links-validator'
import { CUSTOM_PAGES } from './custom-pages.mjs'
import { SIDEBAR } from './sidebar.mjs'
import { SITE_URL } from './site-url.mjs'

export default defineConfig({
  // The sitemap and canonical links (TICKET-075).
  site: SITE_URL,
  vite: {
    build: {
      rolldownOptions: {
        // Keep the bundler's shared helpers out of the lazy chunks (TICKET-124). By default
        // Rolldown merges common code into a chunk that already needs it: its namespace helper
        // went into the playground's outputs engine (Style Dictionary, 600 KB gzip), and the
        // analysis chunk, which needs the same helper, then imported the whole engine. Off, the
        // helper stays in a small chunk of its own; the site's other chunks are unchanged.
        experimental: { chunkOptimization: { mergeCommonChunks: false } },
      },
    },
  },
  integrations: [
    // The playground's island (spec: docs/specs/playground.md decision 13). Only the playground
    // page hydrates a Preact component; stories render the same components to static HTML.
    preact(),
    starlight({
      title: 'Design Token Authority',
      description:
        'The deterministic backbone for design token workflows, built for humans and agents.',
      plugins: [starlightLinksValidator({ exclude: CUSTOM_PAGES })],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/Fuasmattn/design-token-authority',
        },
        {
          icon: 'npm',
          label: 'npm',
          href: 'https://www.npmjs.com/package/design-token-authority',
        },
      ],
      customCss: [
        './output/css/base.css',
        './output/css/themes/light.css',
        './output/css/themes/graphite.css',
        './output/css/examples/orbit-burger.css',
        './src/styles/fonts.css',
        './src/styles/theme.css',
      ],
      components: {
        ThemeProvider: './src/components/ThemeProvider.astro',
      },
      sidebar: SIDEBAR,
    }),
  ],
})
