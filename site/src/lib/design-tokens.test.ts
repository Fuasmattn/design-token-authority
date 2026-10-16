import { describe, expect, it } from 'vitest'
import {
  colorScales,
  cssVar,
  dimension,
  fontFamilies,
  semanticColors,
  typeStyles,
} from './design-tokens.js'

describe('design tokens for the Design system pages', () => {
  it('names CSS variables the way dta build does', () => {
    expect(cssVar(['bg', 'canvas'])).toBe('--bg-canvas')
    expect(cssVar(['type', 'display-xl', 'size'])).toBe('--type-display-xl-size')
  })

  it('lists every semantic colour with its value and alias chain per theme', () => {
    const colors = semanticColors()
    expect(colors).toHaveLength(23)
    const canvas = colors.find((c) => c.name === 'bg-canvas')!
    expect(canvas).toEqual({
      name: 'bg-canvas',
      cssVar: '--bg-canvas',
      usage: 'Page background.',
      themes: {
        Light: { value: '#f5f1e8', chain: ['paper.100'] },
        Graphite: { value: '#161513', chain: ['graphite.900'] },
      },
    })
  })

  it('groups colour primitives by scale', () => {
    expect(colorScales().map((s) => s.scale)).toEqual([
      'paper',
      'ink',
      'graphite',
      'blueprint',
      'redline',
      'sage',
    ])
    expect(colorScales().find((s) => s.scale === 'blueprint')!.tokens[6]).toMatchObject({
      name: 'blueprint-600',
      value: '#2f55d4',
    })
  })

  it('reads spacing, radius and stroke in px', () => {
    expect(dimension('space').map((t) => t.value)).toEqual([4, 8, 12, 16, 24, 32, 48, 64, 96])
    expect(dimension('radius').map((t) => t.name)).toEqual([
      'radius-sm',
      'radius-md',
      'radius-lg',
      'radius-full',
    ])
    expect(dimension('stroke').find((t) => t.name === 'stroke-redline')!.value).toBe(1.5)
  })

  it('assembles the type scale from its tokens', () => {
    const styles = typeStyles()
    expect(styles.map((s) => s.name)).toEqual([
      'display-xl',
      'display-lg',
      'heading',
      'title',
      'body-lg',
      'body',
      'body-sm',
      'label',
      'code',
      'meta',
      'redline',
    ])
    expect(styles[0]).toMatchObject({
      size: 84,
      lineHeight: 0.95,
      weight: 700,
      letterSpacing: '-0.03em',
      cssPrefix: '--type-display-xl',
    })
    expect(fontFamilies().map((f) => f.name)).toEqual(['font-sans', 'font-mono'])
  })
})
