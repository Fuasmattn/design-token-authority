/**
 * Example content never uses the system colours (TICKET-122): sample tokens, the stories' example
 * UI, the fixtures shown in the playground and the docs, and the `dta diff` report's example data
 * are blue or neutral grey. An orange example reads as "changed" (signal), a green one as a pass, a
 * red one as an error, a yellow one as a warning. This test reads every colour value of those
 * sources and fails on a saturated hue in the red, orange, yellow or green range.
 *
 * Not covered, by decision: the gravity well's orange objects (the key visual, excluded by token
 * name), the report's pixel-diff overlay (report UI, not an example) and the daisyUI fixture (a
 * third-party export kept as published).
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = path.join(import.meta.dirname, '..')

/** Tokens of the key visual: decoration, allowed to be orange (TICKET-110). */
const KEY_VISUAL = /well[-.]object[-.]orange/

/** Below this chroma (max - min channel, 0..1) a colour counts as a neutral grey. */
const NEUTRAL_CHROMA = 0.12

type Rgb = [number, number, number]

/** HSV hue in degrees and chroma (0..1) of an sRGB colour (channels 0..255). */
function hueOf([r, g, b]: Rgb): { hue: number; chroma: number } {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = (max - min) / 255
  if (max === min) return { hue: 0, chroma }
  const d = max - min
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  hue *= 60
  if (hue < 0) hue += 360
  return { hue, chroma }
}

/**
 * The hue family a colour belongs to when it is one example content must not use, or null.
 * Red 330°–15°, orange 15°–45°, yellow 45°–70°, green 70°–170°; blues, violets and greys pass.
 */
function offSystemHue(rgb: Rgb): string | null {
  const { hue, chroma } = hueOf(rgb)
  if (chroma < NEUTRAL_CHROMA) return null
  if (hue >= 330 || hue < 15) return 'red'
  if (hue < 45) return 'orange'
  if (hue < 70) return 'yellow'
  if (hue < 170) return 'green'
  return null
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
}

interface Found {
  where: string
  value: string
  rgb: Rgb
}

const HEX = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g
const RGB = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g

/** Colour literals (6- or 8-digit hex, rgb()) in a text file, line by line. */
function colorsInText(file: string): Found[] {
  const rel = path.relative(repo, file)
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, i) => {
      if (KEY_VISUAL.test(line)) return []
      const where = `${rel}:${i + 1}`
      return [
        ...[...line.matchAll(HEX)].map((m) => ({ where, value: m[0], rgb: hexToRgb(m[0]) })),
        ...[...line.matchAll(RGB)].map((m) => ({
          where,
          value: m[0],
          rgb: [Number(m[1]), Number(m[2]), Number(m[3])] as Rgb,
        })),
      ]
    })
}

/** Colour values of a token file (DTCG `$value`) or a Figma recording (`{ r, g, b }` in 0..1). */
function colorsInJson(file: string): Found[] {
  const rel = path.relative(repo, file)
  const found: Found[] = []
  const walk = (node: unknown, at: string[]): void => {
    if (KEY_VISUAL.test(at.join('.'))) return
    if (Array.isArray(node)) return node.forEach((child, i) => walk(child, [...at, String(i)]))
    if (!node || typeof node !== 'object') {
      if (typeof node === 'string') {
        for (const m of node.matchAll(HEX)) {
          found.push({ where: `${rel} ${at.join('.')}`, value: m[0], rgb: hexToRgb(m[0]) })
        }
      }
      return
    }
    const record = node as Record<string, unknown>
    if (['r', 'g', 'b'].every((k) => typeof record[k] === 'number')) {
      const rgb = (['r', 'g', 'b'] as const).map((k) => Math.round((record[k] as number) * 255))
      found.push({ where: `${rel} ${at.join('.')}`, value: `rgb(${rgb})`, rgb: rgb as Rgb })
      return
    }
    for (const [key, child] of Object.entries(record)) walk(child, [...at, key])
  }
  walk(JSON.parse(fs.readFileSync(file, 'utf8')), [])
  return found
}

function filesIn(dir: string, keep: (file: string) => boolean): string[] {
  return fs
    .readdirSync(path.join(repo, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter(keep)
    .sort()
}

const json = (file: string) => file.endsWith('.json')
const notDaisy = (file: string) => !file.includes(`${path.sep}daisyui${path.sep}`)

const SOURCES = {
  'token fixtures (brand-ab, brand-ab-problems)': () =>
    filesIn('test/fixtures', (f) => json(f) && notDaisy(f)).flatMap(colorsInJson),
  'fixture sources (dta audit)': () =>
    filesIn('test/fixtures', (f) => notDaisy(f) && /\.(css|tsx?)$/.test(f)).flatMap(colorsInText),
  'Figma recordings of brand-ab': () => filesIn('test/recordings', json).flatMap(colorsInJson),
  'Orbit Burger token sets': () => filesIn('site/examples', json).flatMap(colorsInJson),
  'story examples and example components': () =>
    [
      ...filesIn('site/src/examples', (f) => /\.(astro|ts)$/.test(f) && !f.endsWith('.test.ts')),
      path.join(repo, 'site/src/components/ds/ExampleButton.astro'),
      path.join(repo, 'site/src/components/ds/TokenRows.astro'),
      path.join(repo, 'site/src/landing/content.ts'),
    ].flatMap(colorsInText),
  'docs samples (Start, Guides, Reference, Contribute)': () =>
    filesIn(
      'site/src/content/docs',
      (f) => f.endsWith('.mdx') && !f.includes(`${path.sep}design-system${path.sep}`),
    ).flatMap(colorsInText),
  'dta diff report test data': () =>
    [
      ...filesIn('packages/visual-diff/src', (f) => f.endsWith('.test.ts')),
      path.join(repo, 'packages/cli/test/diff-visual.test.ts'),
      path.join(repo, 'site/contrast.e2e.test.ts'),
    ].flatMap(colorsInText),
}

describe('example colours (TICKET-122)', () => {
  it('flags the hues of the system colours and lets blues and greys pass', () => {
    // The old example colours, the system colours and their neighbours.
    for (const hex of ['#e8731a', '#2e9e5b', '#1f7a43', '#d1342f', '#ff7a1a', '#9bebcb']) {
      expect(offSystemHue(hexToRgb(hex)), hex).not.toBeNull()
    }
    for (const hex of ['#e8632a', '#c42b30', '#7d5a00', '#f0c64a', '#3c7646', '#ffcc00']) {
      expect(offSystemHue(hexToRgb(hex)), hex).not.toBeNull()
    }
    // Blues, a violet-blue surface and greys, warm or cool.
    for (const hex of ['#0057b8', '#3d5a80', '#3b8fd9', '#7d8ea3', '#15122b', '#5aa2ff']) {
      expect(offSystemHue(hexToRgb(hex)), hex).toBeNull()
    }
    for (const hex of ['#6b7280', '#f3f4f6', '#f6f2ea', '#111827', '#ffffff', '#000000']) {
      expect(offSystemHue(hexToRgb(hex)), hex).toBeNull()
    }
  })

  it.each(Object.keys(SOURCES))('%s: only blues and neutral greys', (name) => {
    const found = SOURCES[name as keyof typeof SOURCES]()
    // Each source has colours to check, so the scan cannot pass by finding nothing.
    expect(found.length).toBeGreaterThan(0)
    const off = found
      .map((f) => ({ ...f, hue: offSystemHue(f.rgb) }))
      .filter((f) => f.hue !== null)
      .map((f) => `${f.where}: ${f.value} (${f.hue})`)
    expect(off).toEqual([])
  })

  it('excludes the key visual by name only', () => {
    expect(KEY_VISUAL.test('--well-object-orange: var(--redline-500);')).toBe(true)
    expect(KEY_VISUAL.test('well.object.orange-light')).toBe(true)
    expect(KEY_VISUAL.test('Colors.Brand.Accent')).toBe(false)
  })
})
