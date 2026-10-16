import { describe, expect, it } from 'vitest'
import { parseTokenFiles } from '@dta/core'
import type { TokenModel } from '@dta/core'
import { cssBindings, cssVariableName, parseCssVariables } from './index.js'

function modelFrom(files: Record<string, unknown>): TokenModel {
  return parseTokenFiles(
    Object.entries(files).map(([fileName, content]) => ({
      fileName,
      content: JSON.stringify(content),
    })),
  ).model
}

const color = (value: string) => ({ $type: 'color', $value: value })
const gap = (value: number) => ({
  $type: 'number',
  $value: value,
  $extensions: { 'com.figma': { scopes: ['GAP'] } },
})

const model = modelFrom({
  'Primitives.Value.json': {
    blueprint: { '600': color('#2f55d4'), '700': color('#2443ac') },
    space: { '2': gap(8) },
    link: color('{blueprint.600}'),
  },
  'Theme.BrandA.json': { action: { bg: color('{blueprint.600}') } },
  'Theme.BrandB.json': { action: { bg: color('{blueprint.700}') } },
})

describe('cssVariableName', () => {
  it('kebab-cases a path and collapses repeated neighbouring words', () => {
    expect(cssVariableName(['Colors', 'Colors Brand', 'Primary'])).toBe('colors-brand-primary')
    expect(cssVariableName(['space', '2'])).toBe('space-2')
  })
})

describe('parseCssVariables', () => {
  it('reads declarations with their rule, ignoring comments', () => {
    const css = [
      '/**',
      ' * Do not edit directly, this file was auto-generated.',
      ' */',
      '',
      '[data-brand="a"] {',
      '  --action-bg: var(--blueprint-600); /** Primary buttons. */',
      '  --font: "Instrument Sans", system-ui;',
      '}',
      ':root {',
      '  --space-2: 8px;',
      '}',
    ].join('\n')
    expect(parseCssVariables(css)).toEqual([
      { selector: '[data-brand="a"]', variable: '--action-bg', value: 'var(--blueprint-600)' },
      { selector: '[data-brand="a"]', variable: '--font', value: '"Instrument Sans", system-ui' },
      { selector: ':root', variable: '--space-2', value: '8px' },
    ])
  })
})

describe('cssBindings', () => {
  it('binds single-mode tokens to :root with references, brand modes to their selector', async () => {
    const { bindings } = await cssBindings(model, { brands: ['BrandA', 'BrandB'] })
    const by = (name: string, mode: string) =>
      bindings.find((b) => b.name === name && b.mode === mode)
    expect(by('blueprint.600', 'Value')).toEqual({
      collection: 'Primitives',
      mode: 'Value',
      name: 'blueprint.600',
      variable: '--blueprint-600',
      selector: ':root',
      value: '#2f55d4',
    })
    expect(by('space.2', 'Value')?.value).toBe('8px')
    expect(by('link', 'Value')?.value).toBe('var(--blueprint-600)')
    expect(by('action.bg', 'BrandA')).toMatchObject({
      collection: 'Theme',
      selector: '[data-brand="branda"]',
      variable: '--action-bg',
      value: 'var(--blueprint-600)',
    })
    expect(by('action.bg', 'BrandB')?.value).toBe('var(--blueprint-700)')
  })

  it('binds no brand modes when no brands are built', async () => {
    const { bindings } = await cssBindings(model, {})
    expect(bindings.some((b) => b.collection === 'Theme')).toBe(false)
  })

  it('follows a custom CSS output folder', async () => {
    const { bindings } = await cssBindings(model, { css: { outDir: 'styles/' } })
    expect(bindings.map((b) => b.name)).toContain('space.2')
  })
})
