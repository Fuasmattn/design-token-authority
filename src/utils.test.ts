import { describe, it, expect } from 'vitest'
import { sanitizeFileName } from './utils.js'

describe('sanitizeFileName', () => {
  it('returns name unchanged when stripEmojis is false', () => {
    expect(sanitizeFileName('🎨 theme', false)).toBe('🎨 theme')
    expect(sanitizeFileName('🌀 tailwind - spacing', false)).toBe('🌀 tailwind - spacing')
  })

  it('strips emojis and trims when stripEmojis is true', () => {
    expect(sanitizeFileName('🎨 theme', true)).toBe('theme')
    expect(sanitizeFileName('🌀 tailwind - spacing', true)).toBe('tailwind - spacing')
  })

  it('handles names with emojis in the middle', () => {
    expect(sanitizeFileName('my 🎨 theme', true)).toBe('my theme')
  })

  it('handles names without emojis', () => {
    expect(sanitizeFileName('Primitives', true)).toBe('Primitives')
    expect(sanitizeFileName('Brand(Alias)', true)).toBe('Brand(Alias)')
  })

  it('handles multiple emojis', () => {
    expect(sanitizeFileName('🎨🌀 colors', true)).toBe('colors')
  })

  it('handles emoji-only names by returning empty string', () => {
    expect(sanitizeFileName('🎨', true)).toBe('')
  })
})
