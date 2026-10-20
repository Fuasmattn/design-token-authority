import type { DanglingAlias, GraphAnalysis, GraphCycle, GraphNode } from './graph.js'
import type { Diagnostic } from './types.js'

/** What `dta lint` (`no-dangling-aliases`) and `dta build` say about an alias without a target. */
export const danglingAliasMessage = (dangling: DanglingAlias): string =>
  `Alias ${dangling.rawAlias} references non-existent token "${dangling.targetName}"`

/** What `dta lint` (`no-circular-aliases`) and `dta build` say about a cycle of aliases. */
export const circularAliasMessage = (cycle: GraphCycle): string =>
  `Circular alias chain: ${cycle.path.join(' → ')}`

export interface AliasProblems {
  /** One error per dangling alias and per cycle, worded as `dta lint` words them. */
  diagnostics: Diagnostic[]
  /**
   * Ids of the nodes (token and mode) that never reach a value: dangling aliases, the members of
   * a cycle, and every alias whose chain runs into one of them.
   */
  unresolvable: Set<string>
}

/**
 * The aliases of a graph that cannot resolve, as error diagnostics (codes `dangling-alias` and
 * `circular-alias`, the codes `resolve` uses) plus the nodes they make unresolvable. `include`
 * limits both to some nodes (a build of some collections only); a cycle counts when one of its
 * members is included.
 */
export function aliasProblems(
  graph: GraphAnalysis,
  include: (node: GraphNode) => boolean = () => true,
): AliasProblems {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const included = (id: string) => {
    const node = byId.get(id)
    return node !== undefined && include(node)
  }
  const diagnostics: Diagnostic[] = []
  const broken = new Set<string>()

  for (const dangling of graph.danglingAliases) {
    broken.add(dangling.sourceId)
    if (!included(dangling.sourceId)) continue
    diagnostics.push({
      severity: 'error',
      code: 'dangling-alias',
      message: danglingAliasMessage(dangling),
      file: `${dangling.file}.json`,
      path: byId.get(dangling.sourceId)?.name,
      docs: 'lint-rules',
    })
  }
  for (const cycle of graph.cycles) {
    for (const id of cycle.path) broken.add(id)
    const first = cycle.path.map((id) => byId.get(id)).find((node) => node && include(node))
    if (!first) continue
    diagnostics.push({
      severity: 'error',
      code: 'circular-alias',
      message: circularAliasMessage(cycle),
      file: `${first.collection}.${first.mode}.json`,
      path: first.name,
      docs: 'lint-rules',
    })
  }

  // Every node has at most one outgoing edge: follow it until a value or a broken node.
  const target = new Map(graph.edges.map((edge) => [edge.from, edge.to]))
  const known = new Map<string, boolean>([...broken].map((id) => [id, true]))
  for (const node of graph.nodes) {
    const walk: string[] = []
    let id: string | undefined = node.id
    while (id !== undefined && !known.has(id)) {
      walk.push(id)
      id = target.get(id)
    }
    const result = id !== undefined && known.get(id) === true
    for (const step of walk) known.set(step, result)
  }
  const unresolvable = new Set([...known].filter(([, bad]) => bad).map(([id]) => id))
  return { diagnostics, unresolvable }
}
