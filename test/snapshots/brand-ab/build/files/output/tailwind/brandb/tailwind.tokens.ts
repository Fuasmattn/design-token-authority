import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      colors: {
        'brand-primary': '#2e9e5b',
        'brand-primary-dark': '#1f7a43',
        'brand-accent': '#e8731a',
        'surface-default': '#ffffff',
        'surface-muted': '#f3f4f6',
        'text-default': '#111827',
        'text-muted': '#6b7280',
        'text-on-primary': '#ffffff',
      },
      opacity: {
        'effects-overlay-opacity': '0.5',
      },
      blur: {
        'effects-shadow-blur': '12px',
      },
      fontFamily: {
        'typography-body-family': 'Source Serif 4',
      }
    },
  },
} satisfies Partial<Config>
