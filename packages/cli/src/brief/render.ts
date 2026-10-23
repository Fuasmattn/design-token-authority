/**
 * `dta brief` (TICKET-031): a short, prompt-ready brief of one brand's design system for AI
 * design generators (Stitch, v0, Claude, …). Selective, not a dump: the colours with a role, the
 * text and surface colours, a neutral ramp, typography, spacing, radii, breakpoints and rules,
 * each list capped so a brief stays near 400 tokens.
 */
import {
  colorHex,
  describeToken,
  FONT_WEIGHT_KEYWORDS,
  nameToDot,
  toColor,
  type ModeSelection,
  type Token,
  type TokenModel,
  type TokenValue,
} from '@dta/core'
import type { Config } from '../config/schema.js'

export const BRIEF_SCHEMA = 'dta.brief/1'

export interface BriefColor {
  token: string
  value: string
}

export interface Brief {
  /** The brand, or null without brands. */
  brand: string | null
  identity: string | null
  colors: {
    roles: Array<BriefColor & { role: string; use: string }>
    text: BriefColor[]
    surface: BriefColor[]
    /** Dark to light. */
    neutrals: BriefColor[]
  }
  /** Families with the token that names them (body, heading …). */
  typography: { families: BriefColor[]; sizes: number[]; weights: number[] }
  spacing: number[]
  radius: number[]
  breakpoints: Array<{ mode: string; query: string | null }>
  rules: string[]
}

const ROLES: ReadonlyArray<[role: string, pattern: RegExp, use: string]> = [
  ['primary', /\bprimary\b/, 'main actions, links, brand moments'],
  ['secondary', /\bsecondary\b/, 'supporting actions and surfaces'],
  ['accent', /\baccent\b|\bhighlight\b/, 'emphasis, used sparingly'],
  ['success', /\bsuccess\b|\bpositive\b/, 'success states'],
  ['warning', /\bwarning\b|\bcaution\b/, 'warning states'],
  ['error', /\berror\b|\bdanger\b|\bnegative\b|\bcritical\b/, 'errors and destructive actions'],
  ['info', /\binfo\b/, 'informational states'],
]

/** A colour meant for content on another colour (`Text.On Primary`, daisyUI's `*.content`). */
const ON = /\b(on|content|inverse|contrast)\b/

/** At most `count` values, spread over the sorted list (first and last included). */
function representative(values: readonly number[], count: number): number[] {
  const sorted = [...new Set(values)].sort((a, b) => a - b)
  if (sorted.length <= count) return sorted
  return [
    ...new Set(
      Array.from(
        { length: count },
        (_, i) => sorted[Math.round((i * (sorted.length - 1)) / (count - 1))],
      ),
    ),
  ]
}

const scopes = (token: Token): string[] => {
  const raw = (token.extensions?.['com.figma'] as { scopes?: unknown } | undefined)?.scopes
  return Array.isArray(raw) ? raw.map(String) : []
}

/** A length in px from a number, `16px`, `1rem` or a DTCG dimension; null otherwise. */
function px(value: TokenValue | undefined): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const match = /^(-?\d*\.?\d+)(px|rem)?$/.exec(value.trim())
    return match ? Number(match[1]) * (match[2] === 'rem' ? 16 : 1) : null
  }
  if (value && typeof value === 'object' && 'unit' in value && 'value' in value) {
    const { value: number, unit } = value as { value: unknown; unit: unknown }
    if (typeof number !== 'number') return null
    return unit === 'rem' ? number * 16 : unit === 'px' ? number : null
  }
  return null
}

type Kind = 'font-size' | 'spacing' | 'radius' | null
function kindOf(token: Token): Kind {
  const scope = scopes(token)
  if (scope.includes('FONT_SIZE')) return 'font-size'
  if (scope.includes('CORNER_RADIUS')) return 'radius'
  if (scope.includes('GAP')) return 'spacing'
  const words = token.name.join(' ').toLowerCase()
  if (
    /font[- ]?size|text[- ]?size|\bsize\b.*(font|type|text)|(font|type|typography|text|body|heading).*\bsize\b/.test(
      words,
    )
  ) {
    return 'font-size'
  }
  if (/radius|radii|rounded|corner/.test(words)) return 'radius'
  // Letter spacing and line spacing are type, not layout.
  if (/letter|tracking|line/.test(words)) return null
  if (/spacing|space|gap|padding|margin|inset|gutter/.test(words)) return 'spacing'
  return null
}

const lightness = (hex: string) => {
  const color = toColor(hex)
  return color ? 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b : 0
}

const weightOf = (value: TokenValue | undefined): number | undefined =>
  typeof value === 'number' ? value : FONT_WEIGHT_KEYWORDS[String(value).toLowerCase()]

/** The selection of a brand: every multi-mode collection with that mode, the default breakpoint. */
function selectionOf(
  model: TokenModel,
  config: Config | null,
  brand: string | null,
): ModeSelection {
  const selection: ModeSelection = {}
  const breakpoints = config?.breakpoints
  if (breakpoints) selection[breakpoints.collection] = breakpoints.default
  if (brand !== null) {
    for (const collection of model.collections) {
      if (collection.modes.length > 1 && collection.modes.includes(brand)) {
        selection[collection.name] = brand
      }
    }
  }
  return selection
}

interface Read {
  /** Dot form, `$root` dropped: `color.accent.$root` is the token `color.accent`. */
  name: string
  token: Token
  value: TokenValue
  depth: number
}

const lower = (name: string) => name.toLowerCase().replace(/[._/-]+/g, ' ')
/** The words of a token's own name: its last two segments, not the groups or themes above. */
const own = (name: string) => lower(name.split('.').slice(-2).join(' '))
/** A token in a colour group (`Colors.Text.Default`, `main.color.bg`), not a component's. */
const inColorGroup = (name: string) =>
  name
    .split('.')
    .slice(0, 2)
    .some((segment) => /^colou?rs?$/i.test(segment))

export function buildBrief(model: TokenModel, config: Config | null, brand: string | null): Brief {
  const selection = selectionOf(model, config, brand)
  const built = (name: string) => !config?.collections || config.collections.includes(name)

  const reads: Read[] = []
  for (const collection of model.collections) {
    if (!built(collection.name)) continue
    for (const token of collection.tokens) {
      const name = nameToDot(token.name)
      const reading = describeToken(model, name, selection)?.readings[0]
      if (reading?.value === undefined) continue
      reads.push({
        name: name.replace(/\.\$root$/, ''),
        token,
        value: reading.value,
        depth: reading.chain.length - 1,
      })
    }
  }
  // Semantic tokens (aliases) before the primitives they point at.
  reads.sort((a, b) => b.depth - a.depth || (a.name < b.name ? -1 : 1))

  const colors = reads.flatMap((read) => {
    if (read.token.type !== 'color') return []
    const hex = colorHex(read.value)
    return hex ? [{ token: read.name, value: hex, depth: read.depth }] : []
  })

  const roles: Brief['colors']['roles'] = []
  for (const [role, pattern, use] of ROLES) {
    // The shortest name first (`main.color.accent.bg` before a theme's
    // `alias.abyss.color.accent.accent`), then the role as the last word
    // (`Colors.Brand.Primary` before `Colors.Brand.Primary Dark`).
    const rank = (token: string) =>
      token.split('.').length * 10 + (pattern.test(lower(token).split(' ').at(-1) ?? '') ? 0 : 5)
    const found = colors
      .filter(
        (color) =>
          pattern.test(own(color.token)) &&
          !/\b(text|foreground)\b/.test(lower(color.token)) &&
          !ON.test(own(color.token)) &&
          !roles.some((taken) => taken.token === color.token),
      )
      .sort((a, b) => rank(a.token) - rank(b.token))[0]
    if (found) roles.push({ role, token: found.token, value: found.value, use })
  }

  /** Semantic colours in a colour group, by what their name says, one per value. */
  const pick = (pattern: RegExp, limit: number): BriefColor[] => {
    const values = new Set<string>()
    const picked: BriefColor[] = []
    for (const color of colors) {
      if (picked.length === limit) break
      if (color.depth === 0 || !inColorGroup(color.token) || !pattern.test(lower(color.token))) {
        continue
      }
      if (ON.test(own(color.token)) || roles.some((role) => role.token === color.token)) continue
      if (values.has(color.value)) continue
      values.add(color.value)
      picked.push({ token: color.token, value: color.value })
    }
    return picked
  }

  // A ramp from dark to light, spread over the neutral values (not the eight darkest).
  const neutralColors = [
    ...new Map(
      colors
        .filter((color) => /gr[ae]y|neutral|slate|zinc|stone|white|black/.test(own(color.token)))
        .map((color) => [color.value, { token: color.token, value: color.value }] as const),
    ).values(),
  ].sort((a, b) => lightness(a.value) - lightness(b.value))
  const neutrals = representative(
    neutralColors.map((_, i) => i),
    8,
  ).map((i) => neutralColors[i])

  /** Positive lengths in px of one kind, from flat tokens and the parts of typography tokens. */
  const lengths = (kind: Kind) =>
    reads.flatMap((read) => {
      const value =
        read.token.type === 'typography'
          ? kind === 'font-size'
            ? px((read.value as { fontSize?: TokenValue }).fontSize)
            : null
          : ['number', 'dimension'].includes(read.token.type) && kindOf(read.token) === kind
            ? px(read.value)
            : null
      return value !== null && value > 0 ? [value] : []
    })

  const families: BriefColor[] = []
  for (const read of reads) {
    const raw =
      read.token.type === 'typography'
        ? (read.value as { fontFamily?: TokenValue }).fontFamily
        : read.token.type === 'fontFamily' ||
            (read.token.type === 'string' && /famil|typeface/.test(own(read.name)))
          ? read.value
          : undefined
    if (raw === undefined) continue
    const value = Array.isArray(raw) ? String(raw[0]) : String(raw)
    if (!families.some((family) => family.value === value)) {
      families.push({ token: read.name, value })
    }
  }

  const weights = reads.flatMap((read) => {
    const weight =
      read.token.type === 'typography'
        ? weightOf((read.value as { fontWeight?: TokenValue }).fontWeight)
        : read.token.type === 'fontWeight' ||
            (read.token.type === 'number' && /weight/.test(own(read.name)))
          ? weightOf(read.value)
          : undefined
    return weight === undefined ? [] : [weight]
  })

  const breakpoints = config?.breakpoints
    ? [
        { mode: config.breakpoints.default, query: null },
        ...Object.entries(config.breakpoints.modes).map(([mode, query]) => ({ mode, query })),
      ]
    : []

  const rules = config?.brief?.rules?.length
    ? config.brief.rules
    : ['Use only the values in this brief: no other colours, sizes or fonts.']

  return {
    brand,
    identity: config?.brief?.identity ?? null,
    colors: {
      roles,
      text: pick(/\b(text|foreground)\b/, 4),
      surface: pick(/\b(surface|background|canvas)\b/, 4),
      neutrals,
    },
    typography: {
      families: families.slice(0, 3),
      sizes: representative(lengths('font-size'), 6),
      // Spread over the weights, so a bold one is not cut off by five light ones.
      weights: representative(weights, 5),
    },
    spacing: representative(lengths('spacing'), 8),
    radius: representative(lengths('radius'), 6),
    breakpoints,
    rules,
  }
}

const list = (values: readonly number[]) => `${values.join(', ')} (px)`
const swatch = (color: BriefColor) => `\`${color.value}\` (${color.token})`

/** The brief as Markdown, to paste at the top of a prompt. */
export function briefMarkdown(brief: Brief): string {
  const lines = [`# ${brief.brand ?? 'Design system'} brief`, '']
  if (brief.identity) lines.push(`**Identity:** ${brief.identity}`, '')
  const { roles, text, surface, neutrals } = brief.colors
  if (roles.length + text.length + surface.length + neutrals.length > 0) {
    lines.push('## Colors', '')
    for (const role of roles) {
      lines.push(
        `- ${role.role[0].toUpperCase()}${role.role.slice(1)}: ${swatch(role)}: ${role.use}`,
      )
    }
    if (text.length > 0) lines.push(`- Text: ${text.map(swatch).join(', ')}`)
    if (surface.length > 0) lines.push(`- Surfaces: ${surface.map(swatch).join(', ')}`)
    if (neutrals.length > 0) {
      lines.push(`- Neutrals, dark to light: ${neutrals.map((n) => `\`${n.value}\``).join(' ')}`)
    }
    lines.push('')
  }
  const { families, sizes, weights } = brief.typography
  if (families.length + sizes.length + weights.length > 0) {
    lines.push('## Typography', '')
    if (families.length > 0) {
      lines.push(`- Fonts: ${families.map((f) => `${f.value} (${f.token})`).join(', ')}`)
    }
    if (sizes.length > 0) lines.push(`- Sizes: ${list(sizes)}`)
    if (weights.length > 0) lines.push(`- Weights: ${weights.join(', ')}`)
    lines.push('')
  }
  if (brief.spacing.length > 0) lines.push('## Spacing', '', list(brief.spacing), '')
  if (brief.radius.length > 0) lines.push('## Radius', '', list(brief.radius), '')
  if (brief.breakpoints.length > 0) {
    const steps = brief.breakpoints.map(({ mode, query }) =>
      query ? `${mode} ${query}` : `${mode} (default)`,
    )
    lines.push('## Breakpoints', '', steps.join(', '), '')
  }
  lines.push('## Rules', '', ...brief.rules.map((rule) => `- ${rule}`), '')
  return lines.join('\n')
}
