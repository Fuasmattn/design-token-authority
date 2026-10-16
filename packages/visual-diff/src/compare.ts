import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import type { StoryRef } from './stories.js'

/** The redline orange of DTA Drafting Table, for changed pixels in diff images. */
const DIFF_COLOR: [number, number, number] = [232, 99, 42]
/** redline-200, for anti-aliased pixels (shown, not counted). */
const AA_COLOR: [number, number, number] = [255, 207, 178]

export interface ImageComparison {
  width: number
  height: number
  changedPixels: number
  /** Changed pixels / all pixels of the larger image, 0–1. */
  ratio: number
  /** The two images had different sizes (the missing area counts as changed). */
  sizeChanged: boolean
  /** PNG: the head image faded, changed pixels in redline orange. */
  diff: Uint8Array
}

/** Copies a PNG onto a canvas of the given size (transparent where it is smaller). */
function pad(image: PNG, width: number, height: number): PNG {
  if (image.width === width && image.height === height) return image
  const padded = new PNG({ width, height })
  PNG.bitblt(image, padded, 0, 0, image.width, image.height, 0, 0)
  return padded
}

/**
 * Compares two PNGs pixel by pixel. Images of different sizes are compared on the larger
 * canvas; the area only one of them covers counts as changed. `colorThreshold` is pixelmatch's
 * per-pixel colour tolerance (0–1, smaller is stricter). It defaults to 0: a token change from
 * one blue to the next step of the same scale is below pixelmatch's usual 0.1, and DTA must see
 * it. Anti-aliased pixels are still ignored.
 */
export function compareImages(
  before: Uint8Array,
  after: Uint8Array,
  options: { colorThreshold?: number } = {},
): ImageComparison {
  const a = PNG.sync.read(Buffer.from(before))
  const b = PNG.sync.read(Buffer.from(after))
  const width = Math.max(a.width, b.width)
  const height = Math.max(a.height, b.height)
  const left = pad(a, width, height)
  const right = pad(b, width, height)
  const diff = new PNG({ width, height })
  let changedPixels = pixelmatch(left.data, right.data, diff.data, width, height, {
    threshold: options.colorThreshold ?? 0,
    diffColor: DIFF_COLOR,
    aaColor: AA_COLOR,
    alpha: 0.2,
  })
  const sizeChanged = a.width !== b.width || a.height !== b.height
  // Padding is transparent on both sides where neither image reaches; where only one reaches,
  // pixelmatch already counts the pixels as different unless both are transparent there.
  if (sizeChanged && changedPixels === 0) changedPixels = 1
  return {
    width,
    height,
    changedPixels,
    ratio: width * height === 0 ? 0 : changedPixels / (width * height),
    sizeChanged,
    diff: PNG.sync.write(diff),
  }
}

export type StoryStatus = 'unchanged' | 'changed' | 'added' | 'removed'

export interface StoryResult {
  id: string
  title: string
  url: string
  viewport: number
  status: StoryStatus
  ratio: number
  changedPixels: number
  /** PNGs; absent on the side where the story does not exist. */
  images: { base?: Uint8Array; head?: Uint8Array; diff?: Uint8Array }
}

/** Renders one story at one width on one side; `null` if it cannot be rendered there. */
export type CaptureStory = (
  side: 'base' | 'head',
  story: StoryRef,
  viewport: number,
) => Promise<Uint8Array | null>

/**
 * Captures every story of the base and the head at each of its viewports and compares them.
 * A story only in the head is `added`, only in the base `removed`; otherwise it is `changed`
 * when its changed-pixel ratio exceeds `threshold`.
 */
export async function compareStories(options: {
  base: StoryRef[]
  head: StoryRef[]
  capture: CaptureStory
  threshold: number
  colorThreshold?: number
}): Promise<StoryResult[]> {
  const baseById = new Map(options.base.map((story) => [story.id, story]))
  const headIds = new Set(options.head.map((story) => story.id))
  const results: StoryResult[] = []

  for (const story of options.head) {
    const before = baseById.get(story.id)
    for (const viewport of story.viewports) {
      const head = await options.capture('head', story, viewport)
      const base = before ? await options.capture('base', before, viewport) : null
      const entry = { id: story.id, title: story.title, url: story.url, viewport }
      if (!head) throw new Error(`Could not render ${story.url} at ${viewport}px in the head`)
      if (!base) {
        results.push({ ...entry, status: 'added', ratio: 1, changedPixels: 0, images: { head } })
        continue
      }
      const comparison = compareImages(base, head, { colorThreshold: options.colorThreshold })
      const changed = comparison.changedPixels > 0 && comparison.ratio > options.threshold
      results.push({
        ...entry,
        status: changed ? 'changed' : 'unchanged',
        ratio: comparison.ratio,
        changedPixels: comparison.changedPixels,
        images: { base, head, ...(changed ? { diff: comparison.diff } : {}) },
      })
    }
  }
  for (const story of options.base.filter((s) => !headIds.has(s.id))) {
    for (const viewport of story.viewports) {
      const base = await options.capture('base', story, viewport)
      results.push({
        id: story.id,
        title: story.title,
        url: story.url,
        viewport,
        status: 'removed',
        ratio: 1,
        changedPixels: 0,
        images: base ? { base } : {},
      })
    }
  }
  return results
}
