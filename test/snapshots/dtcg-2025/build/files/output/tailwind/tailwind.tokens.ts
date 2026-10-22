import type { Config } from 'tailwindcss'

export const tokens = {
  theme: {
    extend: {
      colors: {
        'color-black': 'var(--color-black)',
        'color-white': 'var(--color-white)',
        'color-ink': 'var(--color-ink)',
        'color-sky': 'var(--color-sky)',
        'color-grass': 'var(--color-grass)',
        'color-vivid': 'var(--color-vivid)',
        'color-accent-root': 'var(--color-accent-root)',
        'color-accent-soft': 'var(--color-accent-soft)',
        'button-background': 'var(--button-background)',
        'button-text': 'var(--button-text)',
        'button-danger-background': 'var(--button-danger-background)',
        'button-danger-text': 'var(--button-danger-text)',
      },
      spacing: {
        'spacing-s': '4px',
        'spacing-m': '1rem',
        'spacing-l': '24px',
        'legacy-gap': '1rem',
      },
      borderRadius: {
        'radius-card': '8px',
      },
      transitionDuration: {
        'motion-fast': '0.15s',
        'motion-slow': '0.4s',
        'instant': '0s',
        'modal': '0s',
      },
      transitionTimingFunction: {
        'motion-ease': 'cubic-bezier(0.5, 0, 1, 1)',
      },
      fontFamily: {
        'font-body': '\'Helvetica Neue\', Arial, sans-serif',
      },
      fontWeight: {
        'font-regular': '400',
        'font-strong': '650',
      },
      font: {
        'line': '1.5',
      },
      boxShadow: {
        'shadow-card': '0px 4px 1rem 0px rgba(0, 0, 0, 0.5)',
        'shadow-stack': '0px 1px 2px 0px rgba(0, 0, 0, 0.5), inset 0px 8px 16px -4px #00000033',
      },
      border: {
        'focus': '2px solid oklch(0.7 0.15 250)',
        'dashed': '1px dashed rgba(0, 0, 0, 0.5)',
      },
      transition: {
        'enter': '0.15s cubic-bezier(0.5, 0, 1, 1) 0ms',
      },
      gradient: {
        'brand': 'oklch(0.7 0.15 250) 0%, #248f24 100%',
      },
      typography: {
        'body': '400 1rem/1.5 \'Helvetica Neue\', Arial, sans-serif',
      },
      sky-lightness: {
        'sky-lightness': '0.7',
      }
    },
  },
} satisfies Partial<Config>
