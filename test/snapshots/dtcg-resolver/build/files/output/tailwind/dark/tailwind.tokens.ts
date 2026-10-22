import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      colors: {
        'surface-base': '#111827',
        'surface-muted': '#1f2937',
        'text-default': '#f3f4f6',
        'accent': 'oklch(0.8 0.1 255)',
      }
    },
  },
} satisfies Partial<Config>
