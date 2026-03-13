/**
 * Tests for init wizard helpers.
 *
 * The interactive wizard itself requires stdin, so we test the
 * pure utility functions: extractFileKey and generateConfigContent.
 */

import { describe, it, expect } from 'vitest'
import { extractFileKey, generateConfigContent, ConfigData } from './init.js'

// ---------------------------------------------------------------------------
// extractFileKey
// ---------------------------------------------------------------------------

describe('extractFileKey', () => {
  it('extracts key from a direct key string', () => {
    expect(extractFileKey('abc123DEF456ghi789JKL0')).toBe('abc123DEF456ghi789JKL0')
  })

  it('extracts key from figma.com/file/ URL', () => {
    expect(extractFileKey('https://www.figma.com/file/abc123DEF456ghi789JKL0/My-File')).toBe(
      'abc123DEF456ghi789JKL0',
    )
  })

  it('extracts key from figma.com/design/ URL', () => {
    expect(extractFileKey('https://www.figma.com/design/abc123DEF456ghi789JKL0/My-File')).toBe(
      'abc123DEF456ghi789JKL0',
    )
  })

  it('extracts key from URL without protocol', () => {
    expect(extractFileKey('figma.com/file/abc123DEF456ghi789JKL0/My-File')).toBe(
      'abc123DEF456ghi789JKL0',
    )
  })

  it('returns null for invalid input', () => {
    expect(extractFileKey('not-a-key')).toBeNull()
    expect(extractFileKey('')).toBeNull()
    expect(extractFileKey('https://google.com')).toBeNull()
  })

  it('returns null for too-short key', () => {
    expect(extractFileKey('abc123')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// generateConfigContent
// ---------------------------------------------------------------------------

describe('generateConfigContent', () => {
  it('generates minimal config with no layers, brands, or outputs', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      layers: {},
      brands: [],
      outputs: [],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("import { defineConfig } from 'design-token-farm'")
    expect(result).toContain('export default defineConfig({')
    expect(result).toContain('process.env.FIGMA_FILE_KEY!')
    expect(result).toContain("dir: 'tokens'")
    expect(result).not.toContain('layers:')
    expect(result).not.toContain('brands:')
    expect(result).not.toContain('outputs:')
  })

  it('includes layer configuration when layers are provided', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      layers: { primitives: 'Primitives', brand: 'Brand' },
      brands: [],
      outputs: [],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("primitives: 'Primitives'")
    expect(result).toContain("brand: 'Brand'")
    expect(result).not.toContain('dimension:')
  })

  it('includes brands array', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      layers: {},
      brands: ['Acme', 'Globex'],
      outputs: [],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("brands: ['Acme', 'Globex']")
  })

  it('includes CSS output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      layers: {},
      brands: [],
      outputs: ['css'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain('css: {')
    expect(result).toContain("outDir: 'build/css'")
  })

  it('includes Tailwind v4 output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      layers: {},
      brands: [],
      outputs: ['tailwind4'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain('tailwind: {')
    expect(result).toContain('version: 4')
  })

  it('includes Tailwind v3 output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      layers: {},
      brands: [],
      outputs: ['tailwind3'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain('tailwind: {')
    expect(result).toContain('version: 3')
  })

  it('includes iOS output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      layers: {},
      brands: [],
      outputs: ['ios'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain('ios: {')
    expect(result).toContain("lang: 'swift'")
  })

  it('includes Android XML output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      layers: {},
      brands: [],
      outputs: ['android-xml'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain('android: {')
    expect(result).toContain("lang: 'xml'")
  })

  it('includes Android Compose output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      layers: {},
      brands: [],
      outputs: ['android-compose'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain('android: {')
    expect(result).toContain("lang: 'compose'")
  })

  it('generates full config with all options', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      layers: { primitives: 'Primitives (Global)', brand: 'Brand (Alias)', dimension: 'Screen Type' },
      brands: ['Bayernwerk', 'LEW'],
      outputs: ['css', 'tailwind4'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("primitives: 'Primitives (Global)'")
    expect(result).toContain("brand: 'Brand (Alias)'")
    expect(result).toContain("dimension: 'Screen Type'")
    expect(result).toContain("brands: ['Bayernwerk', 'LEW']")
    expect(result).toContain('css: {')
    expect(result).toContain('tailwind: {')
  })
})
