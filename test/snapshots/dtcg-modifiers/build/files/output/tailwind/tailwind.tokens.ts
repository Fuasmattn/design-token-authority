import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      colors: {
        'button-background': 'var(--button-background)',
        'button-text': 'var(--button-text)',
        'color-blue-300': 'var(--color-blue-300)',
        'color-blue-500': 'var(--color-blue-500)',
        'color-navy-700': 'var(--color-navy-700)',
        'color-gray-0': 'var(--color-gray-0)',
        'color-gray-100': 'var(--color-gray-100)',
        'color-gray-900': 'var(--color-gray-900)',
      },
      borderRadius: {
        'button-radius': '6px',
        'radius-m': '6px',
        'radius-full': '999px',
      }
    },
  },
} satisfies Partial<Config>
