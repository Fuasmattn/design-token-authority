import {
  describeToken,
  findTokensByValue,
  reachRank,
  formatDiagnostic,
  hasErrors,
  listTokens,
  nameToDot,
  parseTokenFiles,
  suggestTokenNames,
  type TokenDescription,
  type TokenModel,
  type TokenType,
  type TokenValue,
  formatValue,
  TOKEN_TYPES,
} from '@dta/core'
import type { CommandContext } from '../commands.js'
import { codeNames, type CodeNames } from '../code-names.js'
import { readTokenDir, TokenDirError, tokenParseOptions } from '../io/token-dir.js'

/** Version of the JSON shapes `dta token … --format json` prints (schema on the website). */
export const TOKEN_JSON_SCHEMA = 'dta.token/1'

/** Exit code for a usage error: a bad option value, an unknown collection or mode. */
const EXIT_USAGE = 2

const TYPES: readonly TokenType[] = TOKEN_TYPES
const FORMATS = ['console', 'json'] as const
type Format = (typeof FORMATS)[number]

class UsageError extends Error {}

function loadModel(context: CommandContext): TokenModel | number {
  let files
  try {
    files = readTokenDir(context.config?.tokens.dir ?? 'tokens', context.cwd)
  } catch (error) {
    if (error instanceof TokenDirError) {
      context.stderr(`${error.message}\n`)
      return 1
    }
    throw error
  }
  const { model, diagnostics } = parseTokenFiles(files, tokenParseOptions(context.config))
  if (hasErrors(diagnostics)) {
    for (const diagnostic of diagnostics) context.stderr(`${formatDiagnostic(diagnostic)}\n`)
    context.stderr('The token files have errors; fix them first (dta lint shows them all).\n')
    return 1
  }
  return model
}

function format(context: CommandContext): Format {
  const value = String(context.options.format ?? 'console')
  if (!(FORMATS as readonly string[]).includes(value)) {
    throw new UsageError(`Unknown format "${value}". Use one of: ${FORMATS.join(', ')}.`)
  }
  return value as Format
}

function type(context: CommandContext): TokenType | undefined {
  const value = context.options.type
  if (value === undefined) return undefined
  if (!(TYPES as readonly string[]).includes(String(value))) {
    throw new UsageError(`Unknown type "${String(value)}". Use one of: ${TYPES.join(', ')}.`)
  }
  return value as TokenType
}

/** `--mode Brand=BrandB` → `{ 'Brand(Alias)': 'BrandB' }`; collection names match loosely. */
export function parseModeSelection(
  model: TokenModel,
  values: readonly string[],
): Record<string, string> {
  const selection: Record<string, string> = {}
  const names = model.collections.map((collection) => collection.name)
  for (const value of values) {
    const [key, mode, ...rest] = value.split('=')
    if (!key || !mode || rest.length > 0) {
      throw new UsageError(`--mode expects <collection>=<mode>, got "${value}".`)
    }
    const loose = (name: string) =>
      name
        .toLowerCase()
        .replace(/\(.*\)/, '')
        .trim()
    const collection =
      model.collections.find((c) => c.name === key) ??
      model.collections.find((c) => loose(c.name) === loose(key))
    if (!collection) {
      throw new UsageError(`Unknown collection "${key}". Collections: ${names.join(', ')}.`)
    }
    const found = collection.modes.find((m) => m === mode || m.toLowerCase() === mode.toLowerCase())
    if (!found) {
      throw new UsageError(
        `Collection "${collection.name}" has no mode "${mode}". Modes: ${collection.modes.join(', ')}.`,
      )
    }
    selection[collection.name] = found
  }
  return selection
}

const modeLabel = (modes: Record<string, string>) =>
  Object.values(modes).join(' · ') || 'every mode'
const show = (value: TokenValue | undefined) => (value === undefined ? '–' : formatValue(value))
const pad = (text: string, width: number) => text.padEnd(width)
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

/** Runs a query, turning usage errors into exit code 2. */
async function guarded(context: CommandContext, run: () => number): Promise<number> {
  try {
    return run()
  } catch (error) {
    if (error instanceof UsageError) {
      context.stderr(`${error.message}\n`)
      return EXIT_USAGE
    }
    throw error
  }
}

function printDescription(
  context: CommandContext,
  token: TokenDescription,
  names: CodeNames | undefined,
) {
  const lines = [`${token.name}  ${token.type} · ${token.collection}`]
  if (token.description) lines.push(token.description)
  lines.push('')
  const width = Math.max(...token.readings.map((reading) => modeLabel(reading.modes).length))
  const valueWidth = Math.max(...token.readings.map((reading) => show(reading.value).length))
  for (const reading of token.readings) {
    const chain = reading.chain.length > 1 ? reading.chain.join(' → ') : ''
    const value = reading.error ? `unresolved: ${reading.error}` : show(reading.value)
    lines.push(
      `  ${pad(modeLabel(reading.modes), width)}  ${pad(value, valueWidth)}  ${chain}`.trimEnd(),
    )
  }
  const parts = token.readings[0]?.parts ?? []
  if (parts.length > 0) {
    lines.push('', '  Parts')
    for (const part of parts) lines.push(`  ${part.at}  ${part.reference}`)
  }
  lines.push('')
  if (names) {
    lines.push(`  CSS       var(${names.css})`)
    if (names.tailwind) lines.push(`  Tailwind  ${names.tailwind}`)
  } else {
    lines.push(
      `  Not in the build output: dta build writes ${token.collection} only in the modes listed in brands.`,
    )
  }
  context.stdout(`${lines.join('\n')}\n`)
}

export function runTokenGet(context: CommandContext): Promise<number> {
  return guarded(context, () => {
    const output = format(context)
    const model = loadModel(context)
    if (typeof model === 'number') return model
    const name = context.args[0] ?? ''
    const modes = context.options.mode as string[] | undefined
    const selection = modes?.length ? parseModeSelection(model, modes) : undefined
    const token = describeToken(model, name, selection)
    if (!token) {
      const suggestions = suggestTokenNames(model, name)
      if (output === 'json') {
        context.stdout(json({ schema: TOKEN_JSON_SCHEMA, kind: 'unknown', name, suggestions }))
      } else {
        context.stderr(`No token "${name}".\n`)
        if (suggestions.length > 0) {
          context.stderr(`Did you mean:\n${suggestions.map((s) => `  ${s}`).join('\n')}\n`)
        }
      }
      return 1
    }
    const names = codeNames(model, context.config, token, token.extensions)
    if (output === 'json') {
      const { extensions: _extensions, ...rest } = token
      context.stdout(
        json({
          schema: TOKEN_JSON_SCHEMA,
          kind: 'token',
          ...rest,
          ...(names ? { code: names } : {}),
        }),
      )
    } else {
      printDescription(context, token, names)
    }
    return 0
  })
}

export function runTokenFind(context: CommandContext): Promise<number> {
  return guarded(context, () => {
    const output = format(context)
    const tokenType = type(context)
    const model = loadModel(context)
    if (typeof model === 'number') return model
    const query = context.args[0] ?? ''
    const breakpoints = context.config?.breakpoints
    const matches = findTokensByValue(model, query, {
      ...(tokenType ? { type: tokenType } : {}),
      near: Boolean(context.options.near),
      ...(breakpoints
        ? { breakpoints: { collection: breakpoints.collection, default: breakpoints.default } }
        : {}),
    })
    // A breakpoint other than the default holds at the screen widths of its media query.
    const label = (modes: Record<string, string>) =>
      Object.entries(modes)
        .map(([collection, mode]) => {
          const media = collection === breakpoints?.collection ? breakpoints.modes[mode] : undefined
          return media ? `${mode} ${media}` : mode
        })
        .join(' · ') || 'every mode'
    const extensions = new Map(
      model.collections.flatMap((c) =>
        c.tokens.map((t) => [nameToDot(t.name), t.extensions] as const),
      ),
    )
    const code = (match: (typeof matches)[number]) =>
      codeNames(model, context.config, match, extensions.get(match.name))
    const withCode = matches.map((match) => ({
      ...match,
      ...(code(match) ? { code: code(match) } : {}),
    }))
    if (output === 'json') {
      context.stdout(json({ schema: TOKEN_JSON_SCHEMA, kind: 'matches', query, matches: withCode }))
      return matches.length > 0 ? 0 : 1
    }
    if (matches.length === 0) {
      context.stderr(
        `No token resolves to ${query}.${context.options.near ? '' : ' Try --near.'}\n`,
      )
      return 1
    }
    // One line per token; the modes it has the value in are listed together.
    const rows = new Map<string, { modes: string[]; value: string; css: string; alias: boolean }>()
    // Tokens the build writes first (only those can be used in code), within where they hold.
    const usable = [...withCode].sort(
      (a, b) =>
        reachRank(a.breakpoint) - reachRank(b.breakpoint) || Number(!a.code) - Number(!b.code),
    )
    for (const match of usable) {
      const row = rows.get(match.name) ?? {
        modes: [],
        value: formatValue(match.value),
        css: match.code ? `var(${match.code.css})` : '(not in the build output)',
        alias: match.depth > 0,
      }
      row.modes.push(label(match.modes))
      rows.set(match.name, row)
    }
    const nameWidth = Math.max(...[...rows.keys()].map((name) => name.length))
    const modeWidth = Math.max(...[...rows.values()].map((row) => row.modes.join(', ').length))
    const lines = [`${rows.size} token${rows.size === 1 ? '' : 's'} resolve to ${query}:`, '']
    for (const [name, row] of rows) {
      const value = context.options.near ? `  ${row.value}` : ''
      lines.push(
        `  ${pad(name, nameWidth)}  ${pad(row.modes.join(', '), modeWidth)}  ${row.css}${value}`,
      )
    }
    const aliases = [...rows.values()].some((row) => row.alias)
    if (matches.some((match) => match.breakpoint))
      lines.push(
        '',
        'Tokens that have the value at every screen width come first, then tokens the build writes, aliases (semantic tokens) before primitives: use the first that fits.',
        'A token with a media query has the value only at those widths: in code it changes the page at the others.',
      )
    else if (aliases)
      lines.push(
        '',
        'Tokens the build writes come first, aliases (semantic tokens) before primitives: use the first that fits.',
      )
    context.stdout(`${lines.join('\n')}\n`)
    return 0
  })
}

export function runTokenList(context: CommandContext): Promise<number> {
  return guarded(context, () => {
    const output = format(context)
    const tokenType = type(context)
    const model = loadModel(context)
    if (typeof model === 'number') return model
    const collection = context.options.collection as string | undefined
    if (collection && !model.collections.some((c) => c.name === collection)) {
      throw new UsageError(
        `Unknown collection "${collection}". Collections: ${model.collections.map((c) => c.name).join(', ')}.`,
      )
    }
    const match = context.options.match as string | undefined
    const tokens = listTokens(model, {
      ...(collection ? { collection } : {}),
      ...(tokenType ? { type: tokenType } : {}),
      ...(match ? { match } : {}),
    })
    if (output === 'json') {
      context.stdout(json({ schema: TOKEN_JSON_SCHEMA, kind: 'list', tokens }))
      return 0
    }
    if (tokens.length === 0) {
      context.stdout('No tokens match.\n')
      return 0
    }
    const nameWidth = Math.max(...tokens.map((token) => token.name.length))
    const typeWidth = Math.max(...tokens.map((token) => token.type.length))
    const lines = tokens.map(
      (token) =>
        `${pad(token.name, nameWidth)}  ${pad(token.type, typeWidth)}  ${token.collection}${token.alias ? '  (alias)' : ''}`,
    )
    lines.push('', `${tokens.length} token${tokens.length === 1 ? '' : 's'}.`)
    context.stdout(`${lines.join('\n')}\n`)
    return 0
  })
}
