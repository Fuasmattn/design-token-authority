import type { GraphAnalysis } from '@dta/core'
import { fileOf } from './shared.js'

export function formatDotGraph(graph: GraphAnalysis): string {
  const lines: string[] = []
  lines.push('digraph TokenDependencies {')
  lines.push('  rankdir=LR;')
  lines.push('  node [shape=box, fontname="Helvetica", fontsize=10];')
  lines.push('  edge [color="#666666"];')
  lines.push('')

  // Subgraphs by file
  const fileGroups = new Map<string, string[]>()
  for (const node of graph.nodes) {
    const file = fileOf(node)
    if (!fileGroups.has(file)) fileGroups.set(file, [])
    fileGroups.get(file)!.push(node.id)
  }

  const fileColors: Record<string, string> = {}
  const palette = ['#e3f2fd', '#fce4ec', '#e8f5e9', '#fff3e0', '#f3e5f5', '#e0f7fa', '#fafafa']
  let colorIdx = 0
  for (const file of fileGroups.keys()) {
    fileColors[file] = palette[colorIdx % palette.length]
    colorIdx++
  }

  for (const [file, nodeIds] of fileGroups) {
    lines.push(`  subgraph "cluster_${file.replace(/[^a-zA-Z0-9]/g, '_')}" {`)
    lines.push(`    label="${file}";`)
    lines.push(`    style=filled;`)
    lines.push(`    color="${fileColors[file]}";`)
    for (const id of nodeIds) {
      const shortId = id.slice(file.length + 1)
      const escaped = id.replace(/"/g, '\\"')
      const shortEscaped = shortId.replace(/"/g, '\\"')
      lines.push(`    "${escaped}" [label="${shortEscaped}"];`)
    }
    lines.push('  }')
    lines.push('')
  }

  // Edges
  for (const edge of graph.edges) {
    const from = edge.from.replace(/"/g, '\\"')
    const to = edge.to.replace(/"/g, '\\"')
    lines.push(`  "${from}" -> "${to}";`)
  }

  lines.push('}')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Markdown table export
// ---------------------------------------------------------------------------
