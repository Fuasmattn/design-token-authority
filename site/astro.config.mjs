// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightLinksValidator from 'starlight-links-validator'

export default defineConfig({
  integrations: [
    starlight({
      title: 'Design Token Authority',
      description:
        'The deterministic backbone for design token workflows, built for humans and agents.',
      plugins: [starlightLinksValidator()],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/Fuasmattn/design-token-authority',
        },
      ],
      customCss: [
        './output/css/base.css',
        './output/css/themes/light.css',
        './output/css/themes/graphite.css',
        './src/styles/fonts.css',
        './src/styles/theme.css',
      ],
      components: {
        ThemeProvider: './src/components/ThemeProvider.astro',
      },
      sidebar: [
        { label: 'Start', items: [{ autogenerate: { directory: 'start' } }] },
        { label: 'Learn', items: [{ autogenerate: { directory: 'learn' } }] },
        { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
        { label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
        { label: 'Design system', items: [{ autogenerate: { directory: 'design-system' } }] },
        { label: 'Playground', items: [{ autogenerate: { directory: 'playground' } }] },
        { label: 'Contribute', items: [{ autogenerate: { directory: 'contribute' } }] },
      ],
    }),
  ],
})
