/**
 * What the playground does with its input (spec: docs/specs/playground.md decisions 2 and 3,
 * TICKET-077): token files or one plugin export in, structure and lint findings out, with the
 * wording the CLI prints. Pure and synchronous: it calls the public APIs of `@dta/core`,
 * `@dta/figma` and `@dta/lint` and nothing else, so it runs the same in Node (tests) and in the
 * browser (the island).
 *
 * How the input is read follows the CLI:
 * - one file that is not DTA's per-mode format is a plugin export, imported like
 *   `dta pull --from-file` (`detectFormat`, `importPluginExport`);
 * - everything else is a set of per-mode files, read like the tokens directory of `dta lint`
 *   (`parseTokenFiles`).
 * Lint runs with the default rules: a visitor has no `dta.config.ts`.
 *
 * The island loads this module lazily (TICKET-124): once the browser is idle after the first
 * render, or at once on the first input. Everything else on the first load imports only its types.
 */
import {
  analyzeGraph,
  analyzeStructure,
  formatDiagnostic,
  hasErrors,
  LOW_CONFIDENCE,
  nameToDot,
  parseAlias,
  parseTokenFiles,
  resolve,
  toColor,
  formatValue,
} from '@dta/core'
import type { Diagnostic, GraphAnalysis, TokenFileInput, TokenModel, TokenValue } from '@dta/core'
import { detectFormat, importPluginExport } from '@dta/figma'
import {
  formatLintSummary,
  formatRuleCount,
  groupViolationsByRule,
  LINT_MESSAGES,
  lintCounts,
  lintTokens,
} from '@dta/lint'
import type { LintViolation } from '@dta/lint'
import type { DetailLine } from '../components/ds/DetailPanel'
import { DOC_LINKS } from '../lib/doc-links'
import type { FindingGroup, FindingLine } from '../components/ds/Findings'
import type { StructureRow } from '../components/ds/StructureTable'

/** For the build's diagnostics in the Outputs tab (TICKET-124: the island imports no `@dta/*`). */
export { hasErrors }

export type Outcome = 'clean' | 'warnings' | 'failed'

/** One lint finding, with the line `dta lint` prints for it. */
export interface Finding extends FindingLine {
  rule: string
  /** The CLI's whole line: `warn message [rule]`. */
  cli: string
  /** `Collection.Mode.json`, or empty for findings that span files. */
  file: string
  /** The violation's token path (`Collection.Mode/Group/Token`), as `@dta/lint` reports it. */
  tokenPath: string
}

/** The findings of one rule, with its count (`1 error`, `no findings`). */
export interface RuleFindings {
  rule: string
  count: string
  /** The worst severity among its findings; none without findings. */
  severity?: 'error' | 'warning'
  findings: Finding[]
}

export interface PlaygroundResult {
  /** How the input was read: `dtcg-per-mode`, an adapter's format, or `unknown`. */
  format: string
  /** The token model read (for the detail panel); absent when the input could not be read. */
  model?: TokenModel
  /** Its alias graph (`analyzeGraph`), for the Graph view; absent with the model. */
  graph?: GraphAnalysis
  /** The files read (after a plugin import: the files it converts to). */
  files: string[]
  /** Problems reading the input, with the CLI's `error [code] message (file)` wording. */
  input: { groups: FindingGroup[]; failed: boolean }
  /** Absent when the input could not be read. */
  structure?: {
    rows: StructureRow[]
    brands: string[]
    /** The modes of the dimension (breakpoint) collection. */
    breakpoints: string[]
    tokens: number
  }
  lint?: {
    /** The default rules first (also when clean), then any other rule. */
    rules: RuleFindings[]
    summary: string
    /** The counts for the summary line: `1 error, 2 warnings`, or `0 lint findings`. */
    counts: string
    outcome: Outcome
    verdict?: string
  }
}

const finding = (violation: LintViolation): Finding => ({
  severity: violation.severity === 'error' ? 'error' : 'warning',
  label: violation.severity,
  text: violation.message,
  rule: violation.rule,
  cli: `${violation.severity} ${violation.message} [${violation.rule}]`,
  file: violation.file,
  tokenPath: violation.tokenPath,
})

/**
 * A diagnostic as the CLI words it, except the pointer to the docs: the CLI prints the repository
 * path ("See docs/….md."), the website links its own page (`DOC_LINKS`, TICKET-114).
 */
const diagnosticLine = (diagnostic: Diagnostic): FindingLine => {
  const line = formatDiagnostic(diagnostic, { docs: false })
  const label = diagnostic.severity
  const link = diagnostic.docs ? DOC_LINKS[diagnostic.docs] : undefined
  return {
    severity: diagnostic.severity,
    label,
    text: line.slice(label.length + 1),
    ...(link ? { link } : {}),
  }
}

/** Diagnostics in one group, in the order found; each line names its file, as in the CLI. */
export const diagnosticGroups = (diagnostics: readonly Diagnostic[]): FindingGroup[] =>
  diagnostics.length === 0 ? [] : [{ lines: diagnostics.map(diagnosticLine) }]

function isPluginExport(files: readonly TokenFileInput[]): unknown {
  if (files.length !== 1) return undefined
  // A DTCG `.tokens` file is never a plugin export.
  if (/\.tokens(\.json)?$/.test(files[0].fileName)) return undefined
  let json: unknown
  try {
    json = JSON.parse(files[0].content)
  } catch {
    // Not JSON: parseTokenFiles reports it with the file name, like `dta lint`.
    return undefined
  }
  return detectFormat(json) === 'dtcg-per-mode' ? undefined : json
}

function read(files: readonly TokenFileInput[]): {
  format: string
  model: TokenModel
  diagnostics: Diagnostic[]
  converted: boolean
} {
  const exported = isPluginExport(files)
  if (exported !== undefined) {
    const imported = importPluginExport(exported)
    return { ...imported, converted: imported.format !== 'unknown' }
  }
  return { format: 'dtcg-per-mode', converted: false, ...parseTokenFiles([...files]) }
}

const fileNamesOf = (model: TokenModel) =>
  model.collections.flatMap((collection) =>
    collection.modes.map((mode) => `${collection.name}.${mode}.json`),
  )

export function analyse(files: readonly TokenFileInput[]): PlaygroundResult {
  const { format, model, diagnostics, converted } = read(files)
  const failed = hasErrors(diagnostics) || format === 'unknown'
  const result: PlaygroundResult = {
    format,
    files: converted ? fileNamesOf(model) : files.map((file) => file.fileName),
    input: { groups: diagnosticGroups(diagnostics), failed },
  }
  if (failed) return result

  result.model = model
  result.graph = analyzeGraph(model)
  const structure = analyzeStructure(model)
  const dimension = structure.collections.find(
    (collection) => collection.name === structure.suggestedLayers.dimension,
  )
  result.structure = {
    rows: structure.collections.map((collection) => ({
      name: collection.name,
      modes: collection.modeNames,
      role: collection.inferredRole,
      confidence: collection.confidence.toFixed(2),
      low: collection.confidence < LOW_CONFIDENCE,
      variables: collection.variableCount,
      aliasShare: `${Math.round(collection.aliasRatio * 100)}%`,
      notes: collection.notes,
    })),
    brands: structure.suggestedBrands,
    breakpoints: dimension ? [...dimension.modeNames] : [],
    tokens: structure.collections.reduce((sum, collection) => sum + collection.variableCount, 0),
  }

  const lint = lintTokens(model)
  const outcome: Outcome =
    lint.errorCount > 0 ? 'failed' : lint.warningCount > 0 ? 'warnings' : 'clean'
  const counts = lintCounts(lint)
  result.lint = {
    rules: groupViolationsByRule(lint.violations).map(([rule, violations]) => ({
      rule,
      count: formatRuleCount(violations),
      ...(violations.length > 0
        ? { severity: violations.some((v) => v.severity === 'error') ? 'error' : 'warning' }
        : {}),
      findings: violations.map(finding),
    })),
    summary: formatLintSummary(lint),
    counts: counts.length === 0 ? '0 lint findings' : counts.map((c) => c.text).join(', '),
    outcome,
    verdict:
      outcome === 'failed'
        ? LINT_MESSAGES.failed
        : outcome === 'warnings'
          ? LINT_MESSAGES.passedWithWarnings
          : undefined,
  }
  return result
}

/** A value as the panel shows it: strings as written, numbers and booleans as text. */
const show = (value: TokenValue) => formatValue(value)

/** A colour value's CSS (for a swatch), or undefined for anything that is not a colour. */
const swatchOf = (value: TokenValue | undefined) =>
  typeof value === 'string' && toColor(value) ? value : undefined

/**
 * One token read in a mode: its name, then its alias chain and the value it resolves to
 * (`→ {Colors.Foundation.Blue.500}  #0057b8`), or its raw value, or why it does not resolve.
 * Aliases are read like Figma: each collection in its selected mode (`resolve` in @dta/core).
 */
function tokenLine(
  model: TokenModel,
  name: string[],
  selection: Record<string, string>,
  label = nameToDot(name),
): DetailLine {
  const result = resolve(model, name, selection)
  const chain = result.chain.slice(1).map((step) => `{${nameToDot(step.name)}}`)
  if (!result.ok) {
    const problem = result.diagnostics[0]?.message ?? 'Does not resolve.'
    return { name: label, detail: [...chain.map((c) => `→ ${c}`), problem].join('  ') }
  }
  const value = show(result.value)
  return {
    name: label,
    detail: chain.length > 0 ? `→ ${chain.join(' → ')}  ${value}` : value,
    swatch: swatchOf(result.value),
  }
}

/** What the detail panel shows for a collection: its tokens in one of its modes. */
export interface CollectionDetail {
  modes: string[]
  mode: string
  /** `11 tokens, 100% aliases.` */
  meta: string
  lines: DetailLine[]
}

export function collectionDetail(
  model: TokenModel,
  name: string,
  mode?: string,
): CollectionDetail | undefined {
  const collection = model.collections.find((c) => c.name === name)
  if (!collection) return undefined
  const selected = mode && collection.modes.includes(mode) ? mode : collection.modes[0]
  const aliases = collection.tokens.filter((token) => {
    const value = token.values[selected]
    return value !== undefined && parseAlias(value) !== null
  }).length
  const count = collection.tokens.length
  return {
    modes: collection.modes,
    mode: selected,
    meta: `${count} token${count === 1 ? '' : 's'}, ${aliases} alias${aliases === 1 ? '' : 'es'} in ${selected}.`,
    lines: collection.tokens.map((token) =>
      tokenLine(model, token.name, { [collection.name]: selected }),
    ),
  }
}

/**
 * A graph id (`Collection.Mode/Group/Token`, as `@dta/core`'s `analyzeGraph` and `@dta/lint`
 * name tokens) split by the model's collections; undefined unless the token exists there.
 */
export function parseTokenId(
  model: TokenModel,
  id: string,
): { collection: string; mode: string; path: string } | undefined {
  const slash = id.indexOf('/')
  if (slash < 0) return undefined
  const prefix = id.slice(0, slash)
  const collection = model.collections.find(
    (c) => prefix.startsWith(`${c.name}.`) && c.modes.includes(prefix.slice(c.name.length + 1)),
  )
  if (!collection) return undefined
  const path = id.slice(slash + 1)
  const name = path.split('/')
  if (!collection.tokens.some((token) => nameToDot(token.name) === nameToDot(name)))
    return undefined
  return { collection: collection.name, mode: prefix.slice(collection.name.length + 1), path }
}

/**
 * The token a finding is about, read in the finding's mode: `Collection.Mode/Group/Token` →
 * its alias chain and value. None for findings about a file or a pair of tokens.
 */
export function findingChain(model: TokenModel, tokenPath: string): DetailLine | undefined {
  const token = parseTokenId(model, tokenPath)
  if (!token) return undefined
  return tokenLine(model, token.path.split('/'), { [token.collection]: token.mode })
}
