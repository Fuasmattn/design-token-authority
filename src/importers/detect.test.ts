import { describe, it, expect } from 'vitest'
import { detectFormat } from './detect.js'

describe('detectFormat', () => {
  it('detects tokenhaus format when $extensions.com.figma.modes is present', () => {
    const data = {
      $name: 'My File',
      $extensions: {
        'com.figma': {
          modes: { 'col:1': ['mode:1'] },
        },
      },
      Colors: {
        Primary: { $type: 'color', $value: { Light: '#fff', Dark: '#000' } },
      },
    }
    expect(detectFormat(data)).toBe('tokenhaus')
  })

  it('detects dtcg-per-mode format with scalar $value', () => {
    const data = {
      Colors: {
        Primary: { $type: 'color', $value: '#003f8a', $description: 'Primary' },
      },
    }
    expect(detectFormat(data)).toBe('dtcg-per-mode')
  })

  it('returns unknown for empty objects', () => {
    expect(detectFormat({})).toBe('unknown')
  })

  it('returns unknown for non-token data', () => {
    expect(detectFormat({ foo: 'bar', baz: 42 })).toBe('unknown')
  })

  it('prefers tokenhaus over dtcg-per-mode when both patterns present', () => {
    const data = {
      $extensions: {
        'com.figma': { modes: { 'col:1': ['mode:1'] } },
      },
      Colors: {
        Primary: { $type: 'color', $value: '#fff' },
      },
    }
    expect(detectFormat(data)).toBe('tokenhaus')
  })
})
