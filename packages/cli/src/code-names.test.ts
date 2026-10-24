import { parseTokenFiles } from '@dta/core'
import { describe, expect, it } from 'vitest'
import { codeNames, isBuilt } from './code-names.js'
import type { Config } from './config/schema.js'

const model = parseTokenFiles([
  {
    fileName: 'Base.Value.json',
    content: JSON.stringify({ blue: { $type: 'color', $value: '#00f' } }),
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
const config = (extra: object) => ({ tokens: { dir: 'tokens' }, ...extra }) as unknown as Config

describe('isBuilt', () => {
  it('builds single-mode collections, and multi-mode ones only in the listed brands', () => {
    expect(isBuilt(model, 'Base', config({}))).toBe(true)
    expect(isBuilt(model, 'Theme', config({}))).toBe(false)
    expect(isBuilt(model, 'Theme', config({ brands: ['Dark'] }))).toBe(true)
    expect(isBuilt(model, 'Base', config({ collections: ['Theme'] }))).toBe(false)
  })
})

describe('codeNames', () => {
  it('gives the CSS custom property and the Tailwind theme variable', () => {
    const token = { name: 'action.bg', type: 'color' as const, collection: 'Theme' }
    expect(codeNames(model, config({ brands: ['Light'] }), token)).toEqual({
      css: '--action-bg',
      tailwind: '--color-action-bg',
    })
    expect(codeNames(model, config({}), token)).toBeUndefined()
  })
})
