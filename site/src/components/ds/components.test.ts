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

  /*
   * Borders are complete or straight (design-system overview, principle "Borders, not
   * shadows"): a box with rounded corners has its outline on every side, or none; a straight
   * rule (border-top, border-bottom, …) belongs to a box without a radius. Never a border that
   * runs out on a rounded corner, never a faded one (border-image, masks).
   */
  const PARTIAL_BORDER =
    /^border-(top|right|bottom|left)(-width|-style)?$|^border-width$|^border-style$/
  const declarations = (block: string) =>
    [...block.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)].map(
      ([, property, value]) => [property, value.trim()] as const,
    )
  /** A partial outline in one rule: a side's own border, or widths/styles that differ by side. */
  const partial = ([property, value]: readonly [string, string]) => {
    if (!PARTIAL_BORDER.test(property)) return false
    if (/^border-(width|style)$/.test(property)) return new Set(value.split(/\s+/)).size > 1
    // `border-bottom: 0` takes a side away as much as a side's own border adds one.
    return true
  }
  const roundedBoxes = (css: string) => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, block]) => ({
      selector: selector.trim().split(/\n/).pop()!.trim(),
      block,
    }))
    const classesOf = (selector: string) =>
      selector
        .split(',')
        .map(
          (part) =>
            part
              .trim()
              .split(/[\s>+~]+/)
              .pop() ?? '',
        )
        .flatMap((compound) => compound.match(/\.[\w-]+/g) ?? [])
    const rounded = new Set(
      rules
        .filter(({ block }) =>
          declarations(block).some(
            ([property, value]) =>
              property === 'border-radius' && !/^0(px)?$/.test(value.replace(/\s+/g, ' ')),
          ),
        )
        .flatMap(({ selector }) => classesOf(selector)),
    )
    return rules
      .filter(({ selector, block }) => {
        const own = declarations(block)
        if (!own.some(partial)) return false
        // A rule that squares its own corners is a straight rule.
        if (own.some(([p, v]) => p === 'border-radius' && /^0(px)?$/.test(v))) return false
        return classesOf(selector).some((name) => rounded.has(name))
      })
      .map(({ selector }) => selector)
  }
  it.each(sources)(
    '%s keeps borders complete on rounded boxes and never fades them',
    (_name, source) => {
      const css = source.replace(/\/\*[\s\S]*?\*\//g, '')
      expect(roundedBoxes(css)).toEqual([])
      expect(css).not.toMatch(/border-image|(^|[\s;{])(-webkit-)?mask(-image)?\s*:/)
    },
  )
  // The same rule for the page styles, the docs' own components and the dta diff report.
  const elsewhere = [
    ...['site.css', 'landing.css', 'playground.css', 'theme.css'].map((f) =>
      path.join(dir, '..', '..', 'styles', f),
    ),
    ...fs.readdirSync(path.join(dir, '..', 'docs')).map((f) => path.join(dir, '..', 'docs', f)),
    path.join(dir, '..', '..', '..', '..', 'packages', 'visual-diff', 'src', 'report', 'html.ts'),
  ]
  it.each(elsewhere.map((file) => [path.basename(file), file] as const))(
    '%s keeps borders complete on rounded boxes and never fades them',
    (_name, file) => {
      const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(roundedBoxes(css)).toEqual([])
      expect(css).not.toMatch(/border-image|(^|[\s;{])(-webkit-)?mask(-image)?\s*:/)
    },
  )

  it('finds a partial border on a rounded box (the check above works)', () => {
    const sheet = `.panel { border: 2px solid var(--x); border-radius: var(--radius-lg); }
      .panel[data-sheet] { border-width: 2px 0 0; border-radius: var(--radius-lg) var(--radius-lg) 0 0; }`
    expect(roundedBoxes(sheet)).toEqual(['.panel[data-sheet]'])
    const rule = `.row { border-bottom: 1px solid var(--x); } .chip { border-radius: 4px; }`
    expect(roundedBoxes(rule)).toEqual([])
  })

  it.each(sources)('%s uses borders, not drop shadows', (_name, source) => {
    // box-shadow is only allowed as a focus ring or halo: `0 0 0 <width> <token>`.
    for (const [, value] of source.matchAll(/box-shadow:\s*([^;]+);/g)) {
      expect(value).toMatch(/^0 0 0 (var\(--[\w-]+\)|\d+px) var\(--[\w-]+\)$/)
    }
  })
})
