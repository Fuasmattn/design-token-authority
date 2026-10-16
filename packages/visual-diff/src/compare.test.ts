import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { compareImages, compareStories, type StoryRef } from './index.js'

/** A solid PNG, optionally with some pixels in another colour. */
function png(
  width: number,
  height: number,
  rgb: [number, number, number],
  spots: Array<[number, number, [number, number, number]]> = [],
): Uint8Array {
  const image = new PNG({ width, height })
  for (let i = 0; i < width * height; i++) {
    image.data.set([...rgb, 255], i * 4)
  }
  for (const [x, y, color] of spots) image.data.set([...color, 255], (y * width + x) * 4)
  return PNG.sync.write(image)
}

const WHITE: [number, number, number] = [255, 255, 255]
const BLUE: [number, number, number] = [47, 85, 212]

describe('compareImages', () => {
  it('finds no change between identical images', () => {
    const result = compareImages(png(10, 10, WHITE), png(10, 10, WHITE))
    expect(result).toMatchObject({ width: 10, height: 10, changedPixels: 0, ratio: 0 })
    expect(result.sizeChanged).toBe(false)
  })

  it('counts changed pixels and returns a diff image of the same size', () => {
    const result = compareImages(png(10, 10, WHITE), png(10, 10, WHITE, [[3, 4, BLUE]]))
    expect(result.changedPixels).toBe(1)
    expect(result.ratio).toBeCloseTo(0.01)
    const diff = PNG.sync.read(Buffer.from(result.diff))
    expect([diff.width, diff.height]).toEqual([10, 10])
    expect(result.mask[4 * 10 + 3]).toBe(1)
    expect(result.mask.reduce((a, b) => a + b, 0)).toBe(1)
    // The changed pixel is painted in redline orange.
    expect([...diff.data.subarray((4 * 10 + 3) * 4, (4 * 10 + 3) * 4 + 3)]).toEqual([232, 99, 42])
  })

  it('sees small colour changes by default, and ignores them with a colour tolerance', () => {
    // blueprint-600 → blueprint-700: one step of a scale, below pixelmatch's usual 0.1.
    const before = png(4, 4, [47, 85, 212])
    const after = png(4, 4, [36, 67, 172])
    expect(compareImages(before, after).changedPixels).toBe(16)
    const almostWhite: [number, number, number] = [254, 254, 254]
    expect(compareImages(png(4, 4, WHITE), png(4, 4, almostWhite)).changedPixels).toBe(16)
    expect(
      compareImages(png(4, 4, WHITE), png(4, 4, almostWhite), { colorThreshold: 0.1 })
        .changedPixels,
    ).toBe(0)
  })

  it('compares images of different sizes on the larger canvas', () => {
    const result = compareImages(png(10, 10, WHITE), png(10, 12, WHITE))
    expect(result).toMatchObject({ width: 10, height: 12, sizeChanged: true })
    expect(result.changedPixels).toBeGreaterThan(0)
  })
})

describe('compareStories', () => {
  const story = (id: string, viewports = [100]): StoryRef => ({
    id,
    title: id,
    url: `/stories/${id}/`,
    viewports,
  })
  const images: Record<string, Uint8Array> = {
    'base:same': png(8, 8, WHITE),
    'head:same': png(8, 8, WHITE),
    'base:card': png(8, 8, WHITE),
    'head:card': png(8, 8, WHITE, [
      [0, 0, BLUE],
      [1, 0, BLUE],
    ]),
    'head:new': png(8, 8, BLUE),
    'base:gone': png(8, 8, BLUE),
  }
  const capture = async (side: 'base' | 'head', s: StoryRef) => images[`${side}:${s.id}`] ?? null

  it('classifies stories as unchanged, changed, added and removed', async () => {
    const results = await compareStories({
      base: [story('same'), story('card'), story('gone')],
      head: [story('same'), story('card'), story('new')],
      capture,
      threshold: 0,
    })
    expect(results.map((r) => `${r.id}:${r.status}`)).toEqual([
      'same:unchanged',
      'card:changed',
      'new:added',
      'gone:removed',
    ])
    const card = results.find((r) => r.id === 'card')!
    expect(card.changedPixels).toBe(2)
    expect(card.images.diff).toBeInstanceOf(Uint8Array)
    expect(results.find((r) => r.id === 'same')!.images.diff).toBeUndefined()
  })

  it('treats a change within the threshold as unchanged', async () => {
    const [card] = await compareStories({
      base: [story('card')],
      head: [story('card')],
      capture,
      threshold: 0.05, // 2 of 64 pixels = 0.031
    })
    expect(card.status).toBe('unchanged')
    expect(card.ratio).toBeCloseTo(2 / 64)
  })

  it('attributes changed stories only, with their comparison', async () => {
    const seen: string[] = []
    const results = await compareStories({
      base: [story('same'), story('card')],
      head: [story('same'), story('card')],
      capture,
      threshold: 0,
      attribute: async (s, viewport, comparison) => {
        seen.push(`${s.id}@${viewport}:${comparison.mask.reduce((a, b) => a + b, 0)}`)
        return {
          explained: true,
          tokens: [],
          unexplainedPixels: 0,
          canvas: { width: 8, height: 8 },
        }
      },
    })
    expect(seen).toEqual(['card@100:2'])
    expect(results[0].attribution).toBeUndefined()
    expect(results[1].attribution?.explained).toBe(true)
  })

  it('renders each viewport of a story', async () => {
    const seen: string[] = []
    await compareStories({
      base: [story('same', [100, 50])],
      head: [story('same', [100, 50])],
      capture: async (side, s, viewport) => {
        seen.push(`${side}@${viewport}`)
        return images[`${side}:${s.id}`]
      },
      threshold: 0,
    })
    expect(seen).toEqual(['head@100', 'base@100', 'head@50', 'base@50'])
  })
})
