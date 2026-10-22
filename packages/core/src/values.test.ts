import { describe, expect, it } from 'vitest'

import { parseTokenFiles } from './parse.js'
import { serializeTokenFiles } from './serialize.js'
import type { TokenType, TokenValue } from './types.js'
import { formatValue, sameValue, valueProblem } from './values.js'

const file = (fileName: string, tree: unknown) => ({
  fileName,
  content: JSON.stringify(tree, null, 2) + '\n',
})

const dim = (value: number, unit = 'px') => ({ value, unit })
const srgb = (r: number, g: number, b: number, extra: Record<string, unknown> = {}) => ({
  colorSpace: 'srgb',
  components: [r, g, b],
  ...extra,
})

/** Valid values per type, mostly from the examples of DTCG 2025.10. */
const VALID: [TokenType, unknown][] = [
  ['color', '#3366ff'],
  ['color', srgb(1, 0, 0.5, { alpha: 0.5, hex: '#ff0080' })],
  ['color', { colorSpace: 'hsl', components: ['none', 0, 100] }],
  ['color', { colorSpace: 'oklch', components: [0.7, 0.15, 250] }],
  ['color', { colorSpace: 'display-p3', components: [1, 0.2, 0] }],
  ['dimension', dim(16)],
  ['dimension', dim(0.5, 'rem')],
  ['dimension', '4px'],
  ['duration', { value: 100, unit: 'ms' }],
  ['duration', '0.2s'],
  ['fontFamily', 'Helvetica'],
  ['fontFamily', ['Helvetica', 'Arial', 'sans-serif']],
  ['fontWeight', 350],
  ['fontWeight', 'semi-bold'],
  ['cubicBezier', [0.5, 0, 1, 1]],
  ['cubicBezier', [0.25, -0.5, 0.75, 1.5]],
  ['number', 1.5],
  ['strokeStyle', 'dashed'],
  ['strokeStyle', { dashArray: [dim(0.5, 'rem'), '{size.gap}'], lineCap: 'round' }],
  ['border', { color: '#36363600', width: dim(3), style: 'solid' }],
  [
    'transition',
    { duration: '{motion.fast}', delay: { value: 0, unit: 'ms' }, timingFunction: [0.5, 0, 1, 1] },
  ],
  [
    'shadow',
    {
      color: '#00000080',
      offsetX: dim(0.5, 'rem'),
      offsetY: dim(0.5, 'rem'),
      blur: dim(1.5, 'rem'),
      spread: dim(0, 'rem'),
    },
  ],
  [
    'shadow',
    [
      {
        color: '#00000088',
        offsetX: dim(0),
        offsetY: dim(1),
        blur: dim(2),
        spread: dim(0),
        inset: true,
      },
      '{shadow.base}',
    ],
  ],
  [
    'gradient',
    [
      { color: '#0000ff', position: 0 },
      { color: '{color.red}', position: 1 },
    ],
  ],
  [
    'typography',
    {
      fontFamily: 'Roboto',
      fontSize: dim(42),
      fontWeight: 700,
      letterSpacing: dim(0.1),
      lineHeight: 1.2,
    },
  ],
  ['string', 'any text'],
  ['boolean', true],
]

/** One invalid value per rule, with the start of the message it must give. */
const INVALID: [TokenType, unknown, string][] = [
  ['color', { colorSpace: 'cmyk', components: [0, 0, 0, 0] }, 'has an unknown colorSpace "cmyk"'],
  [
    'color',
    { colorSpace: 'hsl', components: [360, 50, 50] },
    'component 1 of hsl must be from 0 to below 360',
  ],
  ['color', srgb(1.2, 0, 0), 'component 1 of srgb must be from 0 to 1'],
  ['color', { colorSpace: 'srgb', components: [1, 0] }, 'needs 3 components for srgb'],
  ['color', srgb(1, 0, 0, { alpha: 2 }), 'alpha must be between 0 and 1'],
  ['color', srgb(1, 0, 0, { hex: '#f00' }), 'hex must be a 6-digit hex colour'],
  ['color', 12, 'must be a colour object or a hex string'],
  ['dimension', dim(4, 'em'), 'unit must be "px" or "rem"'],
  ['dimension', { value: '4', unit: 'px' }, 'value must be a number'],
  ['dimension', '4em', 'must be an object { value, unit }'],
  ['duration', { value: 1, unit: 'min' }, 'unit must be "ms" or "s"'],
  ['fontFamily', [], 'must be a font name or a list'],
  ['fontWeight', 1001, 'must be between 1 and 1000'],
  ['fontWeight', 'Bold', 'must be a number from 1 to 1000 or one of'],
  ['cubicBezier', [1.5, 0, 1, 1], 'the x values (first and third) must be between 0 and 1'],
  ['cubicBezier', [0, 0, 1], 'must be a list of four numbers'],
  ['strokeStyle', 'wavy', 'must be one of'],
  ['strokeStyle', { dashArray: [dim(1)], lineCap: 'pointy' }, 'lineCap must be one of'],
  ['border', { color: '#000', width: dim(1) }, 'is missing "style"'],
  ['border', { color: '#000', width: dim(1, 'em'), style: 'solid' }, 'width unit must be'],
  [
    'shadow',
    { color: '#000', offsetX: dim(0), offsetY: dim(0), blur: dim(0) },
    'is missing "spread"',
  ],
  ['shadow', [], 'must not be an empty list'],
  ['gradient', [{ color: '#000', position: '50%' }], 'stop 1: position must be a number'],
  [
    'typography',
    {
      fontFamily: 'x',
      fontSize: dim(1),
      fontWeight: 400,
      letterSpacing: dim(0),
      lineHeight: 1,
      size: 1,
    },
    'has an unknown property "size"',
  ],
  ['color', { $ref: '#/colors/blue/$value' }, 'references with $ref are not supported yet'],
]

describe('valueProblem: the types of DTCG 2025.10', () => {
  it.each(VALID)('accepts a valid %s value: %j', (type, value) => {
    expect(valueProblem(type, value)).toBeNull()
  })

  it.each(INVALID)('rejects an invalid %s value %j', (type, value, message) => {
    expect(valueProblem(type, value)).toMatch(
      new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    )
  })

  it('accepts an alias for any type and for each part of a composite', () => {
    expect(valueProblem('shadow', '{shadow.base}')).toBeNull()
    expect(
      valueProblem('typography', {
        fontFamily: '{font.body}',
        fontSize: '{size.m}',
        fontWeight: '{weight.bold}',
        letterSpacing: '{size.none}',
        lineHeight: '{line.normal}',
      }),
    ).toBeNull()
  })
})

describe('formatValue', () => {
  const cases: [unknown, string][] = [
    ['#3366ff', '#3366ff'],
    [srgb(1, 0, 0.5), '#ff0080'],
    [srgb(1, 0, 0.5, { alpha: 0.5 }), '#ff008080'],
    [
      { colorSpace: 'oklch', components: [0.7, 0.15, 250], alpha: 0.5 },
      'oklch(0.7 0.15 250 / 0.5)',
    ],
    [{ colorSpace: 'hsl', components: ['none', 0, 100] }, 'hsl(none 0% 100%)'],
    [{ colorSpace: 'display-p3', components: [1, 0.2, 0] }, 'color(display-p3 1 0.2 0)'],
    [dim(0.5, 'rem'), '0.5rem'],
    [{ value: 100, unit: 'ms' }, '100ms'],
    [['Helvetica Neue', 'Arial'], '"Helvetica Neue", Arial'],
    [[0.5, 0, 1, 1], 'cubic-bezier(0.5, 0, 1, 1)'],
    [
      {
        color: '#00000080',
        offsetX: dim(0),
        offsetY: dim(2),
        blur: dim(4),
        spread: dim(0),
        inset: true,
      },
      'inset 0px 2px 4px 0px #00000080',
    ],
    [{ color: '#000', width: dim(1), style: 'solid' }, '1px solid #000'],
    [
      [
        { color: '#0000ff', position: 0 },
        { color: '#ff0000', position: 1 },
      ],
      '#0000ff 0%, #ff0000 100%',
    ],
    [
      {
        fontFamily: 'Roboto',
        fontSize: dim(16),
        fontWeight: 700,
        letterSpacing: dim(0),
        lineHeight: 1.5,
      },
      '700 16px/1.5 Roboto, letter-spacing 0px',
    ],
    ['{color.brand}', '{color.brand}'],
    [42, '42'],
  ]
  it.each(cases)('formats %j as %s', (value, text) => {
    expect(formatValue(value as TokenValue)).toBe(text)
  })
})

describe('sameValue', () => {
  it('compares colours by sRGB hex across forms and case', () => {
    expect(sameValue('#FF0080', '#ff0080')).toBe(true)
    expect(sameValue(srgb(1, 0, 0.5) as TokenValue, '#ff0080')).toBe(true)
    expect(
      sameValue(
        { colorSpace: 'oklch', components: [0.7, 0.1, 250], hex: '#6688cc' } as TokenValue,
        '#6688CC',
      ),
    ).toBe(true)
    expect(sameValue('#ff0080', '#ff0081')).toBe(false)
  })

  it('treats the draft dimension strings like their object form', () => {
    expect(sameValue('4px', dim(4) as TokenValue)).toBe(true)
    expect(sameValue('4px', dim(4, 'rem') as TokenValue)).toBe(false)
  })

  it('compares objects regardless of key order', () => {
    expect(
      sameValue({ unit: 'ms', value: 1 } as TokenValue, { value: 1, unit: 'ms' } as TokenValue),
    ).toBe(true)
    expect(sameValue([0, 0, 1, 1], [0, 0, 1, 0.9])).toBe(false)
  })
})

describe('parseTokenFiles: DTCG 2025.10 groups and names', () => {
  it('inherits $type from the closest group that sets one', () => {
    const { model, diagnostics } = parseTokenFiles([
      file('A.V.json', {
        size: {
          $type: 'dimension',
          s: { $value: dim(4) },
          motion: { $type: 'duration', fast: { $value: { value: 100, unit: 'ms' } } },
        },
      }),
    ])
    expect(diagnostics).toEqual([])
    expect(model.collections[0].tokens.map((t) => [t.name.join('.'), t.type])).toEqual([
      ['size.s', 'dimension'],
      ['size.motion.fast', 'duration'],
    ])
  })

  it('gives an alias without $type the type of its target, also across collections', () => {
    const { model, diagnostics } = parseTokenFiles([
      file('Base.V.json', { blue: { $type: 'color', $value: '#0000ff' } }),
      file('Brand.A.json', { primary: { $value: '{blue}' }, link: { $value: '{primary}' } }),
    ])
    expect(diagnostics).toEqual([])
    const brand = model.collections.find((c) => c.name === 'Brand')
    expect(brand?.tokens.map((t) => t.type)).toEqual(['color', 'color'])
  })

  it('reports an alias without $type whose target gives no type', () => {
    const { model, diagnostics } = parseTokenFiles([
      file('A.V.json', { x: { $value: '{nowhere}' } }),
    ])
    expect(diagnostics).toEqual([expect.objectContaining({ code: 'missing-type', path: ['x'] })])
    expect(model.collections[0].tokens).toEqual([])
  })

  it('reads $deprecated on tokens and groups; false on a token overrides the group', () => {
    const { model } = parseTokenFiles([
      file('A.V.json', {
        old: {
          $type: 'number',
          $deprecated: 'Use space instead.',
          a: { $value: 1 },
          b: { $value: 2, $deprecated: false },
        },
        c: { $type: 'number', $value: 3, $deprecated: true },
      }),
    ])
    expect(model.collections[0].tokens.map((t) => [t.name.join('.'), t.deprecated])).toEqual([
      ['old.a', 'Use space instead.'],
      ['old.b', undefined],
      ['c', true],
    ])
  })

  it('reports braces in names as errors and dots as warnings', () => {
    const { model, diagnostics } = parseTokenFiles([
      file('A.V.json', {
        'a{b}': { $type: 'number', $value: 1 },
        size: { '4.5': { $type: 'number', $value: 18 } },
      }),
    ])
    expect(diagnostics.map((d) => [d.code, d.severity])).toEqual([
      ['invalid-name', 'error'],
      ['name-with-dot', 'warning'],
    ])
    expect(model.collections[0].tokens.map((t) => t.name)).toEqual([['size', '4.5']])
  })

  it('reports a token that also contains tokens or groups', () => {
    const { diagnostics } = parseTokenFiles([
      file('A.V.json', { a: { $type: 'number', $value: 1, b: { $type: 'number', $value: 2 } } }),
    ])
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'token-with-children', path: ['a'] }),
    ])
  })

  it('reports an unknown group $type', () => {
    const { diagnostics } = parseTokenFiles([
      file('A.V.json', { g: { $type: 'shape', a: { $value: 1 } } }),
    ])
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-type', 'unknown-type'])
  })
})

describe('serializeTokenFiles: DTCG 2025.10 files round trip', () => {
  it('writes an unchanged file back byte for byte, without adding inherited types', () => {
    const input = file('A.V.json', {
      size: { $type: 'dimension', s: { $value: dim(4) }, m: { $value: '{size.s}' } },
      shadow: {
        $type: 'shadow',
        card: {
          $value: [
            { color: '#00000080', offsetX: dim(0), offsetY: dim(2), blur: dim(4), spread: dim(0) },
          ],
          $deprecated: 'Use elevation.',
        },
      },
    })
    const { model } = parseTokenFiles([input])
    expect(serializeTokenFiles(model)).toEqual([input])
  })
})
