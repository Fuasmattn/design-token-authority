import { describe, it, expect } from 'vitest'
import { tailwindV3Formatter } from './tailwind-v3.js'
import type { Dictionary, TransformedToken } from 'style-dictionary/types'

// Minimal mock for the dictionary argument — only allTokens is used by the formatter
function makeDictionary(tokens: Partial<TransformedToken>[]): Dictionary {
  return { allTokens: tokens as TransformedToken[] } as unknown as Dictionary
}

// Minimal stubs for unused formatter args
const UNUSED = {} as never

describe('tailwindV3Formatter', () => {
  it('outputs the TypeScript boilerplate', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).toContain("import type { Config } from 'tailwindcss'")
    expect(output).toContain('export const tokens = {')
    expect(output).toContain('theme: {')
    expect(output).toContain('extend: {')
    expect(output).toContain('} satisfies Partial<Config>')
  })

  it('maps Colors/* tokens to the colors category with var() references', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Colors', 'grey', '50'],
          name: 'colors-grey-50',
          value: '#f8f8f8',
          $type: 'color',
        },
        {
          path: ['Colors', 'foundation', 'brand', 'default'],
          name: 'colors-foundation-brand-default',
          value: 'var(--colors-blue-600)',
          $type: 'color',
        },
      ]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).toContain("'grey-50': 'var(--colors-grey-50)'")
    expect(output).toContain("'foundation-brand-default': 'var(--colors-foundation-brand-default)'")
    expect(output).toContain('colors: {')
  })

  it('maps Dimensions/spacing/* tokens to the spacing category with actual values', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Dimensions', 'spacing', '4'],
          name: 'dimensions-spacing-4',
          value: '16px',
          $type: 'number',
        },
        {
          path: ['Dimensions', 'spacing', '0'],
          name: 'dimensions-spacing-0',
          value: '0px',
          $type: 'number',
        },
      ]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).toContain("'4': '16px'")
    expect(output).toContain("'0': '0px'")
    expect(output).toContain('spacing: {')
  })

  it('maps Dimensions/breakpoints/* tokens to the screens category', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Dimensions', 'breakpoints', 'sm'],
          name: 'dimensions-breakpoints-sm',
          value: '640px',
          $type: 'number',
        },
      ]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).toContain("'sm': '640px'")
    expect(output).toContain('screens: {')
  })

  it('maps Dimensions/sizing/* tokens to the size category', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Dimensions', 'sizing', 'size-4'],
          name: 'dimensions-sizing-size-4',
          value: '16px',
          $type: 'number',
        },
      ]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).toContain("'size-4': '16px'")
    expect(output).toContain('size: {')
  })

  it('maps Borders/border-radius/* tokens to the borderRadius category', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Borders', 'border-radius', 'rounded-md'],
          name: 'borders-border-radius-rounded-md',
          value: '6px',
          $type: 'number',
        },
        {
          path: ['Borders', 'border-radius', 'rounded-full'],
          name: 'borders-border-radius-rounded-full',
          value: '9999px',
          $type: 'number',
        },
      ]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).toContain("'rounded-md': '6px'")
    expect(output).toContain("'rounded-full': '9999px'")
    expect(output).toContain('borderRadius: {')
  })

  it('maps Borders/border-width/* tokens to the borderWidth category', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Borders', 'border-width', 'border'],
          name: 'borders-border-width-border',
          value: '1px',
          $type: 'number',
        },
      ]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).toContain("'border': '1px'")
    expect(output).toContain('borderWidth: {')
  })

  it('maps Effects/opacity/* tokens to the opacity category with actual values', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Effects', 'opacity', 'opacity-50'],
          name: 'effects-opacity-50',
          value: '0.5',
          $type: 'number',
        },
      ]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).toContain("'opacity-50': '0.5'")
    expect(output).toContain('opacity: {')
  })

  it('maps Effects/blur/* tokens to the blur category with actual values', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Effects', 'blur', 'blur-md'],
          name: 'effects-blur-md',
          value: '12px',
          $type: 'number',
        },
      ]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).toContain("'blur-md': '12px'")
    expect(output).toContain('blur: {')
  })

  it('maps Typography/* tokens to the correct categories', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Typography', 'font-family', 'bayernwerk'],
          name: 'typography-font-family-bayernwerk',
          value: 'Polo 11',
          $type: 'string',
        },
        {
          path: ['Typography', 'font-size', 'text-base'],
          name: 'typography-font-size-text-base',
          value: '16',
          $type: 'number',
        },
        {
          path: ['Typography', 'font-weight', 'regular'],
          name: 'typography-font-weight-regular',
          value: 'Regular',
          $type: 'string',
        },
        {
          path: ['Typography', 'line-height', 'body'],
          name: 'typography-line-height-body',
          value: '24',
          $type: 'number',
        },
      ]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).toContain("'bayernwerk': 'Polo 11'")
    expect(output).toContain('fontFamily: {')
    expect(output).toContain("'text-base': '16'")
    expect(output).toContain('fontSize: {')
    expect(output).toContain("'regular': 'Regular'")
    expect(output).toContain('fontWeight: {')
    expect(output).toContain("'body': '24'")
    expect(output).toContain('lineHeight: {')
  })

  it('outputs resolved color values when resolvedValues option is true', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Colors', 'grey', '50'],
          name: 'colors-grey-50',
          value: '#f8f8f8',
          $type: 'color',
        },
        {
          path: ['Colors', 'foundation', 'brand', 'default'],
          name: 'colors-foundation-brand-default',
          value: '#003f8a',
          $type: 'color',
        },
      ]),
      platform: UNUSED,
      options: { resolvedValues: true },
      file: UNUSED,
    })
    expect(output).toContain("'grey-50': '#f8f8f8'")
    expect(output).toContain("'foundation-brand-default': '#003f8a'")
    expect(output).not.toContain('var(--')
  })

  it('skips tokens with unrecognised top-level groups', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Overlays', 'white', 'alpha-5'],
          name: 'overlays-white-alpha-5',
          value: 'rgba(255,255,255,0.05)',
          $type: 'color',
        },
      ]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).not.toContain('overlays')
  })

  it('skips Dimensions tokens with unrecognised sub-group', () => {
    const output = tailwindV3Formatter({
      dictionary: makeDictionary([
        {
          path: ['Dimensions', 'unknown', 'foo'],
          name: 'dimensions-unknown-foo',
          value: '8px',
          $type: 'number',
        },
      ]),
      platform: UNUSED,
      options: UNUSED,
      file: UNUSED,
    })
    expect(output).not.toContain('unknown')
  })
})
