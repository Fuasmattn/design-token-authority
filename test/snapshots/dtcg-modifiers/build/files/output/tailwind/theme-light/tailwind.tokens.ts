import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      colors: {
        'surface': '#ffffff',
        'text': '#111827',
        'ring': '#111827',
      }
    },
  },
} satisfies Partial<Config>
