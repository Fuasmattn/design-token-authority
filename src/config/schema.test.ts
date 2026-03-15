import { describe, it, expect } from 'vitest'
import { validateConfig, defineConfig, ConfigValidationError } from './schema.js'

const MINIMAL_CONFIG = {
  figma: {
    fileKey: 'abc123',
    personalAccessToken: 'figd_xxx',
  },
}

const FULL_CONFIG = {
  figma: {
    fileKey: 'abc123',
    personalAccessToken: 'figd_xxx',
  },
  collections: ['Primitives(Global)', 'Brand(Alias)', 'ScreenType'],
  layers: {
    primitives: 'Primitives(Global)',
    brand: 'Brand(Alias)',
    dimension: 'ScreenType',
  },
  brands: ['Sunrise', 'Moonlight'],
  tokens: { dir: 'my-tokens' },
  outputs: {
    css: { outDir: 'build/css', prefix: '--ds' },
    tailwind: { outDir: 'build/tailwind', version: 3 as const },
    ios: { outDir: 'build/ios', lang: 'swift' as const },
    android: { outDir: 'build/android', lang: 'compose' as const },
  },
}

describe('validateConfig', () => {
  it('accepts a minimal config with only figma credentials', () => {
    const result = validateConfig(MINIMAL_CONFIG)
    expect(result.figma.fileKey).toBe('abc123')
    expect(result.figma.personalAccessToken).toBe('figd_xxx')
  })

  it('applies default tokens.dir when not provided', () => {
    const result = validateConfig(MINIMAL_CONFIG)
    expect(result.tokens?.dir).toBe('tokens')
  })

  it('accepts and preserves a full config', () => {
    const result = validateConfig(FULL_CONFIG)
    expect(result.figma.fileKey).toBe('abc123')
    expect(result.collections).toEqual(['Primitives(Global)', 'Brand(Alias)', 'ScreenType'])
    expect(result.layers?.primitives).toBe('Primitives(Global)')
    expect(result.layers?.brand).toBe('Brand(Alias)')
    expect(result.layers?.dimension).toBe('ScreenType')
    expect(result.brands).toEqual(['Sunrise', 'Moonlight'])
    expect(result.tokens?.dir).toBe('my-tokens')
    expect(result.outputs?.css?.outDir).toBe('build/css')
    expect(result.outputs?.css?.prefix).toBe('--ds')
    expect(result.outputs?.tailwind?.version).toBe(3)
    expect(result.outputs?.ios?.lang).toBe('swift')
    expect(result.outputs?.android?.lang).toBe('compose')
  })

  it('validates collections as an array of strings', () => {
    const result = validateConfig({
      ...MINIMAL_CONFIG,
      collections: ['Primitives', 'Brand'],
    })
    expect(result.collections).toEqual(['Primitives', 'Brand'])
  })

  it('throws on non-array collections', () => {
    expect(() => validateConfig({ ...MINIMAL_CONFIG, collections: 'Primitives' })).toThrow(
      /collections/,
    )
  })

  it('applies default tailwind version 4 when not specified', () => {
    const config = {
      ...MINIMAL_CONFIG,
      outputs: { tailwind: { outDir: 'build/tw' } },
    }
    const result = validateConfig(config)
    expect(result.outputs?.tailwind?.version).toBe(4)
  })

  it('applies default android lang xml when not specified', () => {
    const config = {
      ...MINIMAL_CONFIG,
      outputs: { android: { outDir: 'build/android' } },
    }
    const result = validateConfig(config)
    expect(result.outputs?.android?.lang).toBe('xml')
  })

  it('applies default css prefix when not specified', () => {
    const config = {
      ...MINIMAL_CONFIG,
      outputs: { css: { outDir: 'build/css' } },
    }
    const result = validateConfig(config)
    expect(result.outputs?.css?.prefix).toBe('--')
  })

  // ------- Error cases -------

  it('throws on missing figma object', () => {
    expect(() => validateConfig({})).toThrow(ConfigValidationError)
    expect(() => validateConfig({})).toThrow(/figma/)
  })

  it('allows missing figma.fileKey (optional for file-based import)', () => {
    const config = validateConfig({ figma: { personalAccessToken: 'x' } })
    expect(config.figma.fileKey).toBeUndefined()
  })

  it('throws on empty figma.fileKey', () => {
    expect(() => validateConfig({ figma: { fileKey: '', personalAccessToken: 'x' } })).toThrow(
      /figma\.fileKey/,
    )
  })

  it('allows missing figma.personalAccessToken (optional for file-based import)', () => {
    const config = validateConfig({ figma: { fileKey: 'abc' } })
    expect(config.figma.personalAccessToken).toBeUndefined()
  })

  it('allows figma.source to be api or file', () => {
    const apiConfig = validateConfig({ figma: { source: 'api' } })
    expect(apiConfig.figma.source).toBe('api')
    const fileConfig = validateConfig({ figma: { source: 'file' } })
    expect(fileConfig.figma.source).toBe('file')
  })

  it('throws on invalid figma.source', () => {
    expect(() => validateConfig({ figma: { source: 'invalid' } })).toThrow(/figma\.source/)
  })

  it('throws on non-array brands', () => {
    expect(() => validateConfig({ ...MINIMAL_CONFIG, brands: 'Sunrise' })).toThrow(/brands/)
  })

  it('throws on invalid tailwind version', () => {
    expect(() =>
      validateConfig({
        ...MINIMAL_CONFIG,
        outputs: { tailwind: { outDir: 'x', version: 2 } },
      }),
    ).toThrow(/outputs\.tailwind\.version/)
  })

  it('throws on invalid android lang', () => {
    expect(() =>
      validateConfig({
        ...MINIMAL_CONFIG,
        outputs: { android: { outDir: 'x', lang: 'kotlin' } },
      }),
    ).toThrow(/outputs\.android\.lang/)
  })

  it('throws when config is not an object', () => {
    expect(() => validateConfig('string')).toThrow(ConfigValidationError)
    expect(() => validateConfig(null)).toThrow(ConfigValidationError)
    expect(() => validateConfig(42)).toThrow(ConfigValidationError)
  })
})

describe('defineConfig', () => {
  it('returns the config object unchanged (identity helper)', () => {
    const config = { ...FULL_CONFIG }
    expect(defineConfig(config)).toBe(config)
  })
})
