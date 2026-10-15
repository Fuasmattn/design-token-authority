import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      colors: {
        'foundation-blue-500': 'var(--colors-foundation-blue-500)',
        'foundation-blue-700': 'var(--colors-foundation-blue-700)',
        'foundation-green-500': 'var(--colors-foundation-green-500)',
        'foundation-green-700': 'var(--colors-foundation-green-700)',
        'foundation-orange-500': 'var(--colors-foundation-orange-500)',
        'foundation-gray-100': 'var(--colors-foundation-gray-100)',
        'foundation-gray-500': 'var(--colors-foundation-gray-500)',
        'foundation-gray-900': 'var(--colors-foundation-gray-900)',
        'foundation-white': 'var(--colors-foundation-white)',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '4': '16px',
        '8': '32px',
      },
      borderRadius: {
        'dimensions-radius-sm': '4px',
        'dimensions-radius-md': '8px',
        'dimensions-radius-pill': '999px',
      },
      opacity: {
        '50': '0.5',
        '80': '0.8',
      },
      blur: {
        'sm': '4px',
        'md': '12px',
      },
      fontFamily: {
        'typography-fontfamily-sans': 'Inter',
        'typography-fontfamily-serif': 'Source Serif 4',
      },
      fontSize: {
        'typography-fontsize-sm': '14',
        'typography-fontsize-md': '16',
        'typography-fontsize-lg': '20',
        'typography-fontsize-xl': '28',
      }
    },
  },
} satisfies Partial<Config>
