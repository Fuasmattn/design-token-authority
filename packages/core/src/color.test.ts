import { describe, expect, it } from 'vitest'
import { colorsApproximatelyEqual, contrastRatio, parseColor, toHex } from './index.js'
import type { Color } from './index.js'

/** Parse a color that must be valid. */
function color(input: string): Color {
  const result = parseColor(input)
  if (!result.ok) throw new Error(result.error)
  return result.color
}

describe('parseColor', () => {
  it('parses 3-digit hex', () => {
    expect(color('#000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(color('#FFF')).toEqual({ r: 1, g: 1, b: 1 })
    expect(color('#F09')).toEqual({ r: 1, g: 0, b: 153 / 255 })
  })

  it('parses 4-digit hex with alpha', () => {
    expect(color('#0000')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    expect(color('#000F')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(color('#f09a')).toEqual({ r: 1, g: 0, b: 153 / 255, a: 170 / 255 })
  })

  it('parses 6-digit hex', () => {
    expect(color('#ffffff')).toEqual({ r: 1, g: 1, b: 1 })
    expect(color('#FF0099')).toEqual({ r: 1, g: 0, b: 153 / 255 })
  })

  it('parses 8-digit hex with alpha', () => {
    expect(color('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 })
    expect(color('#000000ff')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(color('#5EE0DCAB')).toEqual({
      r: 0.3686274509803922,
      g: 0.8784313725490196,
      b: 0.8627450980392157,
      a: 0.6705882352941176,
    })
  })

  it('ignores surrounding whitespace', () => {
    expect(color('  #fff \n')).toEqual({ r: 1, g: 1, b: 1 })
  })

  it.each(['', '#', '#0', '#00', '#0000000', '#000000000', '#hhh', 'red', '000', 'rgb(0,0,0)'])(
    'returns a failure instead of throwing for %j',
    (input) => {
      const result = parseColor(input)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('Invalid color format')
    },
  )
})

describe('toHex', () => {
  it('writes 6 digits for opaque colors', () => {
    expect(toHex({ r: 1, g: 1, b: 1 })).toBe('#ffffff')
    expect(toHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
    expect(toHex({ r: 0.5, g: 0.5, b: 0.5 })).toBe('#808080')
    expect(toHex({ r: 1, g: 1, b: 1, a: 1 })).toBe('#ffffff')
  })

  it('writes 8 digits when there is transparency', () => {
    expect(toHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080')
    expect(toHex({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 })).toBe('#80808080')
    expect(
      toHex({ r: 0.3686274509803922, g: 0.8784313725490196, b: 0.8627450980392157, a: 0 }),
    ).toBe('#5ee0dc00')
  })

  it('round-trips parsed colors', () => {
    for (const hex of ['#003f8a', '#5ee0dc', '#00000080', '#ffffff']) {
      expect(toHex(color(hex))).toBe(hex)
    }
  })
})

describe('colorsApproximatelyEqual', () => {
  it('compares by hex value, so Figma float rounding noise is ignored', () => {
    expect(colorsApproximatelyEqual({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0, a: 1 })).toBe(true)
    expect(
      colorsApproximatelyEqual({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 0, a: 0.5 }),
    ).toBe(true)
    expect(colorsApproximatelyEqual({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0, a: 0 })).toBe(false)
    expect(colorsApproximatelyEqual({ r: 0, g: 0, b: 0 }, { r: 0.001, g: 0, b: 0 })).toBe(true)
    expect(colorsApproximatelyEqual({ r: 0, g: 0, b: 0 }, { r: 0.0028, g: 0, b: 0 })).toBe(false)
  })
})

describe('contrastRatio (WCAG 2.1)', () => {
  it('is 21 for black on white, in either order', () => {
    expect(contrastRatio(color('#000000'), color('#ffffff'))).toBeCloseTo(21, 5)
    expect(contrastRatio(color('#ffffff'), color('#000000'))).toBeCloseTo(21, 5)
  })

  it('is 1 for identical colors', () => {
    expect(contrastRatio(color('#003f8a'), color('#003f8a'))).toBe(1)
  })

  it('matches known reference values', () => {
    // #777777 on white is the classic ~4.48:1 (just under AA for normal text).
    expect(contrastRatio(color('#777777'), color('#ffffff'))).toBeCloseTo(4.48, 2)
    // #767676 on white is ~4.54:1 (just over AA).
    expect(contrastRatio(color('#767676'), color('#ffffff'))).toBeCloseTo(4.54, 2)
  })
})
