import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      colors: {
        'brand-primary': 'oklch(0.7 0.15 250)',
        'brand-on-primary': '#ffffff',
        'brand-surface': '#ffffff',
      },
      boxShadow: {
        'elevation-raised': '0px 4px 1rem 0px rgba(0, 0, 0, 0.5)',
      }
    },
  },
} satisfies Partial<Config>
