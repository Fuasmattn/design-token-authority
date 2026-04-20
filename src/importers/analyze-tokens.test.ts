import { describe, it, expect } from 'vitest'
import { analyzeTokenFiles } from './analyze-tokens.js'

describe('analyzeTokenFiles', () => {
  it('detects primitives collection (single mode, no aliases)', () => {
    const files = {
      'Primitives.Mode 1.json': {
        Colors: {
          red: { $type: 'color', $value: '#ff0000' },
          blue: { $type: 'color', $value: '#0000ff' },
        },
        Spacing: {
          small: { $type: 'number', $value: 4 },
          medium: { $type: 'number', $value: 8 },
          large: { $type: 'number', $value: 16 },
        },
      },
    }

    const result = analyzeTokenFiles(files)
    expect(result.collections).toHaveLength(1)
    expect(result.collections[0].inferredRole).toBe('primitives')
    expect(result.suggestedCollections).toEqual(['Primitives'])
    expect(result.suggestedLayers.primitives).toBe('Primitives')
  })

  it('detects brand collection (multiple modes, high alias ratio)', () => {
    const files = {
      'Brand.BrandA.json': {
        color: {
          primary: { $type: 'color', $value: '{Primitives.Colors.blue}' },
          secondary: { $type: 'color', $value: '{Primitives.Colors.red}' },
        },
      },
      'Brand.BrandB.json': {
        color: {
          primary: { $type: 'color', $value: '{Primitives.Colors.red}' },
          secondary: { $type: 'color', $value: '{Primitives.Colors.blue}' },
        },
      },
    }

    const result = analyzeTokenFiles(files)
    expect(result.collections).toHaveLength(1)
    expect(result.collections[0].inferredRole).toBe('brand')
    expect(result.suggestedLayers.brand).toBe('Brand')
    expect(result.suggestedBrands).toEqual(['BrandA', 'BrandB'])
  })

  it('detects dimension collection (responsive mode names)', () => {
    const files = {
      'ScreenType.Desktop.json': {
        spacing: { gap: { $type: 'number', $value: 24 } },
      },
      'ScreenType.Mobile.json': {
        spacing: { gap: { $type: 'number', $value: 16 } },
      },
    }

    const result = analyzeTokenFiles(files)
    expect(result.collections).toHaveLength(1)
    expect(result.collections[0].inferredRole).toBe('dimension')
    expect(result.suggestedLayers.dimension).toBe('ScreenType')
  })

  it('handles multiple collections', () => {
    const files = {
      'Primitives.Mode 1.json': {
        red: { $type: 'color', $value: '#ff0000' },
        blue: { $type: 'color', $value: '#0000ff' },
      },
      'Brand.Light.json': {
        primary: { $type: 'color', $value: '{Primitives.red}' },
      },
      'Brand.Dark.json': {
        primary: { $type: 'color', $value: '{Primitives.blue}' },
      },
    }

    const result = analyzeTokenFiles(files)
    expect(result.collections).toHaveLength(2)
    expect(result.suggestedCollections).toEqual(['Primitives', 'Brand'])
    expect(result.suggestedLayers.primitives).toBe('Primitives')
    expect(result.suggestedLayers.brand).toBe('Brand')
  })

  it('returns empty result for no files', () => {
    const result = analyzeTokenFiles({})
    expect(result.collections).toHaveLength(0)
    expect(result.suggestedCollections).toEqual([])
    expect(result.suggestedLayers).toEqual({})
    expect(result.suggestedBrands).toEqual([])
  })
})
