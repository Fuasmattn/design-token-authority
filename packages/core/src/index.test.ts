import { describe, expect, it } from 'vitest'
import { parseAlias } from './index.js'

describe('parseAlias', () => {
  it('returns the path segments of an alias reference', () => {
    expect(parseAlias('{Colors.Foundation.Blue.700}')).toEqual([
      'Colors',
      'Foundation',
      'Blue',
      '700',
    ])
  })

  it('accepts a single-segment alias', () => {
    expect(parseAlias('{Primary}')).toEqual(['Primary'])
  })

  it('returns null for raw values', () => {
    expect(parseAlias('#003f8a')).toBeNull()
    expect(parseAlias('16px')).toBeNull()
  })

  it('returns null for non-string values', () => {
    expect(parseAlias(16)).toBeNull()
    expect(parseAlias(true)).toBeNull()
    expect(parseAlias(undefined)).toBeNull()
  })

  it('returns null for malformed references', () => {
    expect(parseAlias('{}')).toBeNull()
    expect(parseAlias('{Colors..Blue}')).toBeNull()
    expect(parseAlias('{Colors.Blue')).toBeNull()
    expect(parseAlias('prefix {Colors.Blue}')).toBeNull()
  })
})
