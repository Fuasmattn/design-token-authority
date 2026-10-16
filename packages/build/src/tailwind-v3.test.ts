import { describe, expect, it } from 'vitest'
import { parseTokenFiles } from '@dta/core'
import { buildOutputs } from './index.js'
import { fixtureModel, sharedFile, snapshot } from './test-helpers.js'
import type { Spec } from './test-helpers.js'

const tailwind = (tokens: Record<string, Spec>) =>
  sharedFile(tokens, 'output/tailwind/tailwind.tokens.ts')

describe('Tailwind v3 output', () => {
  for (const fixture of ['brand-ab', 'daisyui']) {
    it(`matches the legacy snapshots for ${fixture}`, async () => {
      const { files } = await buildOutputs(fixtureModel(fixture), {
        brands: fixture === 'brand-ab' ? ['BrandA', 'BrandB'] : [],
      })
      const expected = [
        'output/tailwind/tailwind.tokens.ts',
        ...(fixture === 'brand-ab'
          ? [
              'output/tailwind/branda/tailwind.tokens.ts',
              'output/tailwind/brandb/tailwind.tokens.ts',
            ]
          : []),
      ]
      for (const file of expected) {
        expect(files.find((f) => f.path === file)?.content, file).toBe(snapshot(fixture, file))
      }
    })
  }

  it('writes a TypeScript module with a theme.extend object', async () => {
    const ts = await tailwind({ 'Colors.red': { type: 'color', value: '#ff0000' } })
    expect(ts).toContain("import type { Config } from 'tailwindcss'")
    expect(ts).toContain('export const tokens = {')
    expect(ts).toContain('theme: {')
    expect(ts).toContain('extend: {')
    expect(ts).toContain('} satisfies Partial<Config>')
  })

  it('maps Colors/* to the colors category with var() references', async () => {
    const ts = await tailwind({
      'Colors.grey.50': { type: 'color', value: '#f8f8f8' },
      'Colors.foundation.brand.default': { type: 'color', value: '#2b5dff' },
    })
    expect(ts).toContain("colors: {\n        'grey-50': 'var(--colors-grey-50)'")
    expect(ts).toContain("'foundation-brand-default': 'var(--colors-foundation-brand-default)'")
  })

  it('maps well-known dimension, border, effect and typography paths', async () => {
    const ts = await tailwind({
      'Dimensions.spacing.4': { type: 'number', value: 16, scopes: ['GAP'] },
      'Dimensions.breakpoints.lg': { type: 'number', value: 1024, scopes: ['WIDTH_HEIGHT'] },
      'Dimensions.sizing.size-4': { type: 'number', value: 16, scopes: ['WIDTH_HEIGHT'] },
      'Borders.border-radius.rounded-md': { type: 'number', value: 6, scopes: ['CORNER_RADIUS'] },
      'Borders.border-width.border': { type: 'number', value: 1, scopes: ['STROKE_FLOAT'] },
      'Effects.opacity.opacity-50': { type: 'number', value: 50, scopes: ['OPACITY'] },
      'Effects.blur.blur-md': { type: 'number', value: 12, scopes: ['EFFECT_FLOAT'] },
      'Typography.font-family.brand-a': { type: 'string', value: 'Heading Sans' },
      'Typography.font-size.text-base': { type: 'number', value: 16 },
      'Typography.font-weight.regular': { type: 'string', value: 'Regular' },
      'Typography.line-height.body': { type: 'number', value: 24 },
    })
    expect(ts).toContain("spacing: {\n        '4': '16px'")
    expect(ts).toContain("screens: {\n        'lg': '1024px'")
    expect(ts).toContain("size: {\n        'size-4': '16px'")
    expect(ts).toContain("borderRadius: {\n        'rounded-md': '6px'")
    expect(ts).toContain("borderWidth: {\n        'border': '1px'")
    expect(ts).toContain("opacity: {\n        'opacity-50': '0.5'")
    expect(ts).toContain("blur: {\n        'blur-md': '12px'")
    expect(ts).toContain("fontFamily: {\n        'brand-a': 'Heading Sans'")
    expect(ts).toContain("fontSize: {\n        'text-base': '16'")
    expect(ts).toContain("fontWeight: {\n        'regular': 'Regular'")
    expect(ts).toContain("lineHeight: {\n        'body': '24'")
  })

  it('uses the type and Figma scopes for paths it does not know', async () => {
    const ts = await tailwind({
      'radius.fields': {
        type: 'number',
        value: 8,
        scopes: ['CORNER_RADIUS', 'WIDTH_HEIGHT', 'EFFECT_FLOAT'],
      },
      'tailwind.typography.size.sm': { type: 'number', value: 14, scopes: ['FONT_SIZE'] },
      'Overlays.white.alpha-5': { type: 'color', value: '#ffffff' },
    })
    expect(ts).toContain("borderRadius: {\n        'radius-fields': '8px'")
    expect(ts).toContain("fontSize: {\n        'tailwind-typography-size-sm': '14'")
    expect(ts).toContain("'overlays-white-alpha-5': 'var(--overlays-white-alpha-5)'")
  })

  it('files tokens it cannot map under their first path segment', async () => {
    const ts = await tailwind({ 'misc.setting': { type: 'boolean', value: true } })
    expect(ts).toContain("misc: {\n        'setting': 'true'")
  })

  it('writes resolved colors, not var() references, in the per-brand files', async () => {
    const themed = parseTokenFiles([
      {
        fileName: 'Brand.Sunrise.json',
        content: JSON.stringify({
          Colors: { grey: { 50: { $type: 'color', $value: '#f8f8f8' } } },
        }),
      },
      {
        fileName: 'Brand.Moonlight.json',
        content: JSON.stringify({
          Colors: { grey: { 50: { $type: 'color', $value: '#101010' } } },
        }),
      },
    ]).model
    const { files } = await buildOutputs(themed, { brands: ['Sunrise'] })
    const ts = files.find((f) => f.path === 'output/tailwind/sunrise/tailwind.tokens.ts')?.content
    expect(ts).toContain("'grey-50': '#f8f8f8'")
    expect(ts).not.toContain('var(--')
  })
})
