import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      borderRadius: {
        'control-radius': '6px',
      }
    },
  },
} satisfies Partial<Config>
