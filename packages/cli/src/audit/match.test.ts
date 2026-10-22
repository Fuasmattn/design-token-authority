import { parseTokenFiles } from '@dta/core'
import { describe, expect, it } from 'vitest'
import type { Config } from '../config/schema.js'
import type { Candidate } from './detect.js'
import { buildTokenIndex, suggestToken } from './match.js'

const file = (fileName: string, tree: unknown) => ({ fileName, content: JSON.stringify(tree) })
const { model } = parseTokenFiles([
  file('Primitives.Value.json', {
    blue: { 600: { $type: 'color', $value: '#2f55d4' } },
    space: { 4: { $type: 'number', $value: 16 } },
    size: {
      r: {
        $type: 'number',
        $value: 8,
        $extensions: { 'com.figma': { scopes: ['CORNER_RADIUS'] } },
      },
    },
    font: { sans: { $type: 'string', $value: 'Inter, sans-serif' } },
    family: { mono: { $type: 'string', $value: 'Martian Mono' } },
  }),
  file('Theme.Light.json', { action: { bg: { $type: 'color', $value: '{blue.600}' } } }),
  file('Theme.Dark.json', { action: { bg: { $type: 'color', $value: '{blue.600}' } } }),
])
const config = { tokens: { dir: 'tokens' }, brands: ['Light', 'Dark'] } as unknown as Config
const index = buildTokenIndex(model, config)
const at = (kind: Candidate['kind'], value: string): Candidate => ({
  line: 1,
  column: 1,
  value,
  kind,
  context: 'x',
})

describe('suggestToken', () => {
  it('prefers the semantic token over the primitive, with its CSS name', () => {
    expect(suggestToken(index, at('color', '#2F55D4'))).toEqual({
      token: 'action.bg',
      code: { css: '--action-bg', tailwind: '--color-action-bg' },
    })
  })

  it('matches near colours only when asked', () => {
    expect(suggestToken(index, at('color', '#2f55d6'))).toBeNull()
    expect(suggestToken(index, at('color', '#2f55d6'), { near: true })?.token).toBe('action.bg')
  })

  it('matches lengths in px and rem against tokens of their kind (by name or scope)', () => {
    expect(suggestToken(index, at('spacing', '1rem'))?.token).toBe('space.4')
    expect(suggestToken(index, at('radius', '8px'))?.token).toBe('size.r')
    expect(suggestToken(index, at('radius', '16px'))).toBeNull()
    expect(suggestToken(index, at('spacing', '8px'))).toBeNull()
  })

  it('matches font families on the first family, ignoring quotes and case', () => {
    expect(suggestToken(index, at('font-family', 'inter'))?.token).toBe('font.sans')
    expect(suggestToken(index, at('font-family', 'Martian Mono'))?.token).toBe('family.mono')
  })
})

describe('suggestToken: DTCG 2025.10 tokens', () => {
  const { model: dtcg } = parseTokenFiles([
    file('Base.Value.json', {
      spacing: { $type: 'dimension', m: { $value: { value: 1, unit: 'rem' } } },
      radius: { $type: 'dimension', card: { $value: { value: 12, unit: 'px' } } },
      font: { body: { $type: 'fontFamily', $value: ['Source Sans', 'sans-serif'] } },
      sky: { $type: 'color', $value: { colorSpace: 'oklch', components: [0.7, 0.15, 250] } },
    }),
  ])
  const dtcgIndex = buildTokenIndex(dtcg, null)

  it('matches lengths against dimensions in px and rem', () => {
    expect(suggestToken(dtcgIndex, at('spacing', '16px'))?.token).toBe('spacing.m')
    expect(suggestToken(dtcgIndex, at('radius', '0.75rem'))?.token).toBe('radius.card')
  })

  it('matches a font family list by its first name, and colours in any space', () => {
    expect(suggestToken(dtcgIndex, at('font-family', 'Source Sans'))?.token).toBe('font.body')
    expect(suggestToken(dtcgIndex, at('color', '#4ba3f7'))?.token).toBe('sky')
  })
})
