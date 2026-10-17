import { parseTokenFiles, type TokenModel } from '@dta/core'
import { describe, expect, it } from 'vitest'
import { fixtureTokens } from '../commands/test-support.js'
import type { Config } from '../config/schema.js'
import { agentsBlock, CONTEXT_MARKER, renderDesignMd, updateAgentsMd } from './render.js'

const fixture = (): TokenModel =>
  parseTokenFiles(
    Object.entries(fixtureTokens()).map(([fileName, content]) => ({ fileName, content })),
  ).model

const config = {
  tokens: { dir: 'tokens', stripEmojis: false },
  brands: ['BrandA', 'BrandB'],
  outputs: { tailwind: { outDir: 'output/tailwind' } },
  lint: {
    rules: {
      'semantic-must-alias': { collections: ['Brand(Alias)'] },
      'color-contrast': {
        minRatio: 4.5,
        pairs: [['Colors.Text.Default', 'Colors.Surface.Default']],
      },
    },
  },
} as unknown as Config

describe('renderDesignMd', () => {
  const text = renderDesignMd(fixture(), config, { version: '1.2.3' })

  it('starts with the generated marker and the version', () => {
    expect(text.startsWith(`<!-- ${CONTEXT_MARKER} (DTA 1.2.3).`)).toBe(true)
  })

  it('explains how to switch brands', () => {
    expect(text).toContain('<html data-brand="branda">')
    expect(text).toContain('`output/css/themes/<brand>.css`')
  })

  it('lists the semantic tokens with CSS, Tailwind and per-brand values, never primitives', () => {
    expect(text).toContain(
      '| Colors.Brand.Primary | `var(--colors-brand-primary)` | `--color-brand-primary` | BrandA #0057b8, BrandB #2e9e5b |',
    )
    expect(text).toContain(
      '| Colors.Brand.Accent | `var(--colors-brand-accent)` | `--color-brand-accent` | #e8731a |',
    )
    expect(text).not.toContain('| Colors.Foundation.')
    expect(text).toContain('| Primitives | Value | 26 | no: primitives, reached through aliases |')
  })

  it('marks collections the build does not write', () => {
    expect(text).toContain('| ScreenType | Desktop, Mobile, Tablet | 5 | not in the build output |')
    expect(text).not.toContain('| Spacing.Gap |')
  })

  it('takes the rules from the lint config', () => {
    expect(text).toContain('Tokens in `Brand(Alias)` are aliases only')
    expect(text).toContain('`Colors.Text.Default` on `Colors.Surface.Default`')
  })

  it('summarises by group when the tokens do not fit the budget', () => {
    const tokens: Record<string, unknown> = {}
    for (let group = 0; group < 20; group++) {
      tokens[`group${group}`] = {}
      for (let i = 0; i < 30; i++) {
        ;(tokens[`group${group}`] as Record<string, unknown>)[`token${i}`] = {
          $type: 'color',
          $value: '{base.white}',
        }
      }
    }
    const model = parseTokenFiles([
      {
        fileName: 'Base.Value.json',
        content: JSON.stringify({ base: { white: { $type: 'color', $value: '#ffffff' } } }),
      },
      { fileName: 'Semantic.Light.json', content: JSON.stringify({ semantic: tokens }) },
      { fileName: 'Semantic.Dark.json', content: JSON.stringify({ semantic: tokens }) },
    ]).model
    const large = renderDesignMd(model, { ...config, brands: ['Light', 'Dark'] } as Config, {
      version: '1.2.3',
    })
    expect(large.length).toBeLessThan(8000)
    expect(large).toContain('600 tokens, too many to list here.')
    expect(large).toContain(
      "| semantic.group0 | 30 | `token0`, `token1`, `token10`, … | `dta token list --match 'semantic.group0.**'` |",
    )
  })
})

describe('updateAgentsMd', () => {
  it('creates the file with just the block', () => {
    expect(updateAgentsMd(null, 'DESIGN.md')).toBe(`${agentsBlock('DESIGN.md')}\n`)
  })

  it('appends the block and leaves the rest byte for byte', () => {
    const existing = '# Agents\n\nRun pnpm test.\n'
    const updated = updateAgentsMd(existing, 'DESIGN.md')
    expect(updated.startsWith(existing)).toBe(true)
    expect(updated).toBe(`${existing}\n${agentsBlock('DESIGN.md')}\n`)
  })

  it('replaces only its own block, and is idempotent', () => {
    const before = '# Agents\n\n'
    const after = '\n\n## More\n\nkeep me  \n'
    const old = `${before}<!-- dta:begin -->\nold text\n<!-- dta:end -->${after}`
    const updated = updateAgentsMd(old, 'docs/DESIGN.md')
    expect(updated).toBe(`${before}${agentsBlock('docs/DESIGN.md')}${after}`)
    expect(updateAgentsMd(updated, 'docs/DESIGN.md')).toBe(updated)
  })
})
