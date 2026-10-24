import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      colors: {
        'surface-base': '#ffffff',
        'surface-muted': '#f3f4f6',
        'text-default': '#111827',
        'accent': 'oklch(0.55 0.18 255)',
      }
    },
  },
} satisfies Partial<Config>
