import { describe, expect, it } from 'vitest'
import {
  describeToken,
  findTokensByValue,
  listTokens,
  parseTokenFiles,
  suggestTokenNames,
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
