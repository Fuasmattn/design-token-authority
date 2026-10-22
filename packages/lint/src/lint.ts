import {
  AXIS_SEPARATOR,
  analyzeGraph,
  circularAliasMessage,
  contrastRatio,
  danglingAliasMessage,
  formatValue,
  resolve,
  toColor,
  toHex,
  toSrgb,
} from '@dta/core'
import type {
  Color,
  ColorValue,
  GraphAnalysis,
  ModeSelection,
  ResolveResult,
  TokenModel,
} from '@dta/core'
import { readLintConfig } from './config.js'
import type { LintSeverity, ValidRules } from './config.js'
import type { LintResult, LintViolation } from './types.js'
import type { Diagnostic } from '@dta/core'

const DEFAULT_MODE_PATTERN = /^mode\s*\d+$/i

function noDanglingAliases(graph: GraphAnalysis): LintViolation[] {
  return graph.danglingAliases.map((dangling) => ({
    rule: 'no-dangling-aliases',
    severity: 'error',
    tokenPath: dangling.sourceId,
    file: `${dangling.file}.json`,
    message: danglingAliasMessage(dangling),
  }))
}

function noCircularAliases(graph: GraphAnalysis): LintViolation[] {
  return graph.cycles.map((cycle) => ({
    rule: 'no-circular-aliases',
    severity: 'error',
    tokenPath: cycle.path[0],
    file: '',
    message: circularAliasMessage(cycle),
  }))
}

function noDefaultModeNames(graph: GraphAnalysis): LintViolation[] {
  const violations: LintViolation[] = []
  const seen = new Set<string>()
  for (const node of graph.nodes) {
    const file = `${node.collection}.${node.mode}`
    if (seen.has(file)) continue
    seen.add(file)
    if (DEFAULT_MODE_PATTERN.test(node.mode)) {
      violations.push({
        rule: 'no-default-mode-names',
        severity: 'error',
        tokenPath: file,
        file: `${file}.json`,
        message: `Mode name "${node.mode}" is a Figma default — rename to something meaningful`,
      })
    }
  }
  return violations
}

/** Configurable rules default to `warn`; `off` disables them. */
function activeSeverity(severity: LintSeverity | undefined): 'error' | 'warn' | null {
  const resolved = severity ?? 'warn'
  return resolved === 'off' ? null : resolved
}

const segmentsOf = (id: string): string[] => id.split('/').slice(1)

function semanticMustAlias(
  graph: GraphAnalysis,
  options: NonNullable<ValidRules['semantic-must-alias']>,
  severity: 'error' | 'warn',
): LintViolation[] {
  const collections = options.collections ?? []
  return graph.nodes
    .filter(
      // A composite made of references (a shadow from colour and size tokens) counts as an alias.
      (node) =>
        collections.includes(node.collection) &&
        node.aliasTarget === null &&
        node.references.length === 0,
    )
    .map((node) => ({
      rule: 'semantic-must-alias',
      severity,
      tokenPath: node.id,
      file: `${node.collection}.${node.mode}.json`,
      message: `Token has a raw value "${formatValue(node.value)}" but should be an alias in collection "${node.collection}"`,
    }))
}

function namingPattern(
  graph: GraphAnalysis,
  options: NonNullable<ValidRules['naming-pattern']>,
  severity: 'error' | 'warn',
  diagnostics: Diagnostic[],
): LintViolation[] {
  const compiled = new Map<string, RegExp>()
  for (const [collection, pattern] of Object.entries(options.patterns ?? {})) {
    try {
      compiled.set(collection, new RegExp(pattern))
    } catch {
      diagnostics.push({
        severity: 'error',
        code: 'invalid-config',
        message: `Lint config: rules.naming-pattern.patterns.${collection}: "${pattern}" is not a valid regular expression; pattern skipped.`,
      })
    }
  }

  const violations: LintViolation[] = []
  for (const node of graph.nodes) {
    const regex = compiled.get(node.collection)
    if (!regex) continue
    const segment = segmentsOf(node.id).find((part) => !regex.test(part))
    if (segment === undefined) continue
    violations.push({
      rule: 'naming-pattern',
      severity,
      tokenPath: node.id,
      file: `${node.collection}.${node.mode}.json`,
      message: `Token path segment "${segment}" does not match pattern /${regex.source}/ for collection "${node.collection}"`,
    })
  }
  return violations
}

/** A pair name as written in the config (dot or slash form) → token name segments. */
const pairName = (name: string): string[] => name.split(name.includes('/') ? '/' : '.')

/**
 * `BrandA`, `BrandA · Dark`: the modes of a context in the model's collection order, as
 * `dta token get` labels them.
 */
const modeLabel = (model: TokenModel, selection: ModeSelection) =>
  model.collections
    .filter((collection) => collection.name in selection)
    .map((collection) => selection[collection.name])
    .join(' · ')

interface ContrastContext {
  selection: ModeSelection
  fg: ResolveResult
  bg: ResolveResult
}

/**
 * Every mode context a pair can be read in: both sides are resolved, and for each multi-mode
 * collection one of their alias chains reaches (and no mode is chosen for yet) the search branches
 * into each of its modes. Collections neither chain reaches are not multiplied in, so a brand
 * foreground over a single-mode background gives one context per brand.
 */
function contrastContexts(
  model: TokenModel,
  fg: string[],
  bg: string[],
  selection: ModeSelection = {},
): ContrastContext[] {
  const fgResult = resolve(model, fg, selection)
  const bgResult = resolve(model, bg, selection)
  const multi = new Map(
    model.collections.filter((c) => c.modes.length > 1).map((c) => [c.name, c.modes]),
  )
  // A combination of resolver modifiers is chosen through its modifiers, so a single modifier the
  // other side reaches is read in the same context.
  const axesOf = new Map(model.collections.map((c) => [c.name, c.axes]))
  const chosen = (collection: string) => {
    const axes = axesOf.get(collection)
    return axes ? axes.every((axis) => axis in selection) : collection in selection
  }
  const open = [...fgResult.chain, ...bgResult.chain].find(
    (step) => multi.has(step.collection) && !chosen(step.collection),
  )
  if (!open) return [{ selection, fg: fgResult, bg: bgResult }]
  const axes = axesOf.get(open.collection)
  return (multi.get(open.collection) ?? []).flatMap((mode) => {
    if (!axes) return contrastContexts(model, fg, bg, { ...selection, [open.collection]: mode })
    const contexts = mode.split(AXIS_SEPARATOR)
    // Combinations that contradict a modifier already chosen are not this context.
    if (axes.some((axis, i) => axis in selection && selection[axis] !== contexts[i])) return []
    const picked = Object.fromEntries(axes.map((axis, i) => [axis, contexts[i]]))
    return contrastContexts(model, fg, bg, { ...selection, ...picked })
  })
}

function colorContrast(
  model: TokenModel,
  options: NonNullable<ValidRules['color-contrast']>,
  severity: 'error' | 'warn',
  diagnostics: Diagnostic[],
): LintViolation[] {
  const minRatio = options.minRatio ?? 4.5
  const multiMode = new Set(model.collections.filter((c) => c.modes.length > 1).map((c) => c.name))
  const skipped = new Set<string>()
  const skip = (message: string) => {
    if (skipped.has(message)) return
    skipped.add(message)
    diagnostics.push({
      severity: 'warning',
      code: 'contrast-unresolved',
      message: `color-contrast: ${message}`,
      docs: 'lint-rules',
    })
  }

  const note = (message: string) => {
    if (skipped.has(message)) return
    skipped.add(message)
    diagnostics.push({
      severity: 'warning',
      code: 'contrast-clipped',
      message: `color-contrast: ${message}`,
      docs: 'lint-rules',
    })
  }

  const violations: LintViolation[] = []
  for (const [fgName, bgName] of options.pairs ?? []) {
    for (const { selection, fg, bg } of contrastContexts(
      model,
      pairName(fgName),
      pairName(bgName),
    )) {
      const where = modeLabel(model, selection)
      const inMode = where ? ` in ${where}` : ''
      const colors: Array<{ hex: string; color: Color }> = []
      for (const [name, result] of [
        [fgName, fg],
        [bgName, bg],
      ] as const) {
        if (!result.ok) {
          const problem = result.diagnostics[0]
          // A name that is not a token is missing in every mode: one diagnostic, no mode.
          const unknown = problem?.code === 'unknown-token'
          skip(
            `"${name}" does not resolve${unknown ? '' : inMode}: ${problem?.message ?? ''} Pair "${fgName}" / "${bgName}" skipped${unknown ? '' : ' there'}.`,
          )
          continue
        }
        // Strings as before (hex, rgb()); DTCG colour objects converted to sRGB.
        const value = result.value
        const object =
          result.type === 'color' && typeof value === 'object' && 'colorSpace' in value
            ? toSrgb(value as ColorValue)
            : null
        const color =
          result.type !== 'color'
            ? null
            : typeof value === 'string'
              ? toColor(value)
              : (object?.color ?? null)
        if (!color) {
          skip(
            `"${name}" resolves to "${formatValue(value)}"${inMode}, which is not a colour. Pair "${fgName}" / "${bgName}" skipped there.`,
          )
          continue
        }
        if (object?.clipped) {
          note(
            `"${name}" (${formatValue(value)}) is outside sRGB${inMode}; the contrast check uses it clipped to sRGB (${toHex(color)}).`,
          )
        }
        colors.push({ hex: formatValue(result.value), color })
      }
      if (colors.length < 2 || !fg.ok || !bg.ok) continue
      const ratio = contrastRatio(colors[0].color, colors[1].color)
      if (ratio >= minRatio) continue
      // The file that makes this context differ: the first step of either chain that is read in
      // one of the context's modes (the brand file); without one, the foreground's own file.
      const home =
        [...fg.chain, ...bg.chain].find((step) => multiMode.has(step.collection)) ?? fg.chain[0]
      violations.push({
        rule: 'color-contrast',
        severity,
        tokenPath: `${fgName} / ${bgName}`,
        file: `${home.collection}.${home.mode}.json`,
        message: `Contrast ratio ${ratio.toFixed(2)}:1 between "${fgName}" (${colors[0].hex}) and "${bgName}" (${colors[1].hex}) is below ${minRatio}:1${inMode}`,
      })
    }
  }
  return violations
}

function noDuplicateValues(graph: GraphAnalysis, severity: 'error' | 'warn'): LintViolation[] {
  // v1 quirk (pinned by tests): groups across all collections and modes.
  const groups = new Map<string, GraphAnalysis['nodes']>()
  for (const node of graph.nodes) {
    if (node.aliasTarget !== null || node.references.length > 0) continue
    const key = `${node.type}:${formatValue(node.value)}`
    groups.set(key, [...(groups.get(key) ?? []), node])
  }
  const violations: LintViolation[] = []
  for (const group of groups.values()) {
    group.slice(1).forEach((node) => {
      const others = group.filter((other) => other !== node).map((other) => other.id)
      violations.push({
        rule: 'no-duplicate-values',
        severity,
        tokenPath: node.id,
        file: `${node.collection}.${node.mode}.json`,
        message: `Duplicate value "${formatValue(node.value)}" — also defined in: ${others.join(', ')}`,
      })
    })
  }
  return violations
}

/**
 * Checks a token model against the built-in rules and the rules enabled in `config`
 * (the `lint` section of the project config, validated here). Nothing is read, written or
 * printed; problems with the config come back as diagnostics.
 */
export function lintTokens(model: TokenModel, config?: unknown): LintResult {
  const { rules, diagnostics } = readLintConfig(config)
  const graph = analyzeGraph(model)

  const violations: LintViolation[] = [
    ...noDanglingAliases(graph),
    ...noCircularAliases(graph),
    ...noDefaultModeNames(graph),
  ]

  const alias = rules['semantic-must-alias']
  const aliasSeverity = alias && activeSeverity(alias.severity)
  if (alias && aliasSeverity) violations.push(...semanticMustAlias(graph, alias, aliasSeverity))

  const naming = rules['naming-pattern']
  const namingSeverity = naming && activeSeverity(naming.severity)
  if (naming && namingSeverity) {
    violations.push(...namingPattern(graph, naming, namingSeverity, diagnostics))
  }

  const contrast = rules['color-contrast']
  const contrastSeverity = contrast && activeSeverity(contrast.severity)
  if (contrast && contrastSeverity) {
    violations.push(...colorContrast(model, contrast, contrastSeverity, diagnostics))
  }

  const duplicates = rules['no-duplicate-values']
  const duplicateSeverity = duplicates && activeSeverity(duplicates.severity)
  if (duplicateSeverity) violations.push(...noDuplicateValues(graph, duplicateSeverity))

  return {
    violations,
    errorCount: violations.filter((v) => v.severity === 'error').length,
    warningCount: violations.filter((v) => v.severity === 'warn').length,
    diagnostics,
  }
}
