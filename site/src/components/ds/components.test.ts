import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = import.meta.dirname
/**
 * Each component with everything that styles it: an `.astro` file, or a Preact `.tsx` (the
 * playground island), plus its stylesheet `<Name>.css` when there is one.
 */
const read = (name: string) =>
  fs.existsSync(path.join(dir, name)) ? fs.readFileSync(path.join(dir, name), 'utf8') : ''
const sources = fs
  .readdirSync(dir)
  .filter((name) => /\.(astro|tsx)$/.test(name) && !name.endsWith('.test.tsx'))
  .map((name) => [name, read(name) + '\n' + read(name.replace(/\.(astro|tsx)$/, '.css'))] as const)

it('covers the Preact components and their stylesheets', () => {
  expect(sources.map(([name]) => name)).toEqual(expect.arrayContaining(['TokenInput.tsx']))
  const css = fs.readdirSync(dir).filter((name) => name.endsWith('.css'))
  for (const file of css) {
    const owner = file.replace(/\.css$/, '')
    expect(
      fs.existsSync(path.join(dir, `${owner}.astro`)) ||
        fs.existsSync(path.join(dir, `${owner}.tsx`)),
      `${file} belongs to a component`,
    ).toBe(true)
  }
})

describe('design system components', () => {
  it.each(sources)('%s uses token variables, no colour literals', (_name, source) => {
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
    expect(source).toMatch(/var\(--/)
  })

  // One surface: grid paper only where something is inspected (the redline stage, the card's
  // stage variant), never as a page, panel or section background.
  const GRID_ALLOWED = new Set(['Redline.astro', 'Card.astro'])
  it.each(sources)('%s uses no grid paper outside an inspection stage', (name, source) => {
    if (GRID_ALLOWED.has(name)) return
    expect(source).not.toMatch(/--bg-grid/)
  })

  // Motion on the motion tokens (design-system/motion): durations and easings are
  // `var(--motion-…)`, never literals. Endless loops are decoration with their own periods (the
  // well's orbits, the floating objects, the terminal cursor) and are not checked.
  const MOTION_PROPERTY = /^(transition|animation)(-(duration|delay|timing-function))?$/
  const LITERAL_MOTION =
    /(^|[^\w-])\d*\.?\d+m?s\b|cubic-bezier\(|steps\(|\b(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)\b/
  it.each(sources)('%s takes durations and easings from the motion tokens', (_name, source) => {
    const css = source.replace(/\/\*[\s\S]*?\*\//g, '')
    const found = [...css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)[;}]/g)]
      .filter(([, property]) => MOTION_PROPERTY.test(property))
      .map(([, property, value]) => [property, value.trim().replace(/\s+/g, ' ')] as const)
      .filter(([, value]) => !/\binfinite\b/.test(value))
      .filter(([, value]) => LITERAL_MOTION.test(value.replace(/var\(--[\w-]+\)/g, '')))
      .map(([property, value]) => `${property}: ${value}`)
    expect(found).toEqual([])
  })

  it('finds a literal duration or easing in a component (the check above works)', () => {
    const literal = 'transition: opacity 0.2s ease;'
    const [, , value] = literal.match(/([a-z-]+)\s*:\s*([^;{}]+)[;}]/)!
    expect(LITERAL_MOTION.test(value)).toBe(true)
    const tokens = 'opacity var(--motion-duration-base) var(--motion-ease-enter)'
    expect(LITERAL_MOTION.test(tokens.replace(/var\(--[\w-]+\)/g, ''))).toBe(false)
    expect(LITERAL_MOTION.test('transform 320ms cubic-bezier(0.2, 0, 0, 1)')).toBe(true)
  })

  it.each(sources)('%s uses borders, not drop shadows', (_name, source) => {
    // box-shadow is only allowed as a focus ring or halo: `0 0 0 <width> <token>`.
    for (const [, value] of source.matchAll(/box-shadow:\s*([^;]+);/g)) {
      expect(value).toMatch(/^0 0 0 (var\(--[\w-]+\)|\d+px) var\(--[\w-]+\)$/)
    }
  })
})
