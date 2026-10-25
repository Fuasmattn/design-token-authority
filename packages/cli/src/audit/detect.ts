/**
 * Finds hard-coded values in source files: colours, lengths in spacing, size, radius, stroke and
 * font size properties, and font families. Language-aware enough to skip comments and to know which
 * property a value belongs to; it does not parse the languages fully.
 */

export type Language = 'css' | 'scss' | 'js' | 'astro' | 'vue' | 'svelte' | 'html'
export const LANGUAGES: readonly Language[] = [
  'css',
  'scss',
  'js',
  'astro',
  'vue',
  'svelte',
  'html',
]

/** What a value is, which decides the tokens it is compared with. */
export type ValueKind =
  'color' | 'spacing' | 'size' | 'radius' | 'stroke' | 'font-size' | 'font-family'

export interface Candidate {
  /** 1-based. */
  line: number
  /** 1-based. */
  column: number
  value: string
  kind: ValueKind
  /** The CSS property, object key or Tailwind utility the value was found in. */
  context: string
}

const EXTENSIONS: Record<string, Language> = {
  '.css': 'css',
  '.scss': 'scss',
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.jsx': 'js',
  '.ts': 'js',
  '.mts': 'js',
  '.cts': 'js',
  '.tsx': 'js',
  '.astro': 'astro',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.html': 'html',
}

export function languageOf(file: string): Language | null {
  const match = /\.[a-z]+$/i.exec(file)
  return match ? (EXTENSIONS[match[0].toLowerCase()] ?? null) : null
}

/** Marks a line (or, alone on a line, the next one) as not to be audited. */
export const IGNORE_MARKER = 'dta-audit-ignore'

// ---------------------------------------------------------------------------------------------
// Text helpers: comments are blanked (replaced by spaces) so offsets and lines stay true.
// ---------------------------------------------------------------------------------------------

const blank = (text: string) => text.replace(/[^\n]/g, ' ')

function blankRanges(text: string, ranges: Array<[number, number]>): string {
  let out = ''
  let last = 0
  for (const [start, end] of ranges) {
    out += text.slice(last, start) + blank(text.slice(start, end))
    last = end
  }
  return out + text.slice(last)
}

/** CSS (and SCSS with `//` line comments) without comments. Strings are left alone. */
function stripCssComments(text: string, lineComments: boolean): string {
  const ranges: Array<[number, number]> = []
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") quote = c
    else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end === -1 ? text.length : end + 2
      ranges.push([i, stop])
      i = stop - 1
    } else if (lineComments && c === '/' && text[i + 1] === '/' && text[i - 1] !== ':') {
      const end = text.indexOf('\n', i)
      const stop = end === -1 ? text.length : end
      ranges.push([i, stop])
      i = stop - 1
    }
  }
  return blankRanges(text, ranges)
}

interface StringLiteral {
  /** Offset of the first character inside the quotes. */
  start: number
  content: string
  quote: string
}

/** JS/TS without comments, and its string and template literals. */
function scanJs(text: string): { code: string; strings: StringLiteral[] } {
  const ranges: Array<[number, number]> = []
  const strings: StringLiteral[] = []
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < text.length && text[j] !== c) {
        if (text[j] === '\\') j++
        else if (c !== '`' && text[j] === '\n') break
        j++
      }
      strings.push({ start: i + 1, content: text.slice(i + 1, j), quote: c })
      i = j
    } else if (c === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i)
      const stop = end === -1 ? text.length : end
      ranges.push([i, stop])
      i = stop - 1
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end === -1 ? text.length : end + 2
      ranges.push([i, stop])
      i = stop - 1
    }
  }
  return { code: blankRanges(text, ranges), strings }
}

/** HTML-like templates without `<!-- -->` comments. */
const stripHtmlComments = (text: string) =>
  text.replace(/<!--[\s\S]*?-->/g, (comment) => blank(comment))

// ---------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------

interface Found {
  offset: number
  value: string
  kind: ValueKind
  context: string
}

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** Which kind of length a property takes, if any. */
function lengthKind(property: string): ValueKind | null {
  const p = kebab(property).replace(/^-+/, '')
  if (/radius$/.test(p)) return 'radius'
  if (
    /^(border(-(top|right|bottom|left|block|inline)(-(start|end))?)?|outline|column-rule)(-width)?$/.test(
      p,
    ) ||
    p === 'stroke-width'
  ) {
    return 'stroke'
  }
  if (p === 'font-size') return 'font-size'
  // The size of a box (TICKET-147); `line-height` and `border-width` are not sizes.
  if (/^((min|max)-)?(width|height|inline-size|block-size)$/.test(p) || p === 'flex-basis') {
    return 'size'
  }
  if (
    /^(margin|padding|scroll-margin|scroll-padding|inset)(-.+)?$/.test(p) ||
    /^((row|column)-)?gap$/.test(p) ||
    /^(top|right|bottom|left)$/.test(p)
  ) {
    return 'spacing'
  }
  return null
}

const COLOR = /#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])|\brgba?\([^)]*\)/g
const LENGTH = /(?<![\w.#-])(-?(?:\d+\.?\d*|\.\d+))(px|rem)\b/g

const isColor = (value: string) =>
  /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) || /^rgba?\(/i.test(value)

/** `var(--x, #fff)`: the fallback is intentional, not a finding. */
const withoutVars = (value: string) =>
  value.replace(/var\((?:[^()]|\([^()]*\))*\)/g, (match) => blank(match))

/** Colours, lengths and font families in one property value. */
function valuesIn(property: string, value: string, offset: number): Found[] {
  const found: Found[] = []
  const scanned = withoutVars(value)
  for (const match of scanned.matchAll(COLOR)) {
    if (!isColor(match[0])) continue
    found.push({
      offset: offset + (match.index ?? 0),
      value: match[0],
      kind: 'color',
      context: property,
    })
  }
  const kind = lengthKind(property)
  if (kind) {
    for (const match of scanned.matchAll(LENGTH)) {
      if (Number(match[1]) === 0) continue
      // `* 1px` and `1px *` convert a unitless number to a length; not a hard-coded value.
      const before = scanned.slice(0, match.index ?? 0)
      const after = scanned.slice((match.index ?? 0) + match[0].length)
      if (/\*\s*$/.test(before) || /^\s*\*/.test(after)) continue
      found.push({ offset: offset + (match.index ?? 0), value: match[0], kind, context: property })
    }
  }
  if (kebab(property) === 'font-family') {
    const first = /^\s*(['"]?)([^,'"]+)\1/.exec(scanned)
    if (first && first[2].trim()) {
      found.push({
        offset: offset + first.index + first[0].indexOf(first[2]),
        value: first[2].trim(),
        kind: 'font-family',
        context: property,
      })
    }
  }
  return found
}

/** `@font-face` names a font and points to its files: not a use of a value. */
const withoutFontFaces = (text: string) =>
  text.replace(/@font-face\s*\{[^}]*\}/g, (block) => blank(block))

/**
 * The condition of a block at-rule (`@media (max-width: 760px)`, `@container`, `@supports`)
 * reads like a declaration but sets nothing: blanked, the block's own declarations stay.
 */
const withoutAtRuleConditions = (text: string) =>
  text.replace(/@[\w-]+\b[^{};]*(?=\{)/g, (prelude) => blank(prelude))

/** `property: value;` declarations (CSS, SCSS, style attributes, CSS in template literals). */
function declarations(source: string, offset = 0): Found[] {
  const text = withoutAtRuleConditions(withoutFontFaces(source))
  const found: Found[] = []
  const DECLARATION = /(?<![\w-])(-{0,2}[A-Za-z][\w-]*)\s*:\s*([^;{}]+)/g
  for (const match of text.matchAll(DECLARATION)) {
    const valueStart = (match.index ?? 0) + match[0].length - match[2].length
    found.push(...valuesIn(match[1], match[2], offset + valueStart))
  }
  return found
}

const TAILWIND_KINDS: Array<[RegExp, ValueKind, 'color' | 'length']> = [
  [
    /^(bg|text|border(-[trblxyse])?|ring|outline|fill|stroke|from|via|to|decoration|accent|caret|shadow|divide|placeholder)$/,
    'color',
    'color',
  ],
  [/^rounded(-[a-z]{1,2})?$/, 'radius', 'length'],
  [/^(border(-[trblxyse])?|ring|outline|divide-[xy])$/, 'stroke', 'length'],
  [/^text$/, 'font-size', 'length'],
  [/^(w|h|size|min-w|min-h|max-w|max-h|basis)$/, 'size', 'length'],
  [
    /^-?(p[xytrblse]?|m[xytrblse]?|gap(-[xy])?|space-[xy]|inset(-[xy])?|top|right|bottom|left|start|end|scroll-[mp][xytrblse]?)$/,
    'spacing',
    'length',
  ],
]

/** Tailwind arbitrary values: `bg-[#2f55d4]`, `p-[12px]`, `md:rounded-[8px]`. */
function tailwind(text: string): Found[] {
  const found: Found[] = []
  const ARBITRARY = /(?<![\w-])((?:[\w-]+:)*)(-?[a-z][a-z0-9-]*?)-\[([^\]\s'"`]+)\]/g
  for (const match of text.matchAll(ARBITRARY)) {
    const utility = match[2]
    const value = match[3]
    const offset = (match.index ?? 0) + match[0].length - value.length - 1
    const type = isColor(value)
      ? 'color'
      : /^-?(\d+\.?\d*|\.\d+)(px|rem)$/.test(value)
        ? 'length'
        : null
    if (!type || (type === 'length' && parseFloat(value) === 0)) continue
    const entry = TAILWIND_KINDS.find(
      ([pattern, , takes]) => takes === type && pattern.test(utility),
    )
    if (entry) found.push({ offset, value, kind: entry[1], context: `${utility}-[…]` })
  }
  return found
}

/** Object properties and plain strings in JS/TS: `{ padding: '16px' }`, `const c = '#fff'`. */
function jsValues(text: string, strings: readonly StringLiteral[]): Found[] {
  const found: Found[] = []
  for (const literal of strings) {
    if (literal.quote === '`') {
      // CSS in a template literal (styled components, css``), and Tailwind classes.
      found.push(...declarations(literal.content, literal.start))
      continue
    }
    const before = text.slice(Math.max(0, literal.start - 80), literal.start - 1)
    const key = /['"]?([A-Za-z][\w-]*)['"]?\s*:\s*$/.exec(before)
    if (key) {
      found.push(...valuesIn(key[1], literal.content, literal.start))
    } else if (isColor(literal.content.trim())) {
      found.push({
        offset: literal.start + literal.content.indexOf(literal.content.trim()),
        value: literal.content.trim(),
        kind: 'color',
        context: 'string',
      })
    }
  }
  return found
}

/** `<style>` blocks, `style="…"` attributes and Tailwind classes of an HTML-like template. */
function templateValues(text: string): Found[] {
  const source = stripHtmlComments(text)
  const found: Found[] = []
  let rest = source
  for (const match of source.matchAll(/(<style\b([^>]*)>)([\s\S]*?)<\/style>/gi)) {
    const start = (match.index ?? 0) + match[1].length
    const scss = /lang=["']?s[ac]ss/i.test(match[2])
    found.push(...declarations(stripCssComments(match[3], scss), start))
    rest = rest.slice(0, start) + blank(match[3]) + rest.slice(start + match[3].length)
  }
  for (const match of rest.matchAll(/\bstyle\s*=\s*(["'])([^"']*)\1/g)) {
    found.push(
      ...declarations(match[2], (match.index ?? 0) + match[0].length - match[2].length - 1),
    )
  }
  found.push(...tailwind(rest))
  return found
}

function lineStarts(text: string): number[] {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return starts
}

/** Lines (1-based) that `dta-audit-ignore` excludes: its own, or the next when it stands alone. */
function ignoredLines(text: string): Set<number> {
  const ignored = new Set<number>()
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    if (!line.includes(IGNORE_MARKER)) return
    ignored.add(index + 1)
    const alone = line
      .replace(IGNORE_MARKER, '')
      .replace(/\/\/|\/\*|\*\/|<!--|-->|\{|\}/g, '')
      .trim()
    if (alone === '' || /^[\s-]*$/.test(alone)) ignored.add(index + 2)
  })
  return ignored
}

/** Every hard-coded value in a file, in order, once per position. */
export function detect(text: string, language: Language): Candidate[] {
  let found: Found[]
  if (language === 'css' || language === 'scss') {
    const code = stripCssComments(text, language === 'scss')
    found = [...declarations(code), ...tailwind(code)]
  } else if (language === 'js') {
    const { code, strings } = scanJs(text)
    found = [...tailwind(code), ...jsValues(code, strings)]
  } else {
    found = templateValues(text)
  }

  const starts = lineStarts(text)
  const ignored = ignoredLines(text)
  const seen = new Set<number>()
  const result: Candidate[] = []
  for (const item of found.sort((a, b) => a.offset - b.offset)) {
    if (seen.has(item.offset)) continue
    seen.add(item.offset)
    let line = 0
    while (line + 1 < starts.length && starts[line + 1] <= item.offset) line++
    if (ignored.has(line + 1)) continue
    result.push({
      line: line + 1,
      column: item.offset - starts[line] + 1,
      value: item.value,
      kind: item.kind,
      context: item.context,
    })
  }
  return result
}
