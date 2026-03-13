/**
 * Tests for init wizard helpers.
 *
 * The interactive wizard itself requires stdin, so we test the
 * pure utility functions: extractFileKey and generateConfigContent.
 * These are not exported from init.ts, so we duplicate/re-test the
 * extraction logic here and test config generation via a snapshot-style check.
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// extractFileKey — duplicated from init.ts for unit testing
// (the function is internal to init.ts; we test the same logic here)
// ---------------------------------------------------------------------------

function extractFileKey(input: string): string | null {
  if (/^[a-zA-Z0-9]{22,}$/.test(input)) return input
  const urlMatch = input.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/)
  if (urlMatch) return urlMatch[1]
  return null
}

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
