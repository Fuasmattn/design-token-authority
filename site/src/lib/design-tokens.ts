/**
 * The site's design tokens (site/tokens) read through DTA's own packages, shaped for the
 * Design system pages. Runs at build time; the token files are bundled by Vite.
 */
import {
  nameToDot,
  parseTokenFiles,
  resolve,
  type Token,
  type TokenModel,
  formatValue,
} from '@dta/core'

const raw = import.meta.glob('../../tokens/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const THEMES = ['Light', 'Graphite'] as const
export type Theme = (typeof THEMES)[number]

export function loadModel(): TokenModel {
  const files = Object.entries(raw)
    .map(([file, content]) => ({ fileName: file.split('/').pop()!, content }))
    .sort((a, b) => (a.fileName < b.fileName ? -1 : 1))
  const { model, diagnostics } = parseTokenFiles(files)
  const errors = diagnostics.filter((d) => d.severity === 'error')
  if (errors.length > 0) throw new Error(errors.map((d) => d.message).join('\n'))
  return model
}

const model = loadModel()
const collection = (name: string) => model.collections.find((c) => c.name === name)!

/** The CSS custom property `dta build` writes for a token path. */
export const cssVar = (path: string[]) => `--${path.join('-').toLowerCase()}`

export interface ThemedValue {
  value: string
  /** Alias chain after the token itself, e.g. `['paper.100']`. */
  chain: string[]
}

export interface SemanticColor {
  name: string
  cssVar: string
  usage: string
  themes: Record<Theme, ThemedValue>
}

function themed(token: Token, theme: Theme): ThemedValue {
  const result = resolve(model, token.name, { Theme: theme })
  if (!result.ok) throw new Error(`${nameToDot(token.name)} does not resolve in ${theme}`)
  return {
    value: formatValue(result.value),
    chain: result.chain.slice(1).map((step) => nameToDot(step.name)),
  }
}

export function semanticColors(): SemanticColor[] {
  return collection('Theme').tokens.map((token) => ({
    name: token.name.join('-'),
    cssVar: cssVar(token.name),
    usage: token.description ?? '',
    themes: { Light: themed(token, 'Light'), Graphite: themed(token, 'Graphite') },
  }))
}

export interface PrimitiveToken {
  name: string
  cssVar: string
  value: string | number
  usage: string
}

const primitives = () => collection('Primitives').tokens

function primitive(token: Token): PrimitiveToken {
  return {
    name: token.name.join('-'),
    cssVar: cssVar(token.name),
    value: token.values.Value as string | number,
    usage: token.description ?? '',
  }
}

/** Colour primitives grouped by scale (`paper`, `ink`, …), in file order. */
export function colorScales(): Array<{ scale: string; tokens: PrimitiveToken[] }> {
  const scales = new Map<string, PrimitiveToken[]>()
  for (const token of primitives().filter((t) => t.type === 'color')) {
    const scale = token.name[0]
    scales.set(scale, [...(scales.get(scale) ?? []), primitive(token)])
  }
  return [...scales].map(([scale, tokens]) => ({ scale, tokens }))
}

/** Number primitives of one group (`space`, `radius`, `stroke`, `layout`); values are in px. */
export function dimension(group: 'space' | 'radius' | 'stroke' | 'layout'): PrimitiveToken[] {
  return primitives()
    .filter((t) => t.name[0] === group)
    .map(primitive)
}

export interface TypeStyle {
  name: string
  family: string
  size: number
  lineHeight: number
  weight: number
  letterSpacing?: string
  usage: string
  /** CSS variable prefix, e.g. `--type-body`. */
  cssPrefix: string
}

export function typeStyles(): TypeStyle[] {
  const styles = new Map<string, Partial<TypeStyle>>()
  for (const token of primitives().filter((t) => t.name[0] === 'type')) {
    const [, style, property] = token.name
    const entry = styles.get(style) ?? { name: style, cssPrefix: cssVar(['type', style]) }
    const value = token.values.Value
    if (property === 'family') {
      entry.family = String(value)
      entry.usage = token.description ?? ''
    }
    if (property === 'size') entry.size = Number(value)
    if (property === 'line-height') entry.lineHeight = Number(value)
    if (property === 'weight') entry.weight = Number(value)
    if (property === 'letter-spacing') entry.letterSpacing = String(value)
    styles.set(style, entry)
  }
  return [...styles.values()] as TypeStyle[]
}

export const fontFamilies = (): PrimitiveToken[] =>
  primitives()
    .filter((t) => t.name[0] === 'font')
    .map(primitive)

export interface MotionToken extends PrimitiveToken {
  /** `duration`, `stagger` or `ease`. */
  kind: 'duration' | 'stagger' | 'ease'
  /** The four control values of an easing (`cubic-bezier(x1, y1, x2, y2)`). */
  bezier?: [number, number, number, number]
}

/** Motion primitives (`motion.duration.*`, `motion.stagger`, `motion.ease.*`), in file order. */
export function motionTokens(): MotionToken[] {
  return primitives()
    .filter((t) => t.name[0] === 'motion')
    .map((token) => {
      const base = primitive(token)
      const kind = token.name[1] as MotionToken['kind']
      const match = /^cubic-bezier\(([^)]+)\)$/.exec(String(base.value))
      const bezier = match
        ? (match[1].split(',').map((n) => Number(n.trim())) as MotionToken['bezier'])
        : undefined
      return { ...base, kind, ...(bezier ? { bezier } : {}) }
    })
}
