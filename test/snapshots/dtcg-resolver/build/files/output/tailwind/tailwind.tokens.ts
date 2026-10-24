import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      colors: {
        'button-background': 'var(--button-background)',
        'button-text': 'var(--button-text)',
        'color-blue': 'var(--color-blue)',
        'color-blue-light': 'var(--color-blue-light)',
        'color-gray-0': 'var(--color-gray-0)',
        'color-gray-100': 'var(--color-gray-100)',
        'color-gray-900': 'var(--color-gray-900)',
      },
      borderRadius: {
        'button-radius': '6px',
        'size-radius': '6px',
      },
      boxShadow: {
        'button-shadow': '0px 4px 8px 0px #111827',
      },
      size: {
        's': '4px',
        'm': '8px',
      }
    },
  },
} satisfies Partial<Config>
