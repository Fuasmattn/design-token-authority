import { describe, expect, it } from 'vitest'
import { PLACEMENT_JS } from './placement.js'

type Rect = [number, number, number, number]
type Spot = { x: number; y: number; covers: boolean }
const lib = new Function(`${PLACEMENT_JS}; return { markerSpot, groupKeys }`)() as {
  markerSpot: (
    ring: { l: number; t: number; r: number; b: number },
    size: { w: number; h: number },
    W: number,
    H: number,
    ok: (x: number, y: number, w: number, h: number) => boolean,
  ) => Spot
  groupKeys: <T extends { n: number; sig: string }>(
    items: T[],
  ) => Array<{ ns: number[]; items: T[] }>
}

/** `ok` for a canvas whose content sits in `content` rects (everything else is flat paper). */
const flatExcept =
  (...content: Rect[]) =>
  (x: number, y: number, w: number, h: number) =>
    !content.some((c) => x < c[2] && c[0] < x + w && y < c[3] && c[1] < y + h)

const ring = { l: 100, t: 100, r: 200, b: 140 }
const size = { w: 20, h: 20 }

describe('markerSpot', () => {
  it('sits on the outer edge above the left corner when that is flat', () => {
    expect(lib.markerSpot(ring, size, 400, 300, flatExcept())).toEqual({
      x: 100,
      y: 78,
      covers: false,
    })
  })

  it('moves along the edge, away from content ("this change" above the box)', () => {
    // A label above the left half of the box: the middle of the top edge is taken too, so the
    // marker goes to the top right corner.
    const label = [90, 70, 160, 98] as Rect
    expect(lib.markerSpot(ring, size, 400, 300, flatExcept(label))).toEqual({
      x: 180,
      y: 78,
      covers: false,
    })
    // Content all along the top: the right side.
    const band = [0, 60, 400, 98] as Rect
    expect(lib.markerSpot(ring, size, 400, 300, flatExcept(band))).toEqual({
      x: 202,
      y: 100,
      covers: false,
    })
  })

  it('stays inside the canvas: a box at the top left corner gets its marker below or beside', () => {
    const corner = { l: 0, t: 0, r: 60, b: 30 }
    expect(lib.markerSpot(corner, size, 400, 300, flatExcept())).toEqual({
      x: 62,
      y: 0,
      covers: false,
    })
  })

  it('falls back to a flat spot farther out when the whole edge is taken', () => {
    // Content in a 30 px ring around the box: the first flat spot is beyond it.
    const around = [70, 70, 230, 170] as Rect
    const spot = lib.markerSpot(ring, size, 400, 300, (x, y, w, h) =>
      flatExcept(around)(x, y, w, h),
    )
    expect(spot.covers).toBe(false)
    expect(flatExcept(around)(spot.x, spot.y, 20, 20)).toBe(true)
    // The first one: top side, from its left end, right above the content (70 - 20 px).
    expect(spot).toEqual({ x: 50, y: 50, covers: false })
  })

  it('says so when no flat spot exists near the box', () => {
    expect(lib.markerSpot(ring, size, 400, 300, () => false)).toEqual({
      x: 100,
      y: 78,
      covers: true,
    })
  })
})

describe('groupKeys', () => {
  it('gives boxes with the same set of token changes one entry, others their own', () => {
    const items = [
      { n: 1, sig: 'Colors.Brand.Primary|Radius.Card' },
      { n: 2, sig: 'Radius.Card' },
      { n: 3, sig: 'Colors.Brand.Primary|Radius.Card' },
      { n: 4, sig: 'unexplained' },
    ]
    expect(lib.groupKeys(items).map((g) => g.ns)).toEqual([[1, 3], [2], [4]])
    expect(lib.groupKeys(items)[0].items).toEqual([items[0], items[2]])
  })
})
