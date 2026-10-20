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

  // Motion tokens are strings DTA builds as they are (TICKET-116): a CSS duration in ms and a
  // cubic-bezier easing (DTCG `duration`/`cubicBezier` are not in DTA's token model yet).
  it('keep the motion scale and come out of dta build as ms and cubic-bezier()', async () => {
    const motion = model.collections
      .find((c) => c.name === 'Primitives')!
      .tokens.filter((token) => token.name[0] === 'motion')
    const values = Object.fromEntries(
      motion.map((token) => [token.name.join('.'), token.values.Value]),
    )
    expect(values).toEqual({
      'motion.duration.instant': '0ms',
      'motion.duration.fast': '120ms',
      'motion.duration.base': '200ms',
      'motion.duration.slow': '320ms',
      'motion.duration.highlight': '1200ms',
      'motion.stagger': '40ms',
      'motion.ease.standard': 'cubic-bezier(0.2, 0, 0, 1)',
      'motion.ease.enter': 'cubic-bezier(0, 0, 0, 1)',
      'motion.ease.exit': 'cubic-bezier(0.3, 0, 1, 1)',
    })
    for (const token of motion) expect(token.type).toBe('string')

    const { files: outputs } = await buildOutputs(model, {
      brands: [...config.brands],
      css: { outDir: config.outputs.css.outDir },
    })
    const base = outputs.find((f) => f.path === 'output/css/base.css')?.content ?? ''
    expect(base).toMatch(/--motion-duration-base: 200ms;/)
    expect(base).toMatch(/--motion-stagger: 40ms;/)
    expect(base).toMatch(/--motion-ease-standard: cubic-bezier\(0\.2, 0, 0, 1\);/)
    for (const [, value] of base.matchAll(/--motion-duration-[\w-]+: ([^;]+);/g)) {
      expect(value).toMatch(/^\d+ms$/)
    }
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

  // Pairs the design system requires: text at 7:1 (AAA) on its grounds in every theme.
  const TEXT_PAIRS: Array<[string, string]> = [
    ['fg.default', 'bg.canvas'],
    ['fg.default', 'bg.surface'],
    ['fg.muted', 'bg.canvas'],
    ['fg.muted', 'bg.surface'],
    ['fg.muted', 'bg.subtle'],
    ['fg.subtle', 'bg.canvas'],
    ['fg.subtle', 'bg.surface'],
    ['action.bg', 'bg.canvas'],
    ['action.fg', 'action.bg'],
    ['action.text', 'bg.canvas'],
    ['action.text', 'action.subtle'],
    ['action.text', 'bg.subtle'],
    ['action.fg', 'action.text'],
    ['signal.text', 'bg.canvas'],
    ['signal.text', 'signal.subtle'],
    ['terminal.fg', 'terminal.bg'],
    ['terminal.prompt', 'terminal.bg'],
    ['terminal.success', 'terminal.bg'],
    ['terminal.muted', 'terminal.bg'],
  ]

  it.each(THEMES)('keep text contrast of at least 7:1 in %s', (theme) => {
    for (const [fg, bg] of TEXT_PAIRS) {
      const ratio = contrastRatio(color(model, fg, theme), color(model, bg, theme))
      expect(ratio, `${fg} on ${bg} in ${theme}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(7)
    }
  })

  // Status colours (TICKET-120): the proposal's values, exactly, per theme.
  const STATUS = ['success', 'warning', 'error'] as const
  const STATUS_VALUES: Record<(typeof THEMES)[number], Record<string, [string, string, string]>> = {
    Light: {
      success: ['#27512f', '#3c7646', '#e1eee2'],
      warning: ['#5e3f00', '#7d5a00', '#faecc8'],
      error: ['#8c151c', '#c42b30', '#fde4e1'],
    },
    Graphite: {
      success: ['#9ad3a2', '#7fb887', '#1c2a1e'],
      warning: ['#f2d08a', '#f0c64a', '#3a2d10'],
      error: ['#ffb3ad', '#f0736b', '#3d1b19'],
    },
  }
  it.each(THEMES)('keep the status colours of the proposal in %s', (theme) => {
    for (const status of STATUS) {
      const actual = ['text', 'marker', 'subtle'].map((role) => {
        const result = resolve(model, ['status', status, role], { Theme: theme })
        return result.ok ? String(result.value) : undefined
      })
      expect(actual, `status.${status} in ${theme}`).toEqual(STATUS_VALUES[theme][status])
    }
  })

  // Status text at 7:1 and markers (non-text) at 3:1 on every ground they are used on: the
  // canvas, the surface, bg-subtle and their own subtle tint (a chip, a banner).
  const STATUS_GROUNDS = (status: string) => [
    'bg.canvas',
    'bg.surface',
    'bg.subtle',
    `status.${status}.subtle`,
  ]
  it.each(THEMES)('keep status text at least 7:1 on its grounds in %s', (theme) => {
    for (const status of STATUS) {
      for (const bg of STATUS_GROUNDS(status)) {
        const fg = `status.${status}.text`
        const ratio = contrastRatio(color(model, fg, theme), color(model, bg, theme))
        expect(ratio, `${fg} on ${bg} in ${theme}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(7)
      }
    }
  })
  it.each(THEMES)('keep status markers at least 3:1 on their grounds in %s', (theme) => {
    for (const status of STATUS) {
      for (const bg of STATUS_GROUNDS(status)) {
        const fg = `status.${status}.marker`
        const ratio = contrastRatio(color(model, fg, theme), color(model, bg, theme))
        expect(ratio, `${fg} on ${bg} in ${theme}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  // The one exception: the redline label (signal.fg on signal.bg). No orange can both stand
  // 3:1 on paper as a line and carry 7:1 text, so the label stays at AA (4.5:1) and the design
  // system says so.
  it.each(THEMES)('keep the redline label at least 4.5:1 in %s', (theme) => {
    const ratio = contrastRatio(color(model, 'signal.fg', theme), color(model, 'signal.bg', theme))
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  // Edges: strong outlines 3:1 on the canvas in every theme.
  it.each(THEMES)('keep strong borders and the signal line at least 3:1 in %s', (theme) => {
    for (const fg of ['border.strong', 'action.bg']) {
      const ratio = contrastRatio(color(model, fg, theme), color(model, 'bg.canvas', theme))
      expect(ratio, `${fg} on bg.canvas in ${theme}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('show why text on the redline is dark: white on signal.bg fails', () => {
    const white = color(model, 'paper.0', 'Light')
    expect(contrastRatio(white, color(model, 'signal.bg', 'Light'))).toBeLessThan(4.5)
  })
})
