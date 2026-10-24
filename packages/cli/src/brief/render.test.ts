import fs from 'node:fs'
import path from 'node:path'
import { parseTokenFiles, type TokenModel } from '@dta/core'
import { describe, expect, it } from 'vitest'
import { fixtureTokens } from '../commands/test-support.js'
import type { Config } from '../config/schema.js'
import { briefMarkdown, buildBrief } from './render.js'

const repo = path.resolve(import.meta.dirname, '..', '..', '..', '..')
const fixture = (): TokenModel =>
  parseTokenFiles(
    Object.entries(fixtureTokens()).map(([fileName, content]) => ({ fileName, content })),
  ).model
const config = {
  tokens: { dir: 'tokens' },
  brands: ['BrandA', 'BrandB'],
  breakpoints: {
    collection: 'ScreenType',
    default: 'Mobile',
    modes: { Tablet: '(min-width: 768px)', Desktop: '(min-width: 1024px)' },
  },
} as unknown as Config

describe('buildBrief (TICKET-031)', () => {
  it("takes each brand's values: the role colours, text and surfaces from the semantic tokens", () => {
    const a = buildBrief(fixture(), config, 'BrandA')
    const b = buildBrief(fixture(), config, 'BrandB')
    expect(a.colors.roles[0]).toEqual({
      role: 'primary',
      token: 'Colors.Brand.Primary',
      value: '#0057b8',
      use: 'main actions, links, brand moments',
    })
    expect(b.colors.roles[0].value).toBe('#3d5a80')
    expect(a.colors.text.map((c) => c.token)).toEqual(['Colors.Text.Default', 'Colors.Text.Muted'])
    // White text meant for the primary colour is not a text colour on its own.
    expect(a.colors.text.map((c) => c.token)).not.toContain('Colors.Text.On Primary')
    expect(a.colors.surface.map((c) => c.token)).toContain('Colors.Surface.Default')
    // Neutrals from dark to light.
    expect(a.colors.neutrals.map((c) => c.value)).toEqual([
      '#111827',
      '#6b7280',
      '#f3f4f6',
      '#ffffff',
    ])
    // Fonts with the token that says what they are for, the semantic one first.
    expect(a.typography.families[0]).toEqual({ token: 'Typography.Body.Family', value: 'Inter' })
    expect(b.typography.families[0].value).toBe('Source Serif 4')
  })

  it('lists typography, spacing and radii as values, and the breakpoints from the config', () => {
    const brief = buildBrief(fixture(), config, 'BrandA')
    expect(brief.typography.sizes).toEqual([14, 16, 20, 28])
    expect(brief.spacing).toEqual([4, 8, 16, 32])
    expect(brief.radius).toEqual([4, 8, 999])
    expect(brief.breakpoints).toEqual([
      { mode: 'Mobile', query: null },
      { mode: 'Tablet', query: '(min-width: 768px)' },
      { mode: 'Desktop', query: '(min-width: 1024px)' },
    ])
  })

  it('says what the config says beyond the tokens, or one generic rule', () => {
    const brief = buildBrief(
      fixture(),
      {
        ...config,
        brief: { identity: 'Calm and institutional.', rules: ['Never use pure black.'] },
      } as unknown as Config,
      'BrandA',
    )
    expect(brief.identity).toBe('Calm and institutional.')
    expect(brief.rules).toEqual(['Never use pure black.'])
    expect(buildBrief(fixture(), config, 'BrandA').rules).toEqual([
      'Use only the values in this brief: no other colours, sizes or fonts.',
    ])
  })

  it('stays near 400 tokens (about 1,600 characters)', () => {
    const text = briefMarkdown(buildBrief(fixture(), config, 'BrandA'))
    expect(text.startsWith('# BrandA brief\n')).toBe(true)
    expect(text.length).toBeLessThan(1600)
  })

  it('keeps long scales short: at most 6 sizes, first and last included', () => {
    const sizes = Object.fromEntries(
      [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40].map((px) => [
        `${px}`,
        { $type: 'dimension', $value: { value: px, unit: 'px' } },
      ]),
    )
    const { model } = parseTokenFiles([
      { fileName: 'Base.Value.json', content: JSON.stringify({ fontSize: sizes }) },
    ])
    const brief = buildBrief(model, null, null)
    expect(brief.typography.sizes).toHaveLength(6)
    expect(brief.typography.sizes[0]).toBe(10)
    expect(brief.typography.sizes.at(-1)).toBe(40)
    expect(briefMarkdown(brief).startsWith('# Design system brief')).toBe(true)
  })

  it('gives a sensible brief for a large theme set (daisyui)', () => {
    const dir = path.join(repo, 'test', 'fixtures', 'daisyui', 'tokens')
    const { model } = parseTokenFiles(
      fs.readdirSync(dir).map((fileName) => ({
        fileName,
        content: fs.readFileSync(path.join(dir, fileName), 'utf8'),
      })),
    )
    const brief = buildBrief(model, null, null)
    // The semantic main colours, not a theme's: accent from main.color, not alias.<theme>.
    expect(brief.colors.roles.map((r) => r.role)).toEqual([
      'primary',
      'secondary',
      'accent',
      'success',
      'warning',
      'error',
      'info',
    ])
    expect(brief.colors.roles.every((r) => r.token.startsWith('main.'))).toBe(true)
    // A ramp from black to white, not the eight darkest values.
    expect(brief.colors.neutrals[0].value).toBe('#000000')
    expect(brief.colors.neutrals.at(-1)?.value).toBe('#ffffff')
    // Bold weights stay in the list.
    expect(brief.typography.weights).toContain(700)
    expect(briefMarkdown(brief).length).toBeLessThan(1600)
  })
})
