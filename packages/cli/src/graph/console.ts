import type { GraphAnalysis } from '@dta/core'
import { entries, shortId } from './shared.js'

export function formatConsoleReport(graph: GraphAnalysis): string {
  const stats = graph.stats
  const lines: string[] = []

  lines.push('Token Dependency Graph')
  lines.push('─'.repeat(50))
  lines.push('')
  lines.push(`  Total tokens:       ${stats.totalTokens.toLocaleString()}`)
  lines.push(
    `  Alias tokens:       ${stats.aliasTokens.toLocaleString()}  (${stats.aliasPercentage}%)`,
  )
  lines.push(`  Max chain depth:    ${stats.maxChainDepth}`)
  lines.push(`  Circular refs:      ${stats.circularRefs}`)
  lines.push(
    `  Dangling aliases:   ${stats.danglingAliases}${stats.danglingAliases > 0 ? '  ⚠' : ''}`,
  )
  lines.push(
    `  Orphaned tokens:    ${stats.orphanedTokens}${stats.orphanedTokens > 0 ? '  ℹ' : ''}`,
  )
  lines.push('')

  // Tokens by file
  lines.push('  Tokens by file:')
  for (const [file, count] of entries(stats.tokensByFile)) {
    lines.push(`    ${file}: ${count}`)
  }
  lines.push('')

  // Tokens by type
  lines.push('  Tokens by type:')
  for (const [type, count] of entries(stats.tokensByType)) {
    lines.push(`    ${type}: ${count}`)
  }

  // Dangling aliases detail
  if (graph.danglingAliases.length > 0) {
    lines.push('')
    lines.push('⚠ Dangling aliases:')
    for (const da of graph.danglingAliases) {
      lines.push(`  ${da.file} > ${shortId(da.sourceId, da.file)}`)
      lines.push(`    → ${da.rawAlias} — not found in any token file`)
    }
  }

  // Circular references detail
  if (graph.cycles.length > 0) {
    lines.push('')
    lines.push('⚠ Circular references:')
    for (const cycle of graph.cycles) {
      lines.push(`  ${cycle.path.join(' → ')}`)
    }
  }

  // Orphaned tokens summary (just count + examples, not full list)
  if (graph.orphanedTokens.length > 0) {
    lines.push('')
    lines.push(
      `ℹ Orphaned tokens (${graph.orphanedTokens.length} raw values never referenced by any alias):`,
    )
    const examples = graph.orphanedTokens.slice(0, 10)
    for (const id of examples) {
      lines.push(`  ${id}`)
    }
    if (graph.orphanedTokens.length > 10) {
      lines.push(`  ... and ${graph.orphanedTokens.length - 10} more`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// DOT format export
// ---------------------------------------------------------------------------
