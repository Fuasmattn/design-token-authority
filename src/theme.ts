/**
 * CLI theme — centralized styling for all dta commands.
 *
 * Provides a consistent visual identity: colored logo, command banners,
 * status indicators, and formatting helpers.
 */

import pc from 'picocolors'

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

/** Brand gradient — applied character-by-character to text */
const GRADIENT = [
  pc.magenta,
  pc.magenta,
  pc.blue,
  pc.blue,
  pc.cyan,
  pc.cyan,
  pc.green,
  pc.green,
  pc.yellow,
  pc.yellow,
]

function gradient(text: string): string {
  const chars = [...text]
  return chars
    .map((ch, i) => {
      if (ch === ' ' || ch === '\n') return ch
      const colorFn = GRADIENT[i % GRADIENT.length]
      return colorFn(ch)
    })
    .join('')
}

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

export function logo(): string {
  const title = gradient('Design Token Authority')
  const tagline = pc.dim('Sync Figma variables to code, and back.')
  const version = pc.dim('v0.1.0')

  const lines = [
    '',
    `          ${pc.dim('\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510')}`,
    `  ${pc.cyan('[')}\u2022\u203f\u2022${pc.cyan(']')} ${pc.dim('\u2500\u2500\u2524')} ${pc.magenta('\u25c6')}  ${pc.cyan('\u25cf')}  ${pc.yellow('\u25aa')} ${pc.dim('\u2502')}   ${title}  ${version}`,
    `   ${pc.dim('/|\\')}    ${pc.dim('\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518')}   ${tagline}`,
    `   ${pc.dim('\u2575 \u2575')}`,
    '',
  ]

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Command banners — each command gets its own color + icon
// ---------------------------------------------------------------------------

type CommandName = 'pull' | 'push' | 'build' | 'analyze' | 'graph' | 'clean' | 'lint' | 'init'

const COMMAND_STYLES: Record<CommandName, { icon: string; bg: (s: string) => string }> = {
  pull: { icon: '\u2935', bg: (s) => pc.bgCyan(pc.black(s)) }, //  ⤵
  push: { icon: '\u2934', bg: (s) => pc.bgMagenta(pc.white(s)) }, //  ⤴
  build: { icon: '\u2692', bg: (s) => pc.bgGreen(pc.black(s)) }, //  ⚒
  analyze: { icon: '\u2609', bg: (s) => pc.bgBlue(pc.white(s)) }, //  ☉
  graph: { icon: '\u2B95', bg: (s) => pc.bgYellow(pc.black(s)) }, //  ⮕  (using ⭕ fallback-safe)
  clean: { icon: '\u2716', bg: (s) => pc.bgRed(pc.white(s)) }, //  ✖
  lint: { icon: '\u2714', bg: (s) => pc.bgYellow(pc.black(s)) }, //  ✔
  init: { icon: '\u2728', bg: (s) => pc.bgCyan(pc.black(s)) }, //  ✨
}

/**
 * Styled intro banner for a command.
 * Returns a string like `  ⤵  dta pull  ` with background color.
 */
export function banner(command: CommandName): string {
  const style = COMMAND_STYLES[command]
  return style.bg(` ${style.icon}  dta ${command} `)
}

// ---------------------------------------------------------------------------
// Status formatting
// ---------------------------------------------------------------------------

export const status = {
  success: (msg: string) => `${pc.green('\u2714')} ${msg}`,
  error: (msg: string) => `${pc.red('\u2718')} ${msg}`,
  warn: (msg: string) => `${pc.yellow('\u26A0')} ${msg}`,
  info: (msg: string) => `${pc.blue('\u2139')} ${msg}`,
  added: (msg: string) => `${pc.green('+')} ${msg}`,
  modified: (msg: string) => `${pc.yellow('~')} ${msg}`,
  removed: (msg: string) => `${pc.red('-')} ${msg}`,
  skip: (msg: string) => `${pc.dim('\u2013')} ${pc.dim(msg)}`,
} as const

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Dim label + bright value, for key-value status lines */
export function kv(label: string, value: string | number): string {
  return `${pc.dim(label + ':')} ${value}`
}

/** Format a file path for display */
export function filePath(p: string): string {
  return pc.cyan(p)
}

/** Format a count with singular/plural label */
export function count(n: number, singular: string, plural?: string): string {
  const label = n === 1 ? singular : (plural ?? singular + 's')
  return `${pc.bold(String(n))} ${label}`
}

/** Highlight a command name inline */
export function cmd(name: string): string {
  return pc.cyan(`dta ${name}`)
}

/** Separator line */
export function separator(): string {
  return pc.dim('\u2500'.repeat(48))
}
