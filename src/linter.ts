/**
 * TICKET-018: Token linter.
 *
 * Validates token files against built-in and configurable rules.
 * Built-in rules always run; configurable rules respect the lint config.
 *
 * Built-in rules (default severity: error):
 *   - no-dangling-aliases — unresolved alias targets
 *   - no-circular-aliases — circular alias chains
 *   - no-default-mode-names — Figma default mode names (Mode 1, Mode1, etc.)
 *
 * Configurable rules (default severity: warn):
 *   - semantic-must-alias — semantic layer tokens must be aliases
 *   - naming-pattern — token names must match a regex per collection
 *   - color-contrast — WCAG contrast ratio for specified color pairs
 *   - no-duplicate-values — duplicate raw values in primitives
 */

import type { LintConfig, LintSeverity } from './config/index.js'
import type { GraphNode, TokenGraph } from './graph.js'
import { readTokenFilesForGraph, buildGraph } from './graph.js'
import { parseColor } from './color.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LintViolation {
  rule: string
  severity: 'error' | 'warn'
  tokenPath: string
  file: string
  message: string
  fixable?: boolean
}

export interface LintResult {
  violations: LintViolation[]
  errorCount: number
  warningCount: number
}

// ---------------------------------------------------------------------------
// WCAG contrast utilities
// ---------------------------------------------------------------------------

/** Compute relative luminance per WCAG 2.1 definition. */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** Compute WCAG contrast ratio between two colors (each r/g/b in 0–1 range). */
export function contrastRatio(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
): number {
  const l1 = relativeLuminance(c1.r, c1.g, c1.b)
  const l2 = relativeLuminance(c2.r, c2.g, c2.b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ---------------------------------------------------------------------------
// Rule helpers
// ---------------------------------------------------------------------------

function resolveSeverity(
  configured: LintSeverity | undefined,
  defaultSeverity: 'error' | 'warn',
): 'error' | 'warn' | 'off' {
  return configured ?? defaultSeverity
}

// ---------------------------------------------------------------------------
// Built-in rules
// ---------------------------------------------------------------------------

function ruleDanglingAliases(graph: TokenGraph, severity: 'error' | 'warn'): LintViolation[] {
  return graph.danglingAliases.map((d) => ({
    rule: 'no-dangling-aliases',
    severity,
    tokenPath: d.sourceId,
    file: d.sourceFile + '.json',
    message: `Alias ${d.rawAlias} references non-existent token "${d.targetId}"`,
  }))
}

function ruleCircularAliases(graph: TokenGraph, severity: 'error' | 'warn'): LintViolation[] {
  return graph.cycles.map((c) => ({
    rule: 'no-circular-aliases',
    severity,
    tokenPath: c.path[0],
    file: '',
    message: `Circular alias chain: ${c.path.join(' → ')}`,
  }))
}

const DEFAULT_MODE_PATTERN = /^mode\s*\d+$/i

function ruleDefaultModeNames(
  nodes: Map<string, GraphNode>,
  severity: 'error' | 'warn',
): LintViolation[] {
  const violations: LintViolation[] = []
  const checkedFiles = new Set<string>()

  for (const node of nodes.values()) {
    if (checkedFiles.has(node.file)) continue
    checkedFiles.add(node.file)

    // File label format: "CollectionName.ModeName"
    const dotIndex = node.file.indexOf('.')
    if (dotIndex === -1) continue
    const modeName = node.file.slice(dotIndex + 1)

    if (DEFAULT_MODE_PATTERN.test(modeName)) {
      violations.push({
        rule: 'no-default-mode-names',
        severity,
        tokenPath: node.file,
        file: node.file + '.json',
        message: `Mode name "${modeName}" is a Figma default — rename to something meaningful`,
      })
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// Configurable rules
// ---------------------------------------------------------------------------

function ruleSemanticMustAlias(
  nodes: Map<string, GraphNode>,
  collections: string[],
  severity: 'error' | 'warn',
): LintViolation[] {
  const violations: LintViolation[] = []

  for (const node of nodes.values()) {
    // Check if this node belongs to one of the specified collections
    const dotIndex = node.file.indexOf('.')
    const collectionName = dotIndex !== -1 ? node.file.slice(0, dotIndex) : node.file

    if (!collections.includes(collectionName)) continue

    if (node.aliasTarget === null) {
      violations.push({
        rule: 'semantic-must-alias',
        severity,
        tokenPath: node.id,
        file: node.file + '.json',
        message: `Token has a raw value "${node.value}" but should be an alias in collection "${collectionName}"`,
      })
    }
  }

  return violations
}

function ruleNamingPattern(
  nodes: Map<string, GraphNode>,
  patterns: Record<string, string>,
  severity: 'error' | 'warn',
): LintViolation[] {
  const violations: LintViolation[] = []
  const compiledPatterns = new Map<string, RegExp>()

  for (const [collection, pattern] of Object.entries(patterns)) {
    compiledPatterns.set(collection, new RegExp(pattern))
  }

  for (const node of nodes.values()) {
    const dotIndex = node.file.indexOf('.')
    const collectionName = dotIndex !== -1 ? node.file.slice(0, dotIndex) : node.file

    const regex = compiledPatterns.get(collectionName)
    if (!regex) continue

    // Test each segment of the token path
    for (const segment of node.path) {
      if (!regex.test(segment)) {
        violations.push({
          rule: 'naming-pattern',
          severity,
          tokenPath: node.id,
          file: node.file + '.json',
          message: `Token path segment "${segment}" does not match pattern /${regex.source}/ for collection "${collectionName}"`,
        })
        break
      }
    }
  }

  return violations
}

function ruleColorContrast(
  nodes: Map<string, GraphNode>,
  pairs: Array<[string, string]>,
  minRatio: number,
  severity: 'error' | 'warn',
): LintViolation[] {
  const violations: LintViolation[] = []

  // Build a lookup from token path suffix to resolved color value
  const colorLookup = new Map<string, { hex: string; node: GraphNode }>()
  for (const node of nodes.values()) {
    if (node.type !== 'color') continue
    const value = String(node.value)
    if (!value.startsWith('#') && !value.startsWith('{')) continue
    if (value.startsWith('{')) continue // skip unresolved aliases

    const tokenNameInFile = node.id.slice(node.file.length + 1)
    // Store both slash-separated and dot-separated keys for flexible matching
    colorLookup.set(tokenNameInFile, { hex: value, node })
    colorLookup.set(tokenNameInFile.replace(/\//g, '.'), { hex: value, node })
  }

  for (const [fgPath, bgPath] of pairs) {
    const fg = colorLookup.get(fgPath) ?? colorLookup.get(fgPath.replace(/\./g, '/'))
    const bg = colorLookup.get(bgPath) ?? colorLookup.get(bgPath.replace(/\./g, '/'))

    if (!fg || !bg) continue // skip if tokens not found

    try {
      const fgColor = parseColor(fg.hex)
      const bgColor = parseColor(bg.hex)
      const ratio = contrastRatio(fgColor, bgColor)

      if (ratio < minRatio) {
        violations.push({
          rule: 'color-contrast',
          severity,
          tokenPath: `${fgPath} / ${bgPath}`,
          file: fg.node.file + '.json',
          message: `Contrast ratio ${ratio.toFixed(2)}:1 between "${fgPath}" (${fg.hex}) and "${bgPath}" (${bg.hex}) is below ${minRatio}:1`,
        })
      }
    } catch {
      // Skip unparseable colors
    }
  }

  return violations
}

function ruleNoDuplicateValues(
  nodes: Map<string, GraphNode>,
  severity: 'error' | 'warn',
): LintViolation[] {
  const violations: LintViolation[] = []

  // Group non-alias tokens by value
  const valueGroups = new Map<string, GraphNode[]>()
  for (const node of nodes.values()) {
    if (node.aliasTarget !== null) continue // skip aliases

    const key = `${node.type}:${String(node.value)}`
    const group = valueGroups.get(key)
    if (group) {
      group.push(node)
    } else {
      valueGroups.set(key, [node])
    }
  }

  for (const [, group] of valueGroups) {
    if (group.length <= 1) continue

    const ids = group.map((n) => n.id)
    // Report on each duplicate (except the first)
    for (let i = 1; i < group.length; i++) {
      violations.push({
        rule: 'no-duplicate-values',
        severity,
        tokenPath: group[i].id,
        file: group[i].file + '.json',
        message: `Duplicate value "${group[i].value}" — also defined in: ${ids.filter((_, idx) => idx !== i).join(', ')}`,
      })
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// Main linter
// ---------------------------------------------------------------------------

export function lintTokens(tokensDir: string, lintConfig?: LintConfig): LintResult {
  const nodes = readTokenFilesForGraph(tokensDir)
  const graph = buildGraph(nodes)

  return lintGraph(nodes, graph, lintConfig)
}

/** Lint from pre-built graph data (useful for testing and reuse). */
export function lintGraph(
  nodes: Map<string, GraphNode>,
  graph: TokenGraph,
  lintConfig?: LintConfig,
): LintResult {
  const violations: LintViolation[] = []
  const rules = lintConfig?.rules

  // --- Built-in rules (default: error) ---
  const danglingSeverity = resolveSeverity(undefined, 'error')
  if (danglingSeverity !== 'off') {
    violations.push(...ruleDanglingAliases(graph, danglingSeverity))
  }

  const circularSeverity = resolveSeverity(undefined, 'error')
  if (circularSeverity !== 'off') {
    violations.push(...ruleCircularAliases(graph, circularSeverity))
  }

  const defaultModeSeverity = resolveSeverity(undefined, 'error')
  if (defaultModeSeverity !== 'off') {
    violations.push(...ruleDefaultModeNames(nodes, defaultModeSeverity))
  }

  // --- Configurable rules (default: warn) ---

  if (rules?.['semantic-must-alias']) {
    const rule = rules['semantic-must-alias']
    const severity = resolveSeverity(rule.severity, 'warn')
    if (severity !== 'off' && rule.collections?.length) {
      violations.push(...ruleSemanticMustAlias(nodes, rule.collections, severity))
    }
  }

  if (rules?.['naming-pattern']) {
    const rule = rules['naming-pattern']
    const severity = resolveSeverity(rule.severity, 'warn')
    if (severity !== 'off' && rule.patterns && Object.keys(rule.patterns).length > 0) {
      violations.push(...ruleNamingPattern(nodes, rule.patterns, severity))
    }
  }

  if (rules?.['color-contrast']) {
    const rule = rules['color-contrast']
    const severity = resolveSeverity(rule.severity, 'warn')
    if (severity !== 'off' && rule.pairs?.length) {
      violations.push(...ruleColorContrast(nodes, rule.pairs, rule.minRatio ?? 4.5, severity))
    }
  }

  if (rules?.['no-duplicate-values']) {
    const rule = rules['no-duplicate-values']
    const severity = resolveSeverity(rule.severity, 'warn')
    if (severity !== 'off') {
      violations.push(...ruleNoDuplicateValues(nodes, severity))
    }
  }

  return {
    violations,
    errorCount: violations.filter((v) => v.severity === 'error').length,
    warningCount: violations.filter((v) => v.severity === 'warn').length,
  }
}
