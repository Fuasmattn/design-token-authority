import { describe, expect, it } from 'vitest'

import { toHex } from './color.js'
import { toSrgb } from './color-spaces.js'
import type { ColorValue } from './types.js'

const hex = (colorSpace: ColorValue['colorSpace'], components: ColorValue['components']) => {
  const { color, clipped } = toSrgb({ colorSpace, components })
  return [toHex(color), clipped]
}

describe('toSrgb: DTCG colour spaces to sRGB', () => {
  it.each([
    ['srgb', [1, 0, 0.5], '#ff0080'],
    ['srgb-linear', [1, 0.2159, 0], '#ff8000'],
    ['hsl', [120, 100, 50], '#00ff00'],
    ['hsl', ['none', 0, 100], '#ffffff'],
    ['hwb', [240, 0, 0], '#0000ff'],
    ['hwb', [0, 60, 60], '#808080'],
    ['lab', [50, 0, 0], '#777777'],
    ['lch', [50, 0, 0], '#777777'],
    ['oklab', [1, 0, 0], '#ffffff'],
    ['oklch', [0.7, 0.15, 250], '#4ba3f7'],
    ['display-p3', [1, 1, 1], '#ffffff'],
    ['a98-rgb', [1, 1, 1], '#ffffff'],
    ['prophoto-rgb', [1, 1, 1], '#ffffff'],
    ['rec2020', [1, 1, 1], '#ffffff'],
    ['xyz-d65', [0.95047, 1, 1.08883], '#ffffff'],
    ['xyz-d50', [0.96422, 1, 0.82521], '#ffffff'],
  ] as const)('converts %s %j to %s', (space, components, expected) => {
    expect(hex(space, [...components])).toEqual([expected, false])
  })

  it('clips a colour outside sRGB and says so', () => {
    expect(hex('display-p3', [1, 0, 0])).toEqual(['#ff0000', true])
    expect(hex('oklch', [0.7, 0.4, 150])[1]).toBe(true)
  })

  it('keeps alpha', () => {
    expect(toSrgb({ colorSpace: 'hsl', components: [0, 100, 50], alpha: 0.5 }).color.a).toBe(0.5)
  })
})
