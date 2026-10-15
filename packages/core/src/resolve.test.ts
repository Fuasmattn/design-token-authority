import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkUniqueNames, parseTokenFiles, resolve } from './index.js'
import type { TokenFileInput, TokenModel } from './index.js'

const fixturesRoot = path.resolve(import.meta.dirname, '..', '..', '..', 'test', 'fixtures')

function fixtureModel(fixture: string): TokenModel {
  const dir = path.join(fixturesRoot, fixture, 'tokens')
  const files = fs.readdirSync(dir).map((fileName) => ({
    fileName,
    content: fs.readFileSync(path.join(dir, fileName), 'utf-8'),
  }))
  return parseTokenFiles(files).model
}

const file = (fileName: string, tree: unknown): TokenFileInput => ({
  fileName,
  content: JSON.stringify(tree),
})
const t = (type: string, value: string | number | boolean) => ({ $type: type, $value: value })

function model(...files: TokenFileInput[]): TokenModel {
  return parseTokenFiles(files).model
}

describe('checkUniqueNames', () => {
  it('finds no duplicates in the brand fixture', () => {
    expect(checkUniqueNames(fixtureModel('brand-ab'))).toEqual([])
  })

  it('finds no duplicates in the DaisyUI fixture', () => {
    expect(checkUniqueNames(fixtureModel('daisyui'))).toEqual([])
  })

  it('reports a name used in two collections, naming both', () => {
    const diagnostics = checkUniqueNames(
      model(
        file('A.Value.json', { x: { y: t('number', 1) } }),
        file('B.Value.json', { x: { y: t('number', 2) } }),
      ),
    )
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'duplicate-name', severity: 'error', path: ['x', 'y'] }),
    ])
    expect(diagnostics[0].message).toContain('"A"')
    expect(diagnostics[0].message).toContain('"B"')
  })

  it('allows the same name in different modes of one collection', () => {
    expect(
      checkUniqueNames(
        model(file('A.One.json', { x: t('number', 1) }), file('A.Two.json', { x: t('number', 2) })),
      ),
    ).toEqual([])
  })
})

describe('resolve: aliases through collections', () => {
  const brand = fixtureModel('brand-ab')

  it('returns the value and the alias chain of a plain token', () => {
    const result = resolve(brand, ['Colors', 'Foundation', 'Blue', '500'])
    expect(result).toEqual({
      ok: true,
      value: '#0057b8',
      type: 'color',
      chain: [
        { collection: 'Primitives', mode: 'Value', name: ['Colors', 'Foundation', 'Blue', '500'] },
      ],
    })
  })

  it('follows a Brand alias into Primitives, per brand mode', () => {
    const name = ['Colors', 'Brand', 'Primary']
    const a = resolve(brand, name, { 'Brand(Alias)': 'BrandA' })
    const b = resolve(brand, name, { 'Brand(Alias)': 'BrandB' })
    expect(a).toMatchObject({ ok: true, value: '#0057b8', type: 'color' })
    expect(b).toMatchObject({ ok: true, value: '#2e9e5b' })
    expect(a.chain.map((s) => [s.collection, s.mode])).toEqual([
      ['Brand(Alias)', 'BrandA'],
      ['Primitives', 'Value'],
    ])
  })

  it('uses the first mode of a collection when the selection does not name one', () => {
    const result = resolve(brand, ['Colors', 'Brand', 'Primary'])
    expect(result).toMatchObject({ ok: true, value: '#0057b8' })
    expect(result.chain[0].mode).toBe('BrandA')
  })

  it('resolves the ScreenType layer per breakpoint', () => {
    const name = ['Spacing', 'Gap']
    const desktop = resolve(brand, name, { ScreenType: 'Desktop' })
    const mobile = resolve(brand, name, { ScreenType: 'Mobile' })
    expect(desktop).toMatchObject({ ok: true, type: 'number' })
    expect(mobile).toMatchObject({ ok: true, type: 'number' })
    expect(desktop.ok && mobile.ok && desktop.value !== mobile.value).toBe(true)
  })

  it('reads an alias target in the mode selected for the target collection (not the referencing mode)', () => {
    const m = model(
      file('Base.Light.json', { c: t('color', '#ffffff') }),
      file('Base.Dark.json', { c: t('color', '#000000') }),
      file('Theme.Only.json', { bg: t('color', '{c}') }),
    )
    expect(resolve(m, ['bg'], { Base: 'Dark' })).toMatchObject({ ok: true, value: '#000000' })
    expect(resolve(m, ['bg'], { Base: 'Light' })).toMatchObject({ ok: true, value: '#ffffff' })
  })

  it('finds targets whose name segments contain dots', () => {
    const m = model(
      file('A.V.json', { size: { '4.5': t('number', 18) }, ref: t('number', '{size.4.5}') }),
    )
    expect(resolve(m, ['ref'])).toMatchObject({ ok: true, value: 18 })
  })
})

describe('resolve: problems are diagnostics, not exceptions', () => {
  const diagnosticCodes = (m: TokenModel, name: string[]) => {
    const result = resolve(m, name)
    expect(result.ok).toBe(false)
    return result.ok ? [] : result.diagnostics.map((d) => d.code)
  }

  it('reports an unknown token', () => {
    expect(diagnosticCodes(model(file('A.V.json', { x: t('number', 1) })), ['nope'])).toEqual([
      'unknown-token',
    ])
  })

  it('reports a dangling alias', () => {
    const m = model(file('A.V.json', { x: t('number', '{missing.token}') }))
    const result = resolve(m, ['x'])
    expect(result).toMatchObject({ ok: false })
    expect(!result.ok && result.diagnostics[0]).toMatchObject({
      code: 'dangling-alias',
      path: ['x'],
    })
  })

  it('reports an alias to a group, not a token', () => {
    const m = model(file('A.V.json', { g: { a: t('number', 1) }, x: t('number', '{g}') }))
    const result = resolve(m, ['x'])
    expect(!result.ok && result.diagnostics[0].code).toBe('dangling-alias')
    expect(!result.ok && result.diagnostics[0].message).toMatch(/group/)
  })

  it('reports a cycle and stops', () => {
    const m = model(
      file('A.V.json', { a: t('number', '{b}'), b: t('number', '{c}'), c: t('number', '{a}') }),
    )
    const result = resolve(m, ['a'])
    expect(!result.ok && result.diagnostics.map((d) => d.code)).toEqual(['circular-alias'])
    expect(!result.ok && result.diagnostics[0].message).toContain('a → b → c → a')
  })

  it('reports an alias that points at itself', () => {
    expect(diagnosticCodes(model(file('A.V.json', { a: t('number', '{a}') })), ['a'])).toEqual([
      'circular-alias',
    ])
  })

  it('reports an alias to a token of a different type', () => {
    const m = model(file('A.V.json', { s: t('string', 'hi'), n: t('number', '{s}') }))
    expect(diagnosticCodes(m, ['n'])).toEqual(['alias-type-mismatch'])
  })

  it('reports a token that has no value in the selected mode', () => {
    const m = model(
      file('A.One.json', { x: t('number', 1), y: t('number', 2) }),
      file('A.Two.json', { x: t('number', 3) }),
    )
    const result = resolve(m, ['y'], { A: 'Two' })
    expect(!result.ok && result.diagnostics[0].code).toBe('missing-value')
  })

  it('reports a selected mode the collection does not have', () => {
    const m = model(file('A.One.json', { x: t('number', 1) }))
    const result = resolve(m, ['x'], { A: 'Nope' })
    expect(!result.ok && result.diagnostics[0].code).toBe('unknown-mode')
  })

  it('terminates on deep and cyclic input alike', () => {
    const tree: Record<string, unknown> = {}
    for (let i = 0; i < 2000; i++) tree[`t${i}`] = t('number', i === 1999 ? 7 : `{t${i + 1}}`)
    expect(resolve(model(file('A.V.json', tree)), ['t0'])).toMatchObject({ ok: true, value: 7 })
  })
})
