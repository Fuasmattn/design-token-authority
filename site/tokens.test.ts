/**
 * The website's design tokens (DTA Drafting Table) through DTA's own packages: they parse,
 * lint clean, build to one theme per mode, and keep the contrast pairs the design system
 * requires.
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildOutputs } from '@dta/build'
import { contrastRatio, parseColor, parseTokenFiles, resolve, type TokenModel } from '@dta/core'
import { lintTokens } from '@dta/lint'
import { describe, expect, it } from 'vitest'
import config from './dta.config.js'

const tokensDir = path.join(import.meta.dirname, 'tokens')
const files = fs
  .readdirSync(tokensDir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((fileName) => ({
    fileName,
    content: fs.readFileSync(path.join(tokensDir, fileName), 'utf8'),
  }))
const { model, diagnostics } = parseTokenFiles(files)

const THEMES = ['Light', 'Graphite'] as const

function color(model: TokenModel, name: string, theme: string) {
  const result = resolve(model, name.split('.'), { Theme: theme })
  if (!result.ok) throw new Error(`${name} does not resolve in ${theme}`)
  const parsed = parseColor(String(result.value))
  if (!parsed.ok) throw new Error(`${name} is not a colour: ${result.value}`)
  return parsed.color
}

describe('site design tokens', () => {
  it('parse without problems', () => {
    expect(diagnostics).toEqual([])
    expect(model.collections.map((c) => `${c.name}: ${c.modes.join(', ')}`)).toEqual([
      'Primitives: Value',
      'Theme: Graphite, Light',
    ])
  })

  it('keep the design system values', () => {
    const value = (name: string) => {
      const result = resolve(model, name.split('.'))
      return result.ok ? result.value : undefined
    }
    expect(value('paper.100')).toBe('#f5f1e8')
    expect(value('ink.900')).toBe('#13213f')
    expect(value('blueprint.600')).toBe('#2f55d4')
    expect(value('redline.500')).toBe('#e8632a')
    expect(value('graphite.900')).toBe('#161513')
    expect(value('space.4')).toBe(16)
    expect(value('radius.lg')).toBe(18)
    expect(value('stroke.redline')).toBe(1.5)
    expect(value('type.display-xl.size')).toBe(84)
    expect(value('font.mono')).toBe('"Martian Mono", ui-monospace, monospace')
  })

  it('lint clean with the site config', () => {
    const result = lintTokens(model, config.lint)
    expect(result.diagnostics).toEqual([])
    expect(result.violations).toEqual([])
  })

  it('build one theme per mode, defining every semantic variable through the primitives', async () => {
    const { files: outputs, diagnostics: buildProblems } = await buildOutputs(model, {
      brands: [...config.brands],
      css: { outDir: config.outputs.css.outDir },
    })
    expect(buildProblems).toEqual([])
    const css = (name: string) =>
      outputs.find((f) => f.path === `output/css/${name}`)?.content ?? ''
    const defined = (text: string) =>
      new Set([...text.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]))
    const base = defined(css('base.css'))

    const semantic = model.collections
      .find((c) => c.name === 'Theme')!
      .tokens.map((token) => `--${token.name.join('-')}`)
    for (const theme of THEMES) {
      const file = css(`themes/${theme.toLowerCase()}.css`)
      expect(file).toContain(`[data-brand="${theme.toLowerCase()}"]`)
      expect([...defined(file)].sort()).toEqual([...semantic].sort())
      for (const [, used] of file.matchAll(/var\((--[\w-]+)\)/g)) {
        expect(base.has(used), `${theme}: ${used} is not defined in base.css`).toBe(true)
      }
    }
  })

  // Pairs the design system README requires: text 4.5:1 on its grounds in every theme.
  const TEXT_PAIRS: Array<[string, string]> = [
    ['fg.default', 'bg.canvas'],
    ['fg.default', 'bg.surface'],
    ['fg.muted', 'bg.canvas'],
    ['fg.muted', 'bg.surface'],
    ['fg.subtle', 'bg.canvas'],
    ['fg.subtle', 'bg.surface'],
    ['action.fg', 'action.bg'],
    ['action.text', 'action.subtle'],
    ['signal.fg', 'signal.bg'],
    ['signal.text', 'signal.subtle'],
    ['success.fg', 'bg.surface'],
    ['terminal.fg', 'terminal.bg'],
  ]

  it.each(THEMES)('keep text contrast of at least 4.5:1 in %s', (theme) => {
    for (const [fg, bg] of TEXT_PAIRS) {
      const ratio = contrastRatio(color(model, fg, theme), color(model, bg, theme))
      expect(ratio, `${fg} on ${bg} in ${theme}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('show why text on the redline is dark: white on signal.bg fails', () => {
    const white = color(model, 'paper.0', 'Light')
    expect(contrastRatio(white, color(model, 'signal.bg', 'Light'))).toBeLessThan(4.5)
  })
})
