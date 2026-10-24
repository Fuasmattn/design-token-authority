import type { VNode } from 'preact'
import { describe, expect, it } from 'vitest'
import TokenPath, { breakPaths, pathParts } from './TokenPath.js'

describe('pathParts', () => {
  it.each([
    ['Colors/Surface/Muted', ['Colors/', 'Surface/', 'Muted']],
    ['{Colors.Foundation.Blue.700}', ['{Colors.', 'Foundation.', 'Blue.', '700}']],
    ['Brand(Alias).BrandA.json', ['Brand(Alias).', 'BrandA.', 'json']],
    ['Primitives.Mode 1.json', ['Primitives.', 'Mode 1.', 'json']],
    ['output/css/themes/branda.css', ['output/', 'css/', 'themes/', 'branda.', 'css']],
    [
      'Brand(Alias).BrandA/Colors/Surface/Muted',
      ['Brand(Alias).', 'BrandA/', 'Colors/', 'Surface/', 'Muted'],
    ],
  ])('cuts %s after its separators', (text, parts) => {
    expect(pathParts(text)).toEqual(parts)
  })

  it.each([
    'Collection · brand · 0.94',
    '1.2 KB',
    'Lint failed. Next line.',
    'See the Token files reference.',
    'and/ or',
    '...',
    'https://',
  ])('leaves %s whole (decimals, full stops, lone separators)', (text) => {
    expect(pathParts(text)).toEqual([text])
  })

  it('cuts paths inside a line of prose and gives the text back when joined', () => {
    const line =
      'error [circular-alias] Circular alias chain: Brand(Alias).BrandA/Colors/Surface/Muted → Brand(Alias).BrandA/Colors/Text/Muted. (Brand(Alias).BrandA.json)'
    const parts = pathParts(line)
    expect(parts.join('')).toBe(line)
    expect(parts).toContain('Surface/')
    expect(parts.at(-1)).toBe('json)')
  })
})

describe('breakPaths', () => {
  it('puts a <wbr> after each part but the last', () => {
    const out = breakPaths('Colors/Surface/Muted') as unknown[]
    expect(out).toHaveLength(3)
    const [first, second, last] = out as [[string, VNode], [string, VNode], string]
    expect(first[0]).toBe('Colors/')
    expect(first[1].type).toBe('wbr')
    expect(second[0]).toBe('Surface/')
    expect(last).toBe('Muted')
  })

  it('returns text without a separator as it is', () => {
    expect(breakPaths('Primitives')).toBe('Primitives')
  })
})

describe('TokenPath', () => {
  it('renders the path in a mono span with its breaks', () => {
    const node = TokenPath({ path: 'Colors/Surface/Muted' }) as VNode<{
      class: string
      children: unknown[]
    }>
    expect(node.type).toBe('span')
    expect(node.props.class).toBe('dta-path')
    expect(node.props.children).toHaveLength(3)
  })
})
