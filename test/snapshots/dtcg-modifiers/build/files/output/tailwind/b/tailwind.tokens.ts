import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      borderRadius: {
        'control-radius': '999px',
      }
    },
  },
} satisfies Partial<Config>
