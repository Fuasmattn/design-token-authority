/** Pure helpers of the init wizard; the prompts are tested in init.test.ts. */

import { describe, it, expect } from 'vitest'
import { OUTPUT_FORMATS } from '@dta/build'
import {
  OUTPUT_OPTIONS,
  extractFileKey,
  generateConfigContent,
  outputFormats,
  type ConfigData,
} from './init-config.js'

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
// outputFormats
// ---------------------------------------------------------------------------

describe('outputFormats', () => {
  it('maps each buildable answer to its build format', () => {
    expect(outputFormats(['css'])).toEqual(['css'])
    expect(outputFormats(['tailwind4'])).toEqual(['tailwind-v4'])
    expect(outputFormats(['tailwind3'])).toEqual(['tailwind-v3'])
    expect(outputFormats(['js'])).toEqual(['js'])
  })

  it('keeps the order of OUTPUT_FORMATS, whatever the order of the answer', () => {
    expect(outputFormats(['js', 'tailwind3', 'css', 'tailwind4'])).toEqual([...OUTPUT_FORMATS])
  })

  it('leaves out the targets dta build does not write yet', () => {
    expect(outputFormats(['css', 'ios', 'android-xml', 'android-compose'])).toEqual(['css'])
    expect(outputFormats(['ios'])).toEqual([])
  })

  it('offers every build format in the wizard', () => {
    expect(outputFormats(OUTPUT_OPTIONS.map((option) => option.value))).toEqual([...OUTPUT_FORMATS])
  })
})

// ---------------------------------------------------------------------------
// generateConfigContent
// ---------------------------------------------------------------------------

describe('generateConfigContent', () => {
  it('generates minimal config with no layers, brands, or outputs', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: [],
      brands: [],
      stripEmojis: false,
      outputs: [],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("import { defineConfig } from 'design-token-authority'")
    expect(result).toContain('export default defineConfig({')
    expect(result).toContain('process.env.FIGMA_FILE_KEY!')
    expect(result).toContain("dir: 'tokens'")
    expect(result).not.toContain('collections:')
    expect(result).not.toContain('brands:')
    expect(result).not.toContain('outputs:')
  })

  it('includes collections when provided', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: ['Primitives', 'Brand'],
      brands: [],
      stripEmojis: false,
      outputs: [],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("collections: ['Primitives', 'Brand']")
  })

  it('includes brands array', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: [],
      brands: ['Acme', 'Globex'],
      stripEmojis: false,
      outputs: [],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("brands: ['Acme', 'Globex']")
  })

  it('includes CSS output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: [],
      brands: [],
      stripEmojis: false,
      outputs: ['css'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("formats: ['css'],")
    expect(result).toContain('css: {')
    expect(result).toContain("outDir: 'build/css'")
    expect(result).not.toContain('prefix')
  })

  it('writes formats for JS alone, without a folder block', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: [],
      brands: [],
      stripEmojis: false,
      outputs: ['js'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("outputs: {\n    formats: ['js'],\n  },")
  })

  it('omits formats when only targets that are not built yet are chosen', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: [],
      brands: [],
      stripEmojis: false,
      outputs: ['ios'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain('ios: {')
    expect(result).not.toContain('formats:')
  })

  it('includes Tailwind v4 output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: [],
      brands: [],
      stripEmojis: false,
      outputs: ['tailwind4'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("formats: ['tailwind-v4'],")
    expect(result).toContain('tailwind: {')
    expect(result).not.toContain('version')
  })

  it('includes Tailwind v3 output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: [],
      brands: [],
      stripEmojis: false,
      outputs: ['tailwind3'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("formats: ['tailwind-v3'],")
    expect(result).toContain('tailwind: {')
    expect(result).not.toContain('version')
  })

  it('includes iOS output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: [],
      brands: [],
      stripEmojis: false,
      outputs: ['ios'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain('ios: {')
    expect(result).toContain("lang: 'swift'")
  })

  it('includes Android XML output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: [],
      brands: [],
      stripEmojis: false,
      outputs: ['android-xml'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain('android: {')
    expect(result).toContain("lang: 'xml'")
  })

  it('includes Android Compose output', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: [],
      brands: [],
      stripEmojis: false,
      outputs: ['android-compose'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain('android: {')
    expect(result).toContain("lang: 'compose'")
  })

  it('includes stripEmojis when true', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: ['theme'],
      brands: [],
      stripEmojis: true,
      outputs: [],
    }
    const result = generateConfigContent(data)
    expect(result).toContain('stripEmojis: true')
  })

  it('omits stripEmojis when false', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: [],
      brands: [],
      stripEmojis: false,
      outputs: [],
    }
    const result = generateConfigContent(data)
    expect(result).not.toContain('stripEmojis')
  })

  it('generates full config with all options', () => {
    const data: ConfigData = {
      fileKey: 'testkey123',
      collections: ['Primitives (Global)', 'Brand (Alias)', 'Screen Type'],
      brands: ['BrandA', 'BrandB'],
      stripEmojis: false,
      outputs: ['css', 'tailwind4'],
    }
    const result = generateConfigContent(data)
    expect(result).toContain("collections: ['Primitives (Global)', 'Brand (Alias)', 'Screen Type']")
    expect(result).toContain("brands: ['BrandA', 'BrandB']")
    expect(result).toContain("formats: ['css', 'tailwind-v4'],")
    expect(result).toContain('css: {')
    expect(result).toContain('tailwind: {')
  })
})
