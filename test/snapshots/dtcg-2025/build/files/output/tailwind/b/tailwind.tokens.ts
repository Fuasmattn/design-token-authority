import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      colors: {
        'brand-primary': '#248f24',
        'brand-on-primary': '#ffffff',
        'brand-surface': '#ffffff',
      },
      boxShadow: {
        'elevation-raised': '0px 1px 2px 0px rgba(0, 0, 0, 0.5), inset 0px 8px 16px -4px #00000033',
      }
    },
  },
} satisfies Partial<Config>
