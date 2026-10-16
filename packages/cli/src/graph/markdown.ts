import type { GraphAnalysis } from '@dta/core'
import { entries, shortId } from './shared.js'

export function formatMarkdownReport(graph: GraphAnalysis): string {
  const stats = graph.stats
  const lines: string[] = []

  lines.push('# Token Dependency Graph Report')
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push(`| Total tokens | ${stats.totalTokens.toLocaleString()} |`)
  lines.push(`| Alias tokens | ${stats.aliasTokens.toLocaleString()} (${stats.aliasPercentage}%) |`)
  lines.push(`| Max chain depth | ${stats.maxChainDepth} |`)
  lines.push(`| Circular references | ${stats.circularRefs} |`)
  lines.push(`| Dangling aliases | ${stats.danglingAliases} |`)
  lines.push(`| Orphaned tokens | ${stats.orphanedTokens} |`)
  lines.push(`| Files | ${stats.fileCount} |`)
  lines.push('')

  // Tokens by file
  lines.push('## Tokens by file')
  lines.push('')
  lines.push('| File | Count |')
  lines.push('|------|-------|')
  for (const [file, count] of entries(stats.tokensByFile)) {
    lines.push(`| ${file} | ${count} |`)
  }
  lines.push('')

  // Dangling aliases
  if (graph.danglingAliases.length > 0) {
    lines.push('## Dangling aliases')
    lines.push('')
    lines.push('| Source | Alias | Target (missing) |')
    lines.push('|--------|-------|-------------------|')
    for (const da of graph.danglingAliases) {
      const shortSource = shortId(da.sourceId, da.file)
      lines.push(`| ${da.file} > ${shortSource} | ${da.rawAlias} | ${da.targetName} |`)
    }
    lines.push('')
  }

  // Circular references
  if (graph.cycles.length > 0) {
    lines.push('## Circular references')
    lines.push('')
    for (const cycle of graph.cycles) {
      lines.push(`- ${cycle.path.join(' → ')}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
