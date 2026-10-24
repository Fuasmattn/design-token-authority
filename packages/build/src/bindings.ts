import { nameToDot } from '@dta/core'
import type { Diagnostic, TokenModel } from '@dta/core'
import { buildOutputs, type BuildOptions } from './build.js'
import { cssVariableName } from './transforms.js'

/** Where one token, in one mode, ends up in the CSS that `buildOutputs` writes. */
export interface CssBinding {
  collection: string
  mode: string
  /** Dot path, e.g. `action.bg`. */
  name: string
  /** Custom property, e.g. `--action-bg`. */
  variable: string
  /** The rule it is declared in: `:root` or `[data-brand="…"]`. */
  selector: string
  /**
   * The at-rules the rule is nested in, outermost first (`['@media (min-width: 1024px)']` for a
   * breakpoint mode, TICKET-091); absent for a rule at the top level.
   */
  context?: string[]
  /** The value as written, references included (e.g. `var(--blueprint-600)`). */
  value: string
}

const RULE = /^\s*([^{}]+?)\s*\{\s*$/
const DECLARATION = /^\s*(--[A-Za-z0-9_-]+)\s*:\s*(.*?)\s*;\s*(?:\/\*.*\*\/\s*)?$/

/**
 * Declarations of a CSS file written by `css/variables`, with the rule they are in and, for a
 * rule inside `@media`, the at-rules around it (`context`).
 */
export function parseCssVariables(
  css: string,
): Array<{ selector: string; variable: string; value: string; context?: string[] }> {
  const out: Array<{ selector: string; variable: string; value: string; context?: string[] }> = []
  const open: string[] = []
  for (const line of css.split('\n')) {
    const rule = RULE.exec(line)
    if (rule) {
      open.push(rule[1])
      continue
    }
    if (line.trim() === '}') {
      open.pop()
      continue
    }
    const declaration = DECLARATION.exec(line)
    if (!declaration || open.length === 0) continue
    const context = open.slice(0, -1)
    out.push({
      selector: open[open.length - 1],
      variable: declaration[1],
      value: declaration[2],
      ...(context.length > 0 ? { context } : {}),
    })
  }
  return out
}

/**
 * Which CSS custom property each token becomes, under which selector and with which value,
 * for the same options as `buildOutputs`. Single-mode collections are declared on `:root`
 * (from `variables.css`, so aliases stay references); brand modes on `[data-brand="…"]`; the
 * modes of the breakpoint collection on `:root`, inside their media query (`context`) except
 * the default mode. Tokens a theme file repeats (TICKET-091/093) are bound to `:root` only.
 * `dta diff` uses this to put a changed token back to its base value in a rendered page.
 */
export async function cssBindings(
  model: TokenModel,
  options: BuildOptions,
): Promise<{ bindings: CssBinding[]; diagnostics: Diagnostic[] }> {
  const { files, diagnostics } = await buildOutputs(model, options)
  const cssDir = `${(options.css?.outDir ?? 'output/css').trim().replace(/\/+$/, '') || 'output/css'}/`
  const collections = options.collections
    ? model.collections.filter((c) => options.collections?.includes(c.name))
    : model.collections

  // Variable name → the tokens that would be written under it, per scope.
  const candidates = new Map<string, Array<{ collection: string; mode: string; name: string }>>()
  const media = new Map<string, string | undefined>([
    ...(options.breakpoints ? [[options.breakpoints.default, undefined] as const] : []),
    ...(options.breakpoints?.media.map(({ mode, query }) => [mode, query] as const) ?? []),
  ])
  const add = (scope: string, collection: string, mode: string, path: string[]) => {
    const key = `${scope}|${cssVariableName(path)}`
    const list = candidates.get(key) ?? []
    list.push({ collection, mode, name: nameToDot(path) })
    candidates.set(key, list)
  }
  for (const collection of collections) {
    for (const token of collection.tokens) {
      if (collection.modes.length === 1) {
        add(':root', collection.name, collection.modes[0], token.name)
        continue
      }
      if (collection.name === options.breakpoints?.collection) {
        for (const [mode, query] of media) {
          if (!collection.modes.includes(mode) || token.values[mode] === undefined) continue
          add(
            query === undefined ? ':root' : `@media ${query}\u0000:root`,
            collection.name,
            mode,
            token.name,
          )
        }
        continue
      }
      for (const brand of options.brands ?? []) {
        if (collection.modes.includes(brand) && token.values[brand] !== undefined) {
          add(`[data-brand="${brand.toLowerCase()}"]`, collection.name, brand, token.name)
        }
      }
    }
  }

  const bindings: CssBinding[] = []
  for (const file of files) {
    const isRoot = file.path === `${cssDir}variables.css`
    const isTheme = file.path.startsWith(`${cssDir}themes/`) && file.path.endsWith('.css')
    if (!isRoot && !isTheme) continue
    for (const { selector, variable, value, context } of parseCssVariables(file.content)) {
      // The last token written under a name wins, as in the merged tree the CSS came from.
      const scope = [...(context ?? []), selector].join('\u0000')
      const owner = candidates.get(`${scope}|${variable.slice(2)}`)?.at(-1)
      if (owner)
        bindings.push({ ...owner, variable, selector, ...(context ? { context } : {}), value })
    }
  }
  return { bindings, diagnostics }
}
