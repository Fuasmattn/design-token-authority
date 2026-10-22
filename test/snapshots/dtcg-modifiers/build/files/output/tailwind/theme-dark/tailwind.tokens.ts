import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      colors: {
        'surface': '#111827',
        'text': '#f3f4f6',
        'ring': '#93c5fd',
      }
    },
  },
} satisfies Partial<Config>
