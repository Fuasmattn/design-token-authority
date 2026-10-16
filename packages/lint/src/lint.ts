import { analyzeGraph } from '@dta/core'
import type { GraphAnalysis, TokenModel } from '@dta/core'
import { readLintConfig } from './config.js'
import type { LintResult, LintViolation } from './types.js'

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

/**
 * Checks a token model against the built-in rules and the rules enabled in `config`
 * (the `lint` section of the project config, validated here). Nothing is read, written or
 * printed; problems with the config come back as diagnostics.
 */
export function lintTokens(model: TokenModel, config?: unknown): LintResult {
  const { diagnostics } = readLintConfig(config)
  const graph = analyzeGraph(model)

  const violations: LintViolation[] = [
    ...noDanglingAliases(graph),
    ...noCircularAliases(graph),
    ...noDefaultModeNames(graph),
  ]

  return {
    violations,
    errorCount: violations.filter((v) => v.severity === 'error').length,
    warningCount: violations.filter((v) => v.severity === 'warn').length,
    diagnostics,
  }
}
