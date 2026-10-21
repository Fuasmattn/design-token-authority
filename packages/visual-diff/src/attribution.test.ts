import { describe, expect, it } from 'vitest'
import {
  attributePixels,
  PAGE_DECLARATIONS_SCRIPT,
  planReverts,
  type CssBinding,
  type Dependent,
  type PageDeclaration,
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
      change({ kind: 'affected', name: 'other', causes: ['slate.500'] }),
    ])
    const base = [
      binding({ name: 'blue.600', value: '#2f55d4' }),
      binding({ name: 'link', value: 'var(--blue-600)' }),
      binding({ name: 'other', value: 'var(--slate-500)' }),
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
      binding({ name: 'c', collection: 'Theme', mode: 'Light', value: 'steelblue' }),
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

describe('planReverts on re-scoped CSS (groupsFor the page)', () => {
  // One brand, one mode: `dta build` declares it on :root; the page re-scopes it per state.
  const set = setOf([
    change({ kind: 'changed', name: 'Radius.Card', collection: 'Brand', mode: 'OrbitBurger' }),
  ])
  const base = [
    binding({
      name: 'Radius.Card',
      collection: 'Brand',
      mode: 'OrbitBurger',
      variable: '--radius-card',
      value: 'var(--orbit-radius-sm)',
    }),
  ]
  const head = [{ ...base[0], value: 'var(--orbit-radius-lg)' }]
  const declared = (d: Partial<PageDeclaration> & Pick<PageDeclaration, 'selector'>) => ({
    variable: '--radius-card',
    value: '24px',
    context: [],
    ...d,
  })

  it('puts the token back where the page declares it, besides the build selector', () => {
    const plan = planReverts(set, base, head)
    expect(plan.variables).toEqual(['--radius-card'])
    expect(plan.groups).toEqual(plan.groupsFor([]))
    const [group] = plan.groupsFor([
      declared({ selector: '[data-state="main"]', value: '8px' }),
      declared({ selector: '[data-state="change"]' }),
      declared({ selector: '[data-state="change"]' }), // twice in the page: one rule
    ])
    expect(group.css.split('\n')).toEqual([
      ':root { --radius-card: var(--orbit-radius-sm) !important; }',
      '[data-state="main"] { --radius-card: var(--orbit-radius-sm) !important; }',
      '[data-state="change"] { --radius-card: var(--orbit-radius-sm) !important; }',
    ])
  })

  it('keeps the at-rules and nesting the declaration is in', () => {
    const [group] = planReverts(set, base, head).groupsFor([
      declared({ selector: '.card', context: ['@layer theme', '@media (min-width: 40rem)'] }),
      declared({ selector: '&', context: ['.shell', '@supports (display: grid)'] }),
      declared({ selector: ':root', context: ['@media (prefers-color-scheme: dark)'] }),
      declared({ selector: ':root' }), // the build rule already covers it
    ])
    expect(group.css.split('\n')).toEqual([
      ':root { --radius-card: var(--orbit-radius-sm) !important; }',
      '@layer theme { @media (min-width: 40rem) { .card { --radius-card: var(--orbit-radius-sm) !important; } } }',
      '.shell { @supports (display: grid) { & { --radius-card: var(--orbit-radius-sm) !important; } } }',
      '@media (prefers-color-scheme: dark) { :root { --radius-card: var(--orbit-radius-sm) !important; } }',
    ])
  })

  it('ignores declarations of other variables', () => {
    const [group] = planReverts(set, base, head).groupsFor([
      declared({ selector: '.x', variable: '--radius-pill' }),
    ])
    expect(group.css).toBe(':root { --radius-card: var(--orbit-radius-sm) !important; }')
  })

  it('unsets an added token wherever the page declares it', () => {
    const added = setOf([
      change({ kind: 'added', name: 'Radius.Card', collection: 'Brand', mode: 'OrbitBurger' }),
    ])
    const [group] = planReverts(added, [], head).groupsFor([declared({ selector: '.scope' })])
    expect(group.css.split('\n')).toEqual([
      ':root { --radius-card: initial !important; }',
      '.scope { --radius-card: initial !important; }',
    ])
  })

  describe('with several brands declaring the variable', () => {
    const brand = (mode: string, value: string) =>
      binding({
        name: 'accent',
        collection: 'Theme',
        mode,
        selector: `[data-brand="${mode.toLowerCase()}"]`,
        value,
      })
    const changed = setOf([
      change({ kind: 'changed', name: 'accent', collection: 'Theme', mode: 'A' }),
    ])
    const baseBrands = [brand('A', 'var(--sky)'), brand('B', 'var(--sky)')]
    const headBrands = [brand('A', 'var(--slate)'), brand('B', 'var(--sky)')]
    const page = (selector: string, value: string, context: string[] = []) => ({
      variable: '--accent',
      selector,
      value,
      context,
    })

    it("re-scoped rules count when they hold this brand's head value", () => {
      const [group] = planReverts(changed, baseBrands, headBrands).groupsFor([
        page('.theme-a', ' var(--slate) '),
        page('.theme-b', 'var(--sky)'),
        page('[data-brand="b"]', 'var(--slate)'), // another brand's own selector
        page('[data-brand="a"]', 'var(--slate)', ['@layer brands']),
      ])
      expect(group.css.split('\n')).toEqual([
        '[data-brand="a"] { --accent: var(--sky) !important; }',
        '.theme-a { --accent: var(--sky) !important; }',
        '@layer brands { [data-brand="a"] { --accent: var(--sky) !important; } }',
      ])
    })

    it('leaves a re-scoped rule alone when two brands share its value', () => {
      const same = [brand('A', 'var(--slate)'), brand('B', 'var(--slate)')]
      const [group] = planReverts(changed, baseBrands, same).groupsFor([
        page('.theme-a', 'var(--slate)'),
      ])
      expect(group.css).toBe('[data-brand="a"] { --accent: var(--sky) !important; }')
    })
  })
})

/** A minimal CSSOM: what PAGE_DECLARATIONS_SCRIPT reads of rules and sheets. */
const style = (decls: Record<string, string>) =>
  Object.assign(Object.keys(decls), { getPropertyValue: (name: string) => decls[name] ?? '' })
const styleRule = (selectorText: string, decls: Record<string, string>, cssRules?: unknown[]) => ({
  selectorText,
  style: style(decls),
  cssText: `${selectorText} { … }`,
  ...(cssRules ? { cssRules } : {}),
})
const group = (prelude: string, cssRules: unknown[]) => ({ cssText: `${prelude} { … }`, cssRules })
const nested = (decls: Record<string, string>) => ({ style: style(decls), cssText: '…' })

function pageDeclarations(sheets: unknown[], variables: string[], adopted: unknown[] = []) {
  const script = new Function('document', `return (${PAGE_DECLARATIONS_SCRIPT})`)
  return script({ styleSheets: sheets, adoptedStyleSheets: adopted })(variables) as unknown
}

describe('PAGE_DECLARATIONS_SCRIPT', () => {
  it('finds the variables in plain, nested and at-rule scoped rules', () => {
    const sheet = {
      cssRules: [
        styleRule(':root', { '--a': '1px', '--other': 'x' }),
        styleRule('[data-state="change"]', { '--a': ' 24px' }),
        group('@media (min-width: 40rem)', [
          group('@layer theme', [styleRule('.card', { '--b': 'red' })]),
        ]),
        group('@supports (display: grid)', [
          styleRule('.shell', {}, [nested({ '--a': '2px' }), styleRule('& .x', { '--b': 'blue' })]),
        ]),
        group('@layer', [styleRule('.anon', { '--a': '3px' })]),
        group('@keyframes spin', [{ keyText: 'from', style: style({ '--a': '0' }), cssText: '' }]),
        group('@font-face', []),
      ],
    }
    expect(pageDeclarations([sheet], ['--a', '--b'])).toEqual([
      { variable: '--a', value: '1px', selector: ':root', context: [] },
      { variable: '--a', value: '24px', selector: '[data-state="change"]', context: [] },
      {
        variable: '--b',
        value: 'red',
        selector: '.card',
        context: ['@media (min-width: 40rem)', '@layer theme'],
      },
      {
        variable: '--a',
        value: '2px',
        selector: '&',
        context: ['@supports (display: grid)', '.shell'],
      },
      {
        variable: '--b',
        value: 'blue',
        selector: '& .x',
        context: ['@supports (display: grid)', '.shell'],
      },
      { variable: '--a', value: '3px', selector: '.anon', context: [] },
    ])
  })

  it('follows @import and sheet media, skips cross-origin and disabled sheets', () => {
    const imported = { cssRules: [styleRule('.in', { '--a': '1px' })] }
    const sheets = [
      {
        cssRules: [
          {
            styleSheet: imported,
            layerName: 'base',
            supportsText: '',
            media: { mediaText: 'screen' },
            cssText: '@import …',
          },
        ],
      },
      { media: { mediaText: 'print' }, cssRules: [styleRule('.p', { '--a': '2px' })] },
      {
        get cssRules() {
          throw new Error('SecurityError: cross-origin')
        },
      },
      { disabled: true, cssRules: [styleRule('.off', { '--a': '9px' })] },
    ]
    const adopted = [{ cssRules: [styleRule(':host', { '--a': '4px' })] }]
    expect(pageDeclarations(sheets, ['--a'], adopted)).toEqual([
      { variable: '--a', value: '1px', selector: '.in', context: ['@layer base', '@media screen'] },
      { variable: '--a', value: '2px', selector: '.p', context: ['@media print'] },
      { variable: '--a', value: '4px', selector: ':host', context: [] },
    ])
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
