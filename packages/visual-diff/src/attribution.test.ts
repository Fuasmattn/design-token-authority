import { describe, expect, it } from 'vitest'
import {
  attributePixels,
  planReverts,
  type CssBinding,
  type Dependent,
  type TokenChange,
  type TokenChangeSet,
} from './index.js'

const change = (c: Partial<TokenChange> & Pick<TokenChange, 'kind' | 'name'>): TokenChange => ({
  collection: 'Primitives',
  mode: 'Value',
  type: 'color',
  ...c,
})
const setOf = (changes: TokenChange[]): TokenChangeSet => ({
  changes,
  counts: {
    changed: changes.filter((c) => c.kind === 'changed').length,
    added: changes.filter((c) => c.kind === 'added').length,
    removed: changes.filter((c) => c.kind === 'removed').length,
    affected: changes.filter((c) => c.kind === 'affected').length,
  },
})
const binding = (b: Partial<CssBinding> & Pick<CssBinding, 'name' | 'value'>): CssBinding => ({
  collection: 'Primitives',
  mode: 'Value',
  variable: `--${b.name.replace(/\./g, '-')}`,
  selector: ':root',
  ...b,
})

describe('planReverts', () => {
  it('reverts a changed token in its own selector, with the base value', () => {
    const set = setOf([
      change({
        kind: 'changed',
        name: 'action.bg',
        collection: 'Theme',
        mode: 'Light',
        before: { raw: '{blueprint.600}' },
        after: { raw: '{blueprint.700}' },
      }),
    ])
    const base = [
      binding({
        name: 'action.bg',
        collection: 'Theme',
        mode: 'Light',
        selector: '[data-brand="light"]',
        value: 'var(--blueprint-600)',
      }),
    ]
    const head = [{ ...base[0], value: 'var(--blueprint-700)' }]
    const { causes, groups } = planReverts(set, base, head)
    expect(causes.map((c) => c.id)).toEqual(['action.bg (Theme · Light)'])
    expect(causes[0].before).toEqual({ raw: '{blueprint.600}' })
    expect(groups).toEqual([
      {
        id: 'action.bg (Theme · Light)',
        css: '[data-brand="light"] { --action-bg: var(--blueprint-600) !important; }',
      },
    ])
  })

  it('reverts affected tokens with their cause, so literal copies change back too', () => {
    const set = setOf([
      change({ kind: 'changed', name: 'blue.600' }),
      change({ kind: 'affected', name: 'link', causes: ['blue.600'] }),
      change({ kind: 'affected', name: 'other', causes: ['red.500'] }),
    ])
    const base = [
      binding({ name: 'blue.600', value: '#2f55d4' }),
      binding({ name: 'link', value: 'var(--blue-600)' }),
      binding({ name: 'other', value: 'var(--red-500)' }),
    ]
    const { groups } = planReverts(set, base, base)
    expect(groups[0].css.split('\n')).toEqual([
      ':root { --blue-600: #2f55d4 !important; }',
      ':root { --link: var(--blue-600) !important; }',
    ])
  })

  it('unsets added tokens and puts removed ones back', () => {
    const set = setOf([
      change({ kind: 'added', name: 'new' }),
      change({ kind: 'removed', name: 'old' }),
    ])
    const { groups } = planReverts(
      set,
      [binding({ name: 'old', value: '4px' })],
      [binding({ name: 'new', value: '8px' })],
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].children?.map((g) => g.css)).toEqual([
      ':root { --new: initial !important; }',
      ':root { --old: 4px !important; }',
    ])
  })

  it('groups tokens per collection · mode and skips tokens without CSS', () => {
    const set = setOf([
      change({ kind: 'changed', name: 'a' }),
      change({ kind: 'changed', name: 'b' }),
      change({ kind: 'changed', name: 'c', collection: 'Theme', mode: 'Light' }),
      change({ kind: 'changed', name: 'js-only' }),
    ])
    const base = [
      binding({ name: 'a', value: '1px' }),
      binding({ name: 'b', value: '2px' }),
      binding({ name: 'c', collection: 'Theme', mode: 'Light', value: 'red' }),
    ]
    const { causes, groups } = planReverts(set, base, base)
    expect(causes.map((c) => c.id)).toEqual([
      'a (Primitives · Value)',
      'b (Primitives · Value)',
      'c (Theme · Light)',
    ])
    expect(groups.map((g) => g.id)).toEqual(['group: Primitives · Value', 'c (Theme · Light)'])
    expect(groups[0].children?.map((g) => g.id)).toEqual([
      'a (Primitives · Value)',
      'b (Primitives · Value)',
    ])
    expect(groups[0].css).toBe(groups[0].children?.map((g) => g.css).join('\n'))
  })
})

describe('attributePixels', () => {
  // 10 × 4 page; changed pixels at (1,1), (2,1) and (8,3).
  const mask = new Uint8Array(40)
  for (const [x, y] of [
    [1, 1],
    [2, 1],
    [8, 3],
  ])
    mask[y * 10 + x] = 1
  const dep = (box: [number, number, number, number], baseBox = box): Dependent => ({
    label: 'div.card',
    box,
    baseBox,
  })

  it('explains pixels inside a dependent box and reports the rest', () => {
    const result = attributePixels(mask, 10, 4, { 'a (P · V)': [dep([0, 0, 3, 2])] }, 0)
    expect(result).toEqual({
      explained: false,
      tokens: [
        {
          id: 'a (P · V)',
          dependents: 1,
          pixels: 2,
          elements: ['div.card'],
          regions: [{ x: 0, y: 0, width: 3, height: 2 }],
        },
      ],
      unexplainedPixels: 1,
      canvas: { width: 10, height: 4 },
      unexplainedRegion: { x: 8, y: 3, width: 1, height: 1 },
    })
  })

  it('uses the base box as well (elements that moved) and a tolerance around boxes', () => {
    const result = attributePixels(mask, 10, 4, { m: [dep([0, 0, 3, 2], [7, 2, 8, 3])] }, 1)
    expect(result.explained).toBe(true)
    expect(result.unexplainedRegion).toBeUndefined()
  })

  it('counts a pixel for every token that covers it and leaves out tokens without pixels', () => {
    const result = attributePixels(
      mask,
      10,
      4,
      { a: [dep([0, 0, 10, 4])], b: [dep([1, 1, 2, 2])], c: [dep([5, 0, 6, 1])], d: [] },
      0,
    )
    expect(result.tokens.map((t) => [t.id, t.pixels])).toEqual([
      ['a', 3],
      ['b', 1],
    ])
  })

  it('keeps the five largest distinct head boxes, clipped to the image', () => {
    const boxes = [
      [0, 0, 1, 1],
      [0, 0, 1, 1],
      [0, 0, 20, 2],
      [0, 0, 2, 2],
      [0, 0, 3, 3],
      [0, 0, 4, 3],
      [0, 0, 5, 3],
    ].map((b) => dep(b as [number, number, number, number]))
    const [token] = attributePixels(mask, 10, 4, { a: boxes }, 0).tokens
    expect(token.regions.map((r) => [r.width, r.height])).toEqual([
      [10, 2],
      [5, 3],
      [4, 3],
      [3, 3],
      [2, 2],
    ])
  })

  it('leaves everything unexplained without dependents', () => {
    const result = attributePixels(mask, 10, 4, {})
    expect(result).toMatchObject({ explained: false, tokens: [], unexplainedPixels: 3 })
    expect(result.unexplainedRegion).toEqual({ x: 1, y: 1, width: 8, height: 3 })
  })
})
