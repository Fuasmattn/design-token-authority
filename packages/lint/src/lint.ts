import { analyzeGraph } from '@dta/core'
import type { GraphAnalysis, TokenModel } from '@dta/core'
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
    message: `Alias ${dangling.rawAlias} references non-existent token "${dangling.targetName}"`,
  }))
}

function noCircularAliases(graph: GraphAnalysis): LintViolation[] {
  return graph.cycles.map((cycle) => ({
    rule: 'no-circular-aliases',
    severity: 'error',
    tokenPath: cycle.path[0],
    file: '',
    message: `Circular alias chain: ${cycle.path.join(' → ')}`,
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
    .filter((node) => collections.includes(node.collection) && node.aliasTarget === null)
    .map((node) => ({
      rule: 'semantic-must-alias',
      severity,
      tokenPath: node.id,
      file: `${node.collection}.${node.mode}.json`,
      message: `Token has a raw value "${node.value}" but should be an alias in collection "${node.collection}"`,
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

  return {
    violations,
    errorCount: violations.filter((v) => v.severity === 'error').length,
    warningCount: violations.filter((v) => v.severity === 'warn').length,
    diagnostics,
  }
}
