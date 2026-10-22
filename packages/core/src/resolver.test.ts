import { describe, expect, it } from 'vitest'

import { analyzeGraph } from './graph.js'
import { parseTokenFiles, type ParseOptions } from './parse.js'
import { resolve } from './resolve.js'
import type { TokenModel } from './types.js'

const json = (fileName: string, tree: unknown) => ({ fileName, content: JSON.stringify(tree) })
const color = (value: string) => ({ $type: 'color', $value: value })

/** The report's example: a base set and a theme modifier with light and dark. */
const FILES = [
  json('base.json', {
    color: { blue: color('#0000ff'), white: color('#ffffff'), black: color('#000000') },
    space: { $type: 'dimension', s: { $value: { value: 4, unit: 'px' } } },
  }),
  json('light.json', { surface: color('{color.white}'), text: color('{color.black}') }),
  json('dark.json', { surface: color('{color.black}'), text: color('{color.white}') }),
]
const resolver = (doc: object) => json('app.resolver.json', { version: '2025.10', ...doc })
const THEME = {
  sets: { base: { sources: [{ $ref: 'base.json' }] } },
  modifiers: {
    theme: {
      contexts: { light: [{ $ref: 'light.json' }], dark: [{ $ref: 'dark.json' }] },
      default: 'light',
    },
  },
  resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/theme' }],
}

const parse = (doc: object, extra: ReturnType<typeof json>[] = [], options: ParseOptions = {}) =>
  parseTokenFiles([resolver(doc), ...FILES, ...extra], options)
/** The codes, without the warnings for files a test document does not use. */
const codes = (doc: object, extra: ReturnType<typeof json>[] = []) =>
  parse(doc, extra)
    .diagnostics.map((d) => d.code)
    .filter((code) => code !== 'not-in-resolver')
const value = (model: TokenModel, name: string, selection = {}) => {
  const result = resolve(model, name.split('.'), selection)
  return result.ok ? result.value : result.diagnostics.map((d) => d.code)
}

describe('resolver documents', () => {
  it('maps sets to single-mode collections and modifiers to a mode per context', () => {
    const { model, diagnostics } = parse(THEME)
    expect(diagnostics).toEqual([])
    expect(model.collections.map((c) => [c.name, c.modes, c.defaultMode])).toEqual([
      ['base', ['Value'], undefined],
      ['theme', ['dark', 'light'], 'light'],
    ])
    expect(model.collections[1].tokens.map((t) => t.name.join('.'))).toEqual(['surface', 'text'])
    expect(value(model, 'surface')).toBe('#ffffff')
    expect(value(model, 'surface', { theme: 'dark' })).toBe('#000000')
    expect(value(model, 'space.s')).toEqual({ value: 4, unit: 'px' })
  })

  it('moves a token a context changes into the modifier, keeping the base value elsewhere', () => {
    const { model } = parse({
      ...THEME,
      modifiers: {
        theme: {
          contexts: {
            light: [],
            dark: [{ color: { blue: color('#000088') } }],
          },
          default: 'light',
        },
      },
    })
    const theme = model.collections.find((c) => c.name === 'theme')
    expect(theme?.tokens.map((t) => [t.name.join('.'), t.values])).toEqual([
      ['color.blue', { dark: '#000088', light: '#0000ff' }],
    ])
    expect(model.collections[0].tokens.map((t) => t.name.join('.'))).not.toContain('color.blue')
  })

  it('merges sources in order (the last wins) and lets aliases and $extends reach across sets', () => {
    const { model, diagnostics } = parseTokenFiles([
      resolver({
        sets: {
          base: { sources: [{ $ref: 'base.json' }, { color: { blue: color('#1111ff') } }] },
          components: {
            sources: [
              {
                button: { $extends: '{color}', primary: color('{color.blue}') },
              },
            ],
          },
        },
        resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/sets/components' }],
      }),
      FILES[0],
    ])
    expect(diagnostics).toEqual([])
    expect(value(model, 'button.primary')).toBe('#1111ff')
    expect(value(model, 'button.white')).toBe('#ffffff')
    expect(model.collections.map((c) => c.name)).toEqual(['base', 'components'])
  })

  it('reads inline items, pointers into files and sibling keys next to $ref', () => {
    const { model, diagnostics } = parseTokenFiles([
      resolver({
        resolutionOrder: [
          { name: 'core', type: 'set', sources: [{ $ref: 'base.json#/color' }] },
          {
            name: 'mode',
            type: 'modifier',
            contexts: { on: [{ accent: color('{blue}') }], off: [] },
            default: 'off',
          },
        ],
      }),
      FILES[0],
    ])
    // `accent` exists in the context "on" only.
    expect(diagnostics.map((d) => d.code)).toEqual(['missing-in-mode'])
    expect(model.collections.map((c) => c.name)).toEqual(['core', 'mode'])
    expect(value(model, 'accent', { mode: 'on' })).toBe('#0000ff')
  })

  it('uses the context the config names, and checks it', () => {
    const chosen = parse(THEME, [], { modifiers: { theme: 'dark' } })
    expect(value(chosen.model, 'surface')).toBe('#000000')
    expect(
      parse(THEME, [], { modifiers: { theme: 'dim' } }).diagnostics.map((d) => d.code),
    ).toEqual(['resolver-input'])
    expect(parse(THEME, [], { modifiers: { brand: 'a' } }).diagnostics.map((d) => d.code)).toEqual([
      'resolver-input',
    ])
  })

  it('reports what the report lists as errors', () => {
    expect(codes({ ...THEME, resolutionOrder: undefined })).toEqual(['resolver-order'])
    expect(codes({ ...THEME, resolutionOrder: [{ name: 'x' }] })).toEqual(['resolver-order'])
    expect(
      codes({
        resolutionOrder: [
          { name: 'x', type: 'set', sources: [] },
          { name: 'x', type: 'set', sources: [] },
        ],
      }),
    ).toEqual(['resolver-order'])
    expect(codes({ ...THEME, modifiers: { theme: { contexts: {} } } })).toEqual([
      'resolver-modifier',
    ])
    expect(
      codes({ ...THEME, modifiers: { theme: { contexts: { a: [], b: [] }, default: 'c' } } }),
    ).toEqual(['resolver-modifier'])
    expect(
      codes({ ...THEME, sets: { base: { sources: [{ $ref: '#/modifiers/theme' }] } } }),
    ).toContain('resolver-ref')
    expect(
      codes({ ...THEME, sets: { base: { sources: [{ $ref: '#/resolutionOrder/0' }] } } }),
    ).toContain('resolver-ref')
    expect(codes({ ...THEME, sets: { base: { sources: [{ $ref: 'missing.json' }] } } })).toContain(
      'resolver-ref',
    )
    expect(
      codes({
        sets: { a: { sources: [{ $ref: '#/sets/b' }] }, b: { sources: [{ $ref: '#/sets/a' }] } },
        resolutionOrder: [{ $ref: '#/sets/a' }],
      }),
    ).toContain('resolver-circular')
    expect(
      parseTokenFiles([json('app.resolver.json', { version: '1.0' })]).diagnostics[0].code,
    ).toBe('resolver-version')
  })

  it('warns about a modifier with one context, or with no default and no input', () => {
    expect(
      codes({ ...THEME, modifiers: { theme: { contexts: { light: [] }, default: 'light' } } }),
    ).toEqual(['resolver-modifier'])
    const { diagnostics } = parse({
      ...THEME,
      modifiers: {
        theme: { contexts: { light: [{ $ref: 'light.json' }], dark: [{ $ref: 'dark.json' }] } },
      },
    })
    expect(diagnostics.map((d) => [d.code, d.severity])).toEqual([['resolver-default', 'warning']])
  })

  /** THEME plus a brand modifier after it: brand b changes the surface in both themes. */
  const BRANDED = {
    ...THEME,
    modifiers: {
      ...THEME.modifiers,
      brand: {
        contexts: {
          a: [{ accent: color('#aa0000') }],
          b: [{ accent: color('#bb0000'), surface: color('#ff0000') }],
        },
        default: 'a',
      },
    },
    resolutionOrder: [...THEME.resolutionOrder, { $ref: '#/modifiers/brand' }],
  }

  it('puts a token several modifiers change into a collection with a mode per combination', () => {
    const { model, diagnostics } = parse(BRANDED)
    expect(diagnostics).toEqual([])
    const combined = model.collections.find((c) => c.axes)
    expect([combined?.name, combined?.axes, combined?.modes, combined?.defaultMode]).toEqual([
      'theme × brand',
      ['theme', 'brand'],
      ['dark × a', 'dark × b', 'light × a', 'light × b'],
      'light × a',
    ])
    expect(combined?.tokens.map((t) => t.name.join('.'))).toEqual(['surface'])
    expect(model.collections.filter((c) => c.modifier).map((c) => c.name)).toEqual([
      'brand',
      'theme',
    ])
    expect(combined?.tokens[0].layers).toEqual({
      axes: [
        { axis: 'theme', contexts: { light: '{color.white}', dark: '{color.black}' } },
        { axis: 'brand', contexts: { b: '#ff0000' } },
      ],
    })
  })

  it('resolves every combination as the resolver merges it, selected by modifier or combination', () => {
    const { model } = parse(BRANDED)
    const expected: Record<string, string> = {
      'light × a': '#ffffff',
      'dark × a': '#000000',
      'light × b': '#ff0000',
      'dark × b': '#ff0000',
    }
    for (const [combo, surface] of Object.entries(expected)) {
      const [theme, brand] = combo.split(' × ')
      expect(value(model, 'surface', { theme, brand })).toBe(surface)
      expect(value(model, 'surface', { 'theme × brand': combo })).toBe(surface)
      // The combination selects the contexts of the single modifiers too.
      expect(value(model, 'text', { 'theme × brand': combo })).toBe(
        theme === 'dark' ? '#ffffff' : '#000000',
      )
      expect(value(model, 'accent', { brand })).toBe(brand === 'a' ? '#aa0000' : '#bb0000')
    }
    // One modifier selected: the other at its default.
    expect(value(model, 'surface', { theme: 'dark' })).toBe('#000000')
    expect(value(model, 'surface', { brand: 'b' })).toBe('#ff0000')
  })

  it("finds a token a modifier changes only away from the other one's default", () => {
    const two = (second: object, secondDefault: string) =>
      parseTokenFiles([
        resolver({
          sets: { base: { sources: [{ x: color('#ffffff') }] } },
          modifiers: {
            theme: { contexts: { light: [], dark: [{ x: color('#000000') }] }, default: 'light' },
            second: { contexts: second, default: secondDefault },
          },
          resolutionOrder: [
            { $ref: '#/sets/base' },
            { $ref: '#/modifiers/theme' },
            { $ref: '#/modifiers/second' },
          ],
        }),
      ]).model
    // A later modifier undoes the dark theme: at its default nothing seems to change.
    const reset = two({ normal: [], high: [{ x: color('#ffffff') }] }, 'normal')
    expect(value(reset, 'x', { theme: 'dark', second: 'high' })).toBe('#ffffff')
    expect(value(reset, 'x', { theme: 'dark', second: 'normal' })).toBe('#000000')
    // The default context of a later modifier hides the dark theme.
    const hidden = two({ compact: [{ x: color('#ff0000') }], comfy: [] }, 'compact')
    expect(value(hidden, 'x', { theme: 'dark', second: 'comfy' })).toBe('#000000')
    expect(value(hidden, 'x', { theme: 'light', second: 'compact' })).toBe('#ff0000')
    expect(hidden.collections.find((c) => c.axes)?.name).toBe('theme × second')
  })

  it('links a combination to the contexts it combines in the graph', () => {
    const { model } = parse({
      ...BRANDED,
      modifiers: {
        theme: BRANDED.modifiers.theme,
        brand: {
          contexts: { a: [], b: [{ surface: color('{text}') }] },
          default: 'a',
        },
      },
    })
    const edges = analyzeGraph(model).edges.map((e) => `${e.from} -> ${e.to}`)
    expect(edges).toContain('theme × brand.dark × b/surface -> theme.dark/text')
    expect(edges).toContain('theme × brand.light × b/surface -> theme.light/text')
  })

  it('reports token files the document does not read, and chooses between several documents', () => {
    const stray = json('Extra.Value.json', { x: color('#123456') })
    expect(parse(THEME, [stray]).diagnostics.map((d) => [d.code, d.file])).toEqual([
      ['not-in-resolver', 'Extra.Value.json'],
    ])
    const second = json('other.resolver.json', THEME)
    expect(
      parseTokenFiles([resolver(THEME), second, ...FILES]).diagnostics.map((d) => d.code),
    ).toEqual(['several-resolvers'])
    const named = parseTokenFiles([resolver(THEME), second, ...FILES], {
      resolver: 'app.resolver.json',
    })
    expect(named.diagnostics).toEqual([])
  })

  it('reads files relative to the resolver document, in folders', () => {
    const { model, diagnostics } = parseTokenFiles([
      json('themes/app.resolver.json', {
        version: '2025.10',
        sets: { base: { sources: [{ $ref: '../sets/base.json' }] } },
        resolutionOrder: [{ $ref: '#/sets/base' }],
      }),
      { ...FILES[0], fileName: 'sets/base.json' },
    ])
    expect(diagnostics).toEqual([])
    expect(value(model, 'color.blue')).toBe('#0000ff')
  })
})
