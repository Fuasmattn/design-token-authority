import { describe, expect, it } from 'vitest'

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

  it('reports a token two modifiers change, until they combine as axes', () => {
    const { diagnostics } = parse({
      ...THEME,
      modifiers: {
        ...THEME.modifiers,
        brand: { contexts: { a: [], b: [{ surface: color('#ff0000') }] }, default: 'a' },
      },
      resolutionOrder: [...THEME.resolutionOrder, { $ref: '#/modifiers/brand' }],
    })
    expect(diagnostics.map((d) => d.code)).toEqual(['resolver-several-modifiers'])
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
