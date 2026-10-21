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
const gap = (value: number | string) => ({
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

  it('reads rules nested in @media with the at-rule as context', () => {
    const css = [
      '/* ScreenType · Desktop */',
      '@media (min-width: 1024px) {',
      '  :root {',
      '    --gap: var(--space-4);',
      '  }',
      '}',
      ':root {',
      '  --gap: var(--space-2);',
      '}',
    ].join('\n')
    expect(parseCssVariables(css)).toEqual([
      {
        selector: ':root',
        variable: '--gap',
        value: 'var(--space-4)',
        context: ['@media (min-width: 1024px)'],
      },
      { selector: ':root', variable: '--gap', value: 'var(--space-2)' },
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

  it('binds a single-mode token that aliases a brand token to :root only', async () => {
    // The themes repeat it (TICKET-093); dta diff finds those rules in the page and puts the
    // token back there too, because no other collection · mode declares the variable.
    const tiered = modelFrom({
      'Primitives.Value.json': { blueprint: { '600': color('#2f55d4'), '700': color('#2443ac') } },
      'Theme.BrandA.json': { action: { bg: color('{blueprint.600}') } },
      'Theme.BrandB.json': { action: { bg: color('{blueprint.700}') } },
      'Component.Value.json': { button: { bg: color('{action.bg}') } },
    })
    const { bindings } = await cssBindings(tiered, { brands: ['BrandA', 'BrandB'] })
    expect(bindings.filter((b) => b.name === 'button.bg')).toEqual([
      {
        collection: 'Component',
        mode: 'Value',
        name: 'button.bg',
        variable: '--button-bg',
        selector: ':root',
        value: 'var(--action-bg)',
      },
    ])
  })

  it('binds breakpoint modes to :root, inside their media query except the default (TICKET-091)', async () => {
    const responsive = modelFrom({
      'Primitives.Value.json': { space: { '2': gap(8), '4': gap(16) } },
      'Screen.Mobile.json': { gap: gap('{space.2}') },
      'Screen.Desktop.json': { gap: gap('{space.4}') },
    })
    const { bindings } = await cssBindings(responsive, {
      breakpoints: {
        collection: 'Screen',
        default: 'Mobile',
        media: [{ mode: 'Desktop', query: '(min-width: 1024px)' }],
      },
    })
    expect(bindings.filter((b) => b.collection === 'Screen')).toEqual([
      {
        collection: 'Screen',
        mode: 'Mobile',
        name: 'gap',
        variable: '--gap',
        selector: ':root',
        value: 'var(--space-2)',
      },
      {
        collection: 'Screen',
        mode: 'Desktop',
        name: 'gap',
        variable: '--gap',
        selector: ':root',
        context: ['@media (min-width: 1024px)'],
        value: 'var(--space-4)',
      },
    ])
  })

  it('binds no brand modes when no brands are built', async () => {
    const { bindings } = await cssBindings(model, {})
    expect(bindings.some((b) => b.collection === 'Theme')).toBe(false)
  })

  it('binds the tokens that resolve when others have broken aliases, and returns the errors', async () => {
    // dta diff reads the CSS of a base that may have such an error (a PR that fixes it).
    const broken = modelFrom({
      'Primitives.Value.json': { blueprint: { '600': color('#2f55d4') } },
      'Theme.BrandA.json': { action: { bg: color('{blueprint.600}'), fg: color('{nope}') } },
      'Theme.BrandB.json': { action: { bg: color('{blueprint.600}'), fg: color('#ffffff') } },
    })
    const { bindings, diagnostics } = await cssBindings(broken, { brands: ['BrandA', 'BrandB'] })
    expect(diagnostics).toMatchObject([{ severity: 'error', code: 'dangling-alias' }])
    expect(bindings.map((b) => `${b.mode} ${b.name}`).sort()).toEqual([
      'BrandA action.bg',
      'BrandB action.bg',
      'BrandB action.fg',
      'Value blueprint.600',
    ])
  })

  it('follows a custom CSS output folder', async () => {
    const { bindings } = await cssBindings(model, { css: { outDir: 'styles/' } })
    expect(bindings.map((b) => b.name)).toContain('space.2')
  })
})
