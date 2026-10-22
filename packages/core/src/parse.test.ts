import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { nameToDot, nameToSlash, parseTokenFiles, serializeTokenFiles } from './index.js'
import type { TokenFileInput } from './index.js'

const fixturesRoot = path.resolve(import.meta.dirname, '..', '..', '..', 'test', 'fixtures')

function fixtureFiles(fixture: string): TokenFileInput[] {
  const dir = path.join(fixturesRoot, fixture, 'tokens')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((fileName) => ({ fileName, content: fs.readFileSync(path.join(dir, fileName), 'utf-8') }))
}

const file = (fileName: string, tree: unknown): TokenFileInput => ({
  fileName,
  content: JSON.stringify(tree, null, 2) + '\n',
})

const color = (value: string, extra: object = {}) => ({ $type: 'color', $value: value, ...extra })

describe('parseTokenFiles: building the model', () => {
  it('groups per-mode files into collections with modes and merges values per token', () => {
    const { model, diagnostics } = parseTokenFiles(fixtureFiles('brand-ab'))
    expect(diagnostics).toEqual([])
    expect(model.collections.map((c) => [c.name, c.modes])).toEqual([
      ['Brand(Alias)', ['BrandA', 'BrandB']],
      ['Primitives', ['Value']],
      ['ScreenType', ['Desktop', 'Mobile', 'Tablet']],
    ])
    const brand = model.collections.find((c) => c.name === 'Brand(Alias)')!
    const primary = brand.tokens.find((t) => nameToDot(t.name) === 'Colors.Brand.Primary')!
    expect(primary.type).toBe('color')
    expect(Object.keys(primary.values)).toEqual(['BrandA', 'BrandB'])
    expect(primary.values.BrandA).toMatch(/^\{.+\}$/)
  })

  it('reads token names as path segments', () => {
    const { model } = parseTokenFiles([
      file('A.Value.json', { Group: { Sub: { '700': color('#000000') } } }),
    ])
    expect(model.collections[0].tokens[0].name).toEqual(['Group', 'Sub', '700'])
  })

  it('supports all four token types', () => {
    const { model, diagnostics } = parseTokenFiles([
      file('A.Value.json', {
        c: color('#fff'),
        n: { $type: 'number', $value: 4 },
        s: { $type: 'string', $value: 'x' },
        b: { $type: 'boolean', $value: false },
      }),
    ])
    expect(diagnostics).toEqual([])
    expect(model.collections[0].tokens.map((t) => [t.name[0], t.type, t.values.Value])).toEqual([
      ['c', 'color', '#fff'],
      ['n', 'number', 4],
      ['s', 'string', 'x'],
      ['b', 'boolean', false],
    ])
  })

  it('keeps description and the com.figma extension data', () => {
    const extensions = { 'com.figma': { scopes: ['ALL_SCOPES'], codeSyntax: {} } }
    const { model } = parseTokenFiles([
      file('A.Value.json', {
        x: color('#000000', { $description: 'Ink', $extensions: extensions }),
      }),
    ])
    const [token] = model.collections[0].tokens
    expect(token.description).toBe('Ink')
    expect(token.extensions).toEqual(extensions)
  })

  it('splits collection and mode at the first dot, so modes may contain dots', () => {
    const { model, diagnostics } = parseTokenFiles([
      file('border.1.5.json', { x: { $type: 'number', $value: 1.5 } }),
      file('border.1.json', { x: { $type: 'number', $value: 1 } }),
    ])
    expect(diagnostics).toEqual([])
    expect(model.collections).toHaveLength(1)
    expect(model.collections[0]).toMatchObject({ name: 'border', modes: ['1', '1.5'] })
  })

  it('is independent of the order the files are passed in', () => {
    const files = fixtureFiles('brand-ab')
    const forward = parseTokenFiles(files).model.collections.map((c) => [c.name, c.modes])
    const backward = parseTokenFiles([...files].reverse()).model.collections.map((c) => [
      c.name,
      c.modes,
    ])
    expect(backward).toEqual(forward)
  })

  it('parses the DaisyUI fixture without errors', () => {
    const { model, diagnostics } = parseTokenFiles(fixtureFiles('daisyui'))
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(model.collections.length).toBeGreaterThan(10)
  })

  it('produces plain JSON-serializable data', () => {
    const { model, diagnostics } = parseTokenFiles(fixtureFiles('brand-ab'))
    expect(JSON.parse(JSON.stringify({ model, diagnostics }))).toEqual({ model, diagnostics })
  })
})

describe('parseTokenFiles: bad input becomes diagnostics, never exceptions', () => {
  const codes = (files: TokenFileInput[]) => parseTokenFiles(files).diagnostics.map((d) => d.code)

  it('reports an invalid file name and ignores the file', () => {
    const result = parseTokenFiles([file('nodots.json', {}), file('A.Value.txt', {})])
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.file])).toEqual([
      ['invalid-file-name', 'error', 'A.Value.txt'],
      ['invalid-file-name', 'error', 'nodots.json'],
    ])
    expect(result.model.collections).toEqual([])
  })

  it('reports invalid JSON with the file name', () => {
    const result = parseTokenFiles([{ fileName: 'A.Value.json', content: '{ nope' }])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'invalid-json', severity: 'error', file: 'A.Value.json' }),
    ])
  })

  it('reports empty files and files that are not an object', () => {
    expect(codes([{ fileName: 'A.Value.json', content: '  \n' }])).toEqual(['empty-file'])
    expect(codes([{ fileName: 'A.Value.json', content: '[1]' }])).toEqual(['not-an-object'])
    expect(codes([{ fileName: 'A.Value.json', content: '"x"' }])).toEqual(['not-an-object'])
  })

  it('reports two files for the same collection and mode', () => {
    expect(codes([file('A.Value.json', {}), { fileName: 'A.Value.json', content: '{}' }])).toEqual([
      'duplicate-file',
    ])
  })

  it('reports a token without $type and leaves it out of the model', () => {
    const result = parseTokenFiles([file('A.Value.json', { a: { Wrong: { $value: '#000' } } })])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'missing-type', severity: 'error', path: ['a', 'Wrong'] }),
    ])
    expect(result.model.collections[0]?.tokens ?? []).toEqual([])
  })

  it('reports an unknown $type as an error and leaves the token out of the model', () => {
    const result = parseTokenFiles([
      file('A.Value.json', {
        t: { $type: 'shape', $value: 'round' },
        c: color('#000'),
      }),
    ])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'unknown-type', severity: 'error', path: ['t'] }),
    ])
    expect(result.model.collections[0].tokens.map((t) => t.name)).toEqual([['c']])
  })

  it('reports a DTCG value that does not match its type, naming the rule', () => {
    const result = parseTokenFiles([
      file('A.Value.json', { t: { $type: 'typography', $value: { fontFamily: 'x' } } }),
    ])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'invalid-value',
        severity: 'error',
        message: 'Token "t" (typography): the $value is missing "fontSize".',
      }),
    ])
  })

  it('reports a $value that is not a string, number or boolean', () => {
    expect(codes([file('A.Value.json', { x: { $type: 'number', $value: { a: 1 } } })])).toEqual([
      'invalid-value',
    ])
  })

  it('warns when a token is missing in some modes', () => {
    const result = parseTokenFiles([
      file('A.One.json', { x: color('#000'), y: color('#111') }),
      file('A.Two.json', { x: color('#222') }),
    ])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'missing-in-mode', severity: 'warning', path: ['y'] }),
    ])
    expect(result.diagnostics[0].message).toContain('Two')
    expect(result.model.collections[0].tokens.find((t) => t.name[0] === 'y')?.values).toEqual({
      One: '#111',
    })
  })

  it('reports different types for the same token in different modes and keeps the first', () => {
    const result = parseTokenFiles([
      file('A.One.json', { x: color('#000') }),
      file('A.Two.json', { x: { $type: 'string', $value: 'oops' } }),
    ])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'type-mismatch', severity: 'error', path: ['x'] }),
    ])
    expect(result.model.collections[0].tokens[0]).toMatchObject({
      type: 'color',
      values: { One: '#000' },
    })
  })
})

describe('name helpers', () => {
  it('renders dot form for JSON aliases and slash form for Figma', () => {
    expect(nameToDot(['Colors', 'Brand', 'Primary'])).toBe('Colors.Brand.Primary')
    expect(nameToSlash(['Colors', 'Brand', 'Primary'])).toBe('Colors/Brand/Primary')
  })
})

describe('serializeTokenFiles: lossless round trip', () => {
  it.each(['brand-ab', 'daisyui'])('reproduces every %s fixture file byte for byte', (fixture) => {
    const input = fixtureFiles(fixture)
    const { model } = parseTokenFiles(input)
    const output = serializeTokenFiles(model)
    expect(output.map((f) => f.fileName).sort()).toEqual(input.map((f) => f.fileName).sort())
    for (const original of input) {
      expect(output.find((f) => f.fileName === original.fileName)?.content).toBe(original.content)
    }
  })

  it('keeps unknown extensions, key order and tokens it could not model', () => {
    const tree = {
      Z: { $type: 'typography', $value: { x: 1 }, $extensions: { 'org.other': { keep: true } } },
      A: color('#000000', {
        $extensions: { 'org.other': { keep: true }, 'com.figma': { scopes: [] } },
      }),
    }
    const input = [file('A.Value.json', tree)]
    const { model } = parseTokenFiles(input)
    expect(serializeTokenFiles(model)).toEqual(input)
  })

  it('preserves a file without trailing newline and non-default indentation', () => {
    const input = [
      { fileName: 'A.Value.json', content: JSON.stringify({ x: color('#000') }, null, 4) },
    ]
    expect(serializeTokenFiles(parseTokenFiles(input).model)).toEqual(input)
  })
})

describe('serializeTokenFiles: applying model changes', () => {
  const base = () => [
    file('A.One.json', { g: { x: color('#000000'), y: color('#111111') } }),
    file('A.Two.json', { g: { x: color('#222222'), y: color('#333333') } }),
  ]
  const read = (files: TokenFileInput[], name: string) =>
    JSON.parse(files.find((f) => f.fileName === name)!.content)

  it('writes a changed value only to its mode', () => {
    const { model } = parseTokenFiles(base())
    model.collections[0].tokens[0].values.Two = '#abcdef'
    const out = serializeTokenFiles(model)
    expect(read(out, 'A.Two.json').g.x.$value).toBe('#abcdef')
    expect(out.find((f) => f.fileName === 'A.One.json')?.content).toBe(base()[0].content)
  })

  it('removes a token that is no longer in the model and prunes its empty group', () => {
    const { model } = parseTokenFiles(base())
    model.collections[0].tokens = []
    const out = serializeTokenFiles(model)
    expect(read(out, 'A.One.json')).toEqual({})
  })

  it('adds a new token in its group with a $type, $value and description', () => {
    const { model } = parseTokenFiles(base())
    model.collections[0].tokens.push({
      name: ['g', 'z'],
      type: 'number',
      values: { One: 1, Two: 2 },
      description: 'new',
    })
    const out = serializeTokenFiles(model)
    expect(read(out, 'A.Two.json').g.z).toEqual({ $type: 'number', $value: 2, $description: 'new' })
    expect(Object.keys(read(out, 'A.Two.json').g)).toEqual(['x', 'y', 'z'])
  })

  it('creates the file for a new mode', () => {
    const { model } = parseTokenFiles(base())
    model.collections[0].modes.push('Three')
    for (const token of model.collections[0].tokens) token.values.Three = '#444444'
    const out = serializeTokenFiles(model)
    expect(out.map((f) => f.fileName)).toEqual(['A.One.json', 'A.Three.json', 'A.Two.json'])
    expect(read(out, 'A.Three.json').g.y.$value).toBe('#444444')
    expect(out.find((f) => f.fileName === 'A.Three.json')?.content.endsWith('\n')).toBe(true)
  })

  it('treats an empty description as no description', () => {
    const input = base()
    const { model } = parseTokenFiles(input)
    model.collections[0].tokens[0].description = ''
    expect(serializeTokenFiles(model)).toEqual(input)
  })

  it('applies a changed description to the existing entries', () => {
    const { model } = parseTokenFiles(base())
    model.collections[0].tokens[0].description = 'edited'
    const out = serializeTokenFiles(model)
    expect(read(out, 'A.One.json').g.x.$description).toBe('edited')
    expect(read(out, 'A.Two.json').g.x.$description).toBe('edited')
  })
})
