import type { Config } from 'style-dictionary/types'
import { tailwindV3Formatter } from './formatters/tailwind-v3.js'
import { tailwindV4Formatter } from './formatters/tailwind-v4.js'

/** Figma scopes of number tokens that mean "a length in pixels". */
const PIXEL_SCOPES = new Set([
  'GAP',
  'WIDTH_HEIGHT',
  'CORNER_RADIUS',
  'STROKE_FLOAT',
  'EFFECT_FLOAT',
])

const CSS_BASE_TRANSFORMS = [
  'attribute/cti',
  'time/seconds',
  'html/icon',
  'size/rem',
  'color/css',
  'asset/url',
  'fontFamily/css',
  'cubicBezier/css',
  'strokeStyle/css/shorthand',
  'border/css/shorthand',
  'typography/css/shorthand',
  'transition/css/shorthand',
  'shadow/css/shorthand',
]

const scopesOf = (token: unknown): string[] => {
  const extensions = (token as { $extensions?: Record<string, unknown> }).$extensions
  const figma = extensions?.['com.figma'] as { scopes?: string[] } | undefined
  return figma?.scopes ?? []
}

export const CSS_TRANSFORM_GROUP = 'design-system/css'

/** Hooks registered per Style Dictionary instance (no global state). */
export const hooks: NonNullable<Config['hooks']> = {
  transforms: {
    'name/kebab-deduped': {
      type: 'name',
      transform: (token) => {
        const kebab = token.path
          .map((segment: string) =>
            segment
              .toLowerCase()
              .replace(/[^a-z0-9-]+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, ''),
          )
          .join('-')
        const parts = kebab.split('-').filter(Boolean)
        return parts.filter((part, i) => i === 0 || part !== parts[i - 1]).join('-')
      },
    },
    'value/dimension-px': {
      type: 'value',
      filter: (token) =>
        token.$type === 'number' && scopesOf(token).some((scope) => PIXEL_SCOPES.has(scope)),
      transform: (token) => `${token.$value}px`,
    },
    'value/opacity-decimal': {
      type: 'value',
      filter: (token) => token.$type === 'number' && scopesOf(token).includes('OPACITY'),
      transform: (token) => String(Number(token.$value) / 100),
    },
  },
  formats: {
    'tailwind/v3': tailwindV3Formatter,
    'tailwind/v4': tailwindV4Formatter,
  },
  transformGroups: {
    [CSS_TRANSFORM_GROUP]: [
      ...CSS_BASE_TRANSFORMS,
      'name/kebab-deduped',
      'value/dimension-px',
      'value/opacity-decimal',
    ],
  },
}
