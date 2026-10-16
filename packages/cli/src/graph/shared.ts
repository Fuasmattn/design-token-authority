import type { GraphAnalysis, GraphNode } from '@dta/core'

/** `Collection.Mode`, the file a node comes from (without `.json`). */
export const fileOf = (node: GraphNode): string => `${node.collection}.${node.mode}`

/** The id of a node without its file prefix. */
export const shortId = (id: string, file: string): string => id.slice(file.length + 1)

export const entries = (record: Record<string, number>): Array<[string, number]> =>
  Object.entries(record)

/**
 * Puts the analysis in the order the legacy reports used: files sorted by their full file
 * name (`Collection.Mode.json`), tokens in file order. The model sorts modes on their own,
 * which differs for modes such as `1` and `1.5`. Everything derived from the nodes follows.
 */
export function inLegacyOrder(graph: GraphAnalysis): GraphAnalysis {
  const files = [...new Set(graph.nodes.map(fileOf))].sort((a, b) => {
    const [x, y] = [`${a}.json`, `${b}.json`]
    return x < y ? -1 : x > y ? 1 : 0
  })
  const rank = new Map(files.map((file, index) => [file, index]))
  const nodes = graph.nodes
    .map((node, position) => ({ node, position }))
    .sort(
      (a, b) => rank.get(fileOf(a.node))! - rank.get(fileOf(b.node))! || a.position - b.position,
    )
    .map(({ node }) => node)

  const index = new Map(nodes.map((node, position) => [node.id, position]))
  const at = (id: string) => index.get(id) ?? Number.MAX_SAFE_INTEGER
  const sortedBy = <T>(items: T[], key: (item: T) => string) =>
    items
      .map((item, position) => ({ item, position }))
      .sort((a, b) => at(key(a.item)) - at(key(b.item)) || a.position - b.position)
      .map(({ item }) => item)

  const count = (key: (node: GraphNode) => string) => {
    const result: Record<string, number> = {}
    for (const node of nodes) result[key(node)] = (result[key(node)] ?? 0) + 1
    return result
  }
  return {
    ...graph,
    nodes,
    edges: sortedBy(graph.edges, (edge) => edge.from),
    danglingAliases: sortedBy(graph.danglingAliases, (alias) => alias.sourceId),
    orphanedTokens: sortedBy(graph.orphanedTokens, (id) => id),
    stats: {
      ...graph.stats,
      tokensByFile: count(fileOf),
      tokensByType: count((node) => node.type),
    },
  }
}
