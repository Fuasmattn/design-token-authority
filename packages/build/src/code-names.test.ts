import { parseTokenFiles } from '@dta/core'
import { describe, expect, it } from 'vitest'
import { codeNames, isBuilt } from './code-names.js'

const model = parseTokenFiles([
  {
    fileName: 'Base.Value.json',
    content: JSON.stringify({
      blue: { $type: 'color', $value: '#00f' },
      gap: {
        $type: 'number',
        $value: 8,
        $extensions: { 'com.figma': { scopes: ['GAP'] } },
      },
    }),
  },
  {
    fileName: 'Theme.Light.json',
    content: JSON.stringify({ action: { bg: { $type: 'color', $value: '{blue}' } } }),
  },
  {
    fileName: 'Theme.Dark.json',
    content: JSON.stringify({ action: { bg: { $type: 'color', $value: '{blue}' } } }),
  },
]).model

describe('isBuilt', () => {
  it('builds single-mode collections, and multi-mode ones only in the listed brands', () => {
    expect(isBuilt(model, 'Base', {})).toBe(true)
    expect(isBuilt(model, 'Base', null)).toBe(true)
    expect(isBuilt(model, 'Theme', {})).toBe(false)
    expect(isBuilt(model, 'Theme', { brands: ['Dark'] })).toBe(true)
    expect(isBuilt(model, 'Base', { collections: ['Theme'] })).toBe(false)
    expect(isBuilt(model, 'Nowhere', { brands: ['Dark'] })).toBe(false)
  })
})

describe('codeNames', () => {
  it('gives the CSS custom property and the Tailwind theme variable', () => {
    const token = { name: 'action.bg', type: 'color' as const, collection: 'Theme' }
    expect(codeNames(model, { brands: ['Light'] }, token)).toEqual({
      css: '--action-bg',
      tailwind: '--color-action-bg',
    })
    expect(codeNames(model, {}, token)).toBeUndefined()
  })

  it('reads the Figma scopes for numbers', () => {
    const token = { name: 'gap', type: 'number' as const, collection: 'Base' }
    const scoped = codeNames(model, null, token, { 'com.figma': { scopes: ['GAP'] } })
    expect(scoped?.css).toBe('--gap')
    expect(scoped?.tailwind).toMatch(/^--spacing-/)
    // Without a scope a plain number maps to no Tailwind utility.
    expect(codeNames(model, null, token)).toEqual({ css: '--gap' })
  })
})
