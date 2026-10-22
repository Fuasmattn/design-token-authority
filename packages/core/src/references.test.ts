import { describe, expect, it } from 'vitest'

import { aliasProblems } from './alias-problems.js'
import { analyzeGraph } from './graph.js'
import { parseTokenFiles } from './parse.js'
import { pointerSegments, referenceOf } from './references.js'
import { resolve } from './resolve.js'
import { serializeTokenFiles } from './serialize.js'
import type { TokenModel } from './types.js'

const file = (fileName: string, tree: unknown) => ({
  fileName,
  content: JSON.stringify(tree, null, 2) + '\n',
})
const model = (...files: ReturnType<typeof file>[]): TokenModel => {
  const { model, diagnostics } = parseTokenFiles(files)
  expect(diagnostics).toEqual([])
  return model
}
const dim = (value: number, unit = 'px') => ({ value, unit })
const value = (m: TokenModel, name: string) => {
  const result = resolve(m, name.split('.'))
  return result.ok ? result.value : result.diagnostics.map((d) => d.code)
}

describe('references: curly aliases and $ref pointers', () => {
  it('reads both forms, including pointer escapes', () => {
    expect(referenceOf('{color.blue}')).toMatchObject({ kind: 'alias', target: ['color', 'blue'] })
    expect(referenceOf({ $ref: '#/color/blue/$value/components/0' })).toMatchObject({
      kind: 'ref',
      target: ['color', 'blue'],
      part: ['components', '0'],
    })
    expect(pointerSegments('#/a~1b/c~0d')).toEqual(['a/b', 'c~d'])
    expect(referenceOf({ $ref: 'other.json#/a' })).toBeNull()
  })

  it('resolves a $ref to a whole token like an alias, and gives an untyped one its type', () => {
    const m = model(
      file('A.V.json', {
        color: { $type: 'color', blue: { $value: '#0000ff' } },
        link: { $value: { $ref: '#/color/blue/$value' } },
        whole: { $value: { $ref: '#/color/blue' } },
      }),
    )
    expect(value(m, 'link')).toBe('#0000ff')
    expect(value(m, 'whole')).toBe('#0000ff')
    expect(m.collections[0].tokens.find((t) => t.name[0] === 'link')?.type).toBe('color')
  })

  it('takes a part of a value with a $ref into it, and checks it against the type', () => {
    const m = model(
      file('A.V.json', {
        blue: { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0.4, 1] } },
        green: { $type: 'number', $value: { $ref: '#/blue/$value/components/1' } },
        bad: { $type: 'dimension', $value: { $ref: '#/blue/$value/components/1' } },
        none: { $type: 'number', $value: { $ref: '#/blue/$value/components/7' } },
      }),
    )
    expect(value(m, 'green')).toBe(0.4)
    expect(value(m, 'bad')).toEqual(['alias-type-mismatch'])
    expect(value(m, 'none')).toEqual(['dangling-alias'])
  })

  it('resolves aliases and $ref inside composite values', () => {
    const m = model(
      file('A.V.json', {
        color: { $type: 'color', ink: { $value: '#00000080' } },
        size: { $type: 'dimension', s: { $value: dim(2) }, m: { $value: dim(4) } },
        shadow: {
          $type: 'shadow',
          card: {
            $value: {
              color: '{color.ink}',
              offsetX: dim(0),
              offsetY: '{size.s}',
              blur: { $ref: '#/size/m/$value' },
              spread: { value: { $ref: '#/size/s/$value/value' }, unit: 'px' },
            },
          },
        },
      }),
    )
    expect(value(m, 'shadow.card')).toEqual({
      color: '#00000080',
      offsetX: dim(0),
      offsetY: dim(2),
      blur: dim(4),
      spread: dim(2),
    })
  })

  it('reports a dangling reference inside a composite, in resolve, the graph and alias problems', () => {
    const { model: m } = parseTokenFiles([
      file('A.V.json', {
        border: {
          $type: 'border',
          $value: { color: '{color.gone}', width: dim(1), style: 'solid' },
        },
      }),
    ])
    expect(value(m, 'border')).toEqual(['dangling-alias'])
    const graph = analyzeGraph(m)
    expect(graph.danglingAliases).toMatchObject([
      { sourceId: 'A.V/border', rawAlias: '{color.gone}' },
    ])
    expect(aliasProblems(graph).diagnostics.map((d) => d.code)).toEqual(['dangling-alias'])
  })

  it('finds a cycle through references into values', () => {
    const { model: m } = parseTokenFiles([
      file('A.V.json', {
        $type: 'dimension',
        a: { $value: { value: { $ref: '#/b/$value/value' }, unit: 'px' } },
        b: { $value: { value: { $ref: '#/a/$value/value' }, unit: 'px' } },
      }),
    ])
    expect(value(m, 'a')).toEqual(['circular-alias'])
    const graph = analyzeGraph(m)
    expect(graph.cycles.map((c) => c.path)).toEqual([['A.V/a', 'A.V/b', 'A.V/a']])
    expect(graph.edges).toEqual([
      { from: 'A.V/a', to: 'A.V/b' },
      { from: 'A.V/b', to: 'A.V/a' },
    ])
    expect([...aliasProblems(graph).unresolvable].sort()).toEqual(['A.V/a', 'A.V/b'])
  })

  it('lists the tokens a composite refers to on its graph node', () => {
    const m = model(
      file('A.V.json', {
        ink: { $type: 'color', $value: '#000' },
        size: { $type: 'dimension', $value: dim(1) },
        line: { $type: 'border', $value: { color: '{ink}', width: '{size}', style: 'solid' } },
      }),
    )
    const node = analyzeGraph(m).nodes.find((n) => n.name[0] === 'line')
    expect(node).toMatchObject({ aliasTarget: null, references: [['ink'], ['size']] })
  })
})

describe('$root', () => {
  it('is a token named $root that aliases reach by its full path', () => {
    const m = model(
      file('A.V.json', {
        color: {
          $type: 'color',
          accent: { $root: { $value: '#dd0000' }, light: { $value: '#ff2222' } },
        },
        link: { $type: 'color', $value: '{color.accent.$root}' },
      }),
    )
    expect(value(m, 'link')).toBe('#dd0000')
  })

  it('does not make the group itself a token', () => {
    const { model: m } = parseTokenFiles([
      file('A.V.json', {
        color: { $type: 'color', accent: { $root: { $value: '#dd0000' } } },
        link: { $type: 'color', $value: '{color.accent}' },
      }),
    ])
    const result = resolve(m, ['link'])
    expect(!result.ok && result.diagnostics[0].message).toBe(
      '"link" aliases "color.accent", which is a group, not a token.',
    )
  })

  it('must be a token', () => {
    const { diagnostics } = parseTokenFiles([file('A.V.json', { g: { $root: { a: 1 } } })])
    expect(diagnostics.map((d) => d.code)).toEqual(['invalid-root'])
  })
})

describe('$extends', () => {
  // The report's example: a primary button that extends the base button.
  const buttons = {
    button: {
      $type: 'color',
      background: { $value: '#0000ff' },
      text: { $value: '#ffffff' },
      border: { $type: 'dimension', width: { $value: dim(1) } },
    },
    'button-primary': {
      $extends: '{button}',
      background: { $value: '#ff0000' },
      border: { radius: { $type: 'dimension', $value: dim(4) } },
    },
  }

  it('inherits the tokens and the group $type; a local token replaces the inherited one', () => {
    const m = model(file('A.V.json', buttons))
    const names = m.collections[0].tokens.map((t) => t.name.join('.'))
    expect(names).toEqual(
      expect.arrayContaining([
        'button-primary.background',
        'button-primary.text',
        'button-primary.border.width',
        'button-primary.border.radius',
      ]),
    )
    expect(value(m, 'button-primary.background')).toBe('#ff0000')
    expect(value(m, 'button-primary.text')).toBe('#ffffff')
    expect(value(m, 'button-primary.border.width')).toEqual(dim(1))
  })

  it('accepts a $ref pointer to the group and follows chains of extends', () => {
    const m = model(
      file('A.V.json', {
        base: { $type: 'number', a: { $value: 1 } },
        middle: { $extends: { $ref: '#/base' }, b: { $value: 2 } },
        top: { $extends: '{middle}', c: { $value: 3 } },
      }),
    )
    expect(value(m, 'top.a')).toBe(1)
    expect(value(m, 'top.b')).toBe(2)
  })

  it('reports a target that is missing, a token, or part of a circle', () => {
    const codes = (tree: unknown) =>
      parseTokenFiles([file('A.V.json', tree)]).diagnostics.map((d) => d.code)
    expect(codes({ g: { $extends: '{nope}' } })).toEqual(['invalid-extends'])
    expect(codes({ t: { $type: 'number', $value: 1 }, g: { $extends: '{t}' } })).toEqual([
      'invalid-extends',
    ])
    expect(codes({ a: { $extends: '{b}' }, b: { $extends: '{a}' } })).toEqual(['circular-extends'])
  })

  it('writes the file back unchanged, and a changed inherited token as a local one', () => {
    const input = file('A.V.json', buttons)
    const { model: m } = parseTokenFiles([input])
    expect(serializeTokenFiles(m)).toEqual([input])

    const text = m.collections[0].tokens.find((t) => t.name.join('.') === 'button-primary.text')
    if (!text) throw new Error('missing token')
    text.values.V = '#eeeeee'
    const written = JSON.parse(serializeTokenFiles(m)[0].content)
    expect(written['button-primary'].text).toEqual({ $type: 'color', $value: '#eeeeee' })
    expect(written.button.text).toEqual({ $value: '#ffffff' })
  })
})
