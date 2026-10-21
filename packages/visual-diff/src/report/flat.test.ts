import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { decodeFlatMap, FLAT_CELL, flatMap } from './flat.js'

/** A PNG painted by `paint(x, y)` → [r, g, b]. */
function png(width: number, height: number, paint: (x: number, y: number) => number[]) {
  const image = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y)
      image.data.set([r, g, b, 255], (y * width + x) * 4)
    }
  }
  return new Uint8Array(PNG.sync.write(image))
}

describe('flatMap', () => {
  it('marks one-colour cells by colour and anything drawn as not flat', () => {
    // Paper with a navy box (8..15 × 0..7) and a one-pixel line of text at (2, 13).
    const image = png(16, 16, (x, y) =>
      x >= 8 && y < 8 ? [31, 42, 68] : x === 2 && y === 13 ? [20, 20, 20] : [245, 241, 232],
    )
    const map = flatMap(image)
    expect(map.startsWith(`${FLAT_CELL};4;4;`)).toBe(true)
    const { cells } = decodeFlatMap(map)
    expect(cells.join('')).toBe('AABBAABBAAAA.AAA')
  })

  it('takes near colours as one (antialiasing within the tolerance) and stops at the crop', () => {
    const image = png(8, 12, (x, y) => (y < 8 ? [200 + (x % 3), 200, 200] : [0, 0, 0]))
    expect(flatMap(image, 8)).toBe(`${FLAT_CELL};2;2;A4`)
    expect(flatMap(image)).toBe(`${FLAT_CELL};2;3;A4B2`)
  })

  it('runs long areas together, so a page of paper stays small', () => {
    const map = flatMap(png(1280, 400, () => [245, 241, 232]))
    expect(map).toBe(`${FLAT_CELL};320;100;A32000`)
  })
})
