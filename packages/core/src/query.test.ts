import { describe, expect, it } from 'vitest'
import {
  breakpointReach,
  describeToken,
  findTokensByValue,
  listTokens,
  parseTokenFiles,
  suggestTokenNames,
  toColor,
  valueMatcher,
} from './index.js'

const file = (fileName: string, tree: unknown) => ({ fileName, content: JSON.stringify(tree) })
const color = (value: string) => ({ $type: 'color', $value: value })
const number = (value: number | string) => ({
  $type: 'number',
  $value: value,
  $extensions: { 'com.figma': { scopes: ['CORNER_RADIUS'] } },
})

const { model } = parseTokenFiles([
  file('Primitives.Value.json', {
    blue: { 600: color('#2f55d4'), 700: color('#2448b8') },
    green: { 600: color('#1d7a4c') },
    radius: { 4: number(4), 999: number(999) },
  }),
  file('Brand.BrandA.json', {
    action: { bg: color('{blue.600}') },
    shape: { control: number('{radius.4}') },
  }),
  file('Brand.BrandB.json', {
    action: { bg: color('{green.600}') },
    shape: { control: number('{radius.999}') },
  }),
  file('Component.Value.json', { button: { bg: color('{action.bg}') } }),
])

describe('describeToken', () => {
  it('reads a primitive once, with its raw value', () => {
    expect(describeToken(model, 'blue.600')).toEqual({
      name: 'blue.600',
      type: 'color',
      collection: 'Primitives',
      readings: [{ modes: {}, raw: '#2f55d4', value: '#2f55d4', chain: ['blue.600'] }],
    })
  })

  it('reads a brand token once per brand, with the alias chain', () => {
    const description = describeToken(model, 'action.bg')
    expect(description?.readings).toEqual([
      {
        modes: { Brand: 'BrandA' },
        raw: '{blue.600}',
        value: '#2f55d4',
        chain: ['action.bg', 'blue.600'],
      },
      {
        modes: { Brand: 'BrandB' },
        raw: '{green.600}',
        value: '#1d7a4c',
        chain: ['action.bg', 'green.600'],
      },
    ])
  })

  it('reads a single-mode token in every brand its chain goes through', () => {
    const readings = describeToken(model, 'button.bg')?.readings ?? []
    expect(readings.map((r) => [r.modes, r.value, r.chain.length])).toEqual([
      [{ Brand: 'BrandA' }, '#2f55d4', 3],
      [{ Brand: 'BrandB' }, '#1d7a4c', 3],
    ])
  })

  it('narrows to a selection, and returns null for unknown names', () => {
    const readings = describeToken(model, 'button.bg', { Brand: 'BrandB' })?.readings
    expect(readings?.map((r) => r.value)).toEqual(['#1d7a4c'])
    expect(describeToken(model, 'button.background')).toBeNull()
  })

  it('reports a chain that does not resolve', () => {
    const broken = parseTokenFiles([file('A.Value.json', { a: color('{missing}') })]).model
    expect(describeToken(broken, 'a')?.readings[0].error).toMatch(/does not exist/)
  })
})

describe('findTokensByValue', () => {
  it('finds the tokens that resolve to a colour, deepest alias first, with the brand', () => {
    expect(findTokensByValue(model, '#2F55D4').map((m) => [m.name, m.modes, m.depth])).toEqual([
      ['button.bg', { Brand: 'BrandA' }, 2],
      ['action.bg', { Brand: 'BrandA' }, 1],
      ['blue.600', {}, 0],
    ])
  })

  it('accepts rgb() and matches near colours only when asked', () => {
    expect(findTokensByValue(model, 'rgb(47 85 212)').map((m) => m.name)).toContain('blue.600')
    expect(findTokensByValue(model, '#2f56d5')).toEqual([])
    expect(findTokensByValue(model, '#2f56d5', { near: true }).map((m) => m.name)).toContain(
      'blue.600',
    )
  })

  it('finds numbers, with or without px, and filters by type', () => {
    expect(
      findTokensByValue(model, '999px').map((m) => `${m.name} ${JSON.stringify(m.modes)}`),
    ).toEqual(['shape.control {"Brand":"BrandB"}', 'radius.999 {}'])
    expect(findTokensByValue(model, '4', { type: 'color' })).toEqual([])
  })
})

describe('listTokens', () => {
  it('lists sorted names, filtered by collection, type and glob', () => {
    expect(listTokens(model).map((t) => t.name)).toEqual([
      'action.bg',
      'blue.600',
      'blue.700',
      'button.bg',
      'green.600',
      'radius.4',
      'radius.999',
      'shape.control',
    ])
    expect(listTokens(model, { collection: 'Brand' }).map((t) => [t.name, t.alias])).toEqual([
      ['action.bg', true],
      ['shape.control', true],
    ])
    expect(listTokens(model, { type: 'number' }).map((t) => t.name)).toEqual([
      'radius.4',
      'radius.999',
      'shape.control',
    ])
    expect(listTokens(model, { match: 'blue.*' }).map((t) => t.name)).toEqual([
      'blue.600',
      'blue.700',
    ])
    expect(listTokens(model, { match: '*' })).toEqual([])
    expect(listTokens(model, { match: '**' })).toHaveLength(8)
  })
})

describe('suggestTokenNames', () => {
  it('suggests close names first', () => {
    expect(suggestTokenNames(model, 'action.background', 2)).toEqual(['action.bg', 'button.bg'])
    expect(suggestTokenNames(model, 'blue', 2)).toEqual(['blue.600', 'blue.700'])
  })
})

describe('valueMatcher and toColor', () => {
  it('compares values like findTokensByValue', () => {
    const matches = valueMatcher('rgb(47 85 212)')
    expect(matches('#2F55D4', 'color')).toBe(true)
    expect(matches('#2f55d5', 'color')).toBe(false)
    expect(valueMatcher('#2f55d5', { near: true })('#2f55d4', 'color')).toBe(true)
    expect(valueMatcher('16px')(16, 'number')).toBe(true)
    expect(valueMatcher('16', { type: 'color' })(16, 'number')).toBe(false)
  })

  it('parses hex and rgb() colours, and nothing else', () => {
    expect(toColor('#fff')).toEqual({ r: 1, g: 1, b: 1 })
    expect(toColor('rgb(255, 0, 0)')).toEqual({ r: 1, g: 0, b: 0 })
    expect(toColor('red')).toBeNull()
  })
})

describe('findTokensByValue: breakpoints (TICKET-125)', () => {
  const size = (value: number | string) => ({ $type: 'number', $value: value })
  const { model: screens } = parseTokenFiles([
    file('Primitives.Value.json', { space: { 2: size(8), 4: size(16) } }),
    file('Brand.BrandA.json', { inset: size('{space.4}') }),
    file('Brand.BrandB.json', { inset: size('{space.2}') }),
    file('Screen.Mobile.json', { gap: size('{space.2}'), pad: size('{space.4}') }),
    file('Screen.Desktop.json', { gap: size('{space.4}'), pad: size('{space.4}') }),
    file('Screen.Tablet.json', { gap: size('{space.2}'), pad: size('{space.2}') }),
  ])
  const breakpoints = { collection: 'Screen', default: 'Mobile' }
  const order = (options = {}) =>
    findTokensByValue(screens, '16', options).map((m) => [m.name, m.modes, m.breakpoint])

  it('ranks by where the value holds: every breakpoint, the default, then other breakpoints', () => {
    expect(order({ breakpoints })).toEqual([
      // A brand-only value counts as everywhere: brands are not screen widths.
      ['inset', { Brand: 'BrandA' }, undefined],
      ['space.4', {}, undefined],
      ['pad', { Screen: 'Desktop' }, 'default'],
      ['pad', { Screen: 'Mobile' }, 'default'],
      ['gap', { Screen: 'Desktop' }, 'other'],
    ])
  })

  it('without breakpoints, ranks as before', () => {
    expect(order()).toEqual([
      ['gap', { Screen: 'Desktop' }, undefined],
      ['inset', { Brand: 'BrandA' }, undefined],
      ['pad', { Screen: 'Desktop' }, undefined],
      ['pad', { Screen: 'Mobile' }, undefined],
      ['space.4', {}, undefined],
    ])
  })

  it('breakpointReach: a collection or default mode that is not there, or a token outside it, is everywhere', () => {
    const is16 = (value: unknown) => value === 16
    expect(breakpointReach(screens, 'pad', is16, breakpoints)).toBe('default')
    expect(breakpointReach(screens, 'space.4', is16, breakpoints)).toBe('every')
    expect(breakpointReach(screens, 'gap', is16, breakpoints)).toBe('other')
    expect(breakpointReach(screens, 'gap', is16, { collection: 'Viewport', default: 'S' })).toBe(
      'every',
    )
    expect(breakpointReach(screens, 'gap', is16, { collection: 'Screen', default: 'Phone' })).toBe(
      'every',
    )
  })

  it('judges each brand on its own: one brand at every width does not cover another', () => {
    const { model: mixed } = parseTokenFiles([
      file('Primitives.Value.json', { space: { 2: size(8), 4: size(16) } }),
      file('Brand.BrandA.json', { inset: size('{space.4}') }),
      file('Brand.BrandB.json', { inset: size('{space.2}') }),
      // BrandA: 16 at every width. BrandB: 16 only on tablets.
      file('Screen.Mobile.json', { mix: size('{inset}') }),
      file('Screen.Desktop.json', { mix: size('{inset}') }),
      file('Screen.Tablet.json', { mix: size('{space.4}') }),
    ])
    const is16 = (value: unknown) => value === 16
    expect(breakpointReach(mixed, 'mix', is16, breakpoints)).toBe('other')
    const is8 = (value: unknown) => value === 8
    // 8 only for BrandB, at the default (Mobile) and Desktop: not every width.
    expect(breakpointReach(mixed, 'mix', is8, breakpoints)).toBe('default')
  })
})

describe('findTokensByValue: DTCG 2025.10 values', () => {
  const { model } = parseTokenFiles([
    {
      fileName: 'A.V.json',
      content: JSON.stringify({
        sky: { $type: 'color', $value: { colorSpace: 'oklch', components: [0.7, 0.15, 250] } },
        gap: { $type: 'dimension', $value: { value: 16, unit: 'px' } },
        lead: { $type: 'dimension', $value: '1rem' },
        fast: { $type: 'duration', $value: { value: 200, unit: 'ms' } },
        strong: { $type: 'fontWeight', $value: 'semi-bold' },
        body: { $type: 'fontFamily', $value: ['Inter', 'sans-serif'] },
        ease: { $type: 'cubicBezier', $value: [0.5, 0, 1, 1] },
      }),
    },
  ])
  const names = (query: string) => findTokensByValue(model, query).map((m) => m.name)

  it.each([
    ['#4ba3f7', ['sky']],
    ['16px', ['gap']],
    ['16', ['gap']],
    ['1rem', ['lead']],
    ['0.2s', ['fast']],
    ['600', ['strong']],
    ['semi-bold', ['strong']],
    ['"Inter", sans-serif', ['body']],
    ['cubic-bezier(0.5,0,1,1)', ['ease']],
  ])('finds %s', (query, expected) => {
    expect(names(query)).toEqual(expected)
  })
})
