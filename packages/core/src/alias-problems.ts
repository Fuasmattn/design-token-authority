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

  // A node is unresolvable when it is broken or any reference leads to an unresolvable node.
  const targets = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const list = targets.get(edge.from)
    if (list) list.push(edge.to)
    else targets.set(edge.from, [edge.to])
  }
  const known = new Map<string, boolean>([...broken].map((id) => [id, true]))
  const bad = (id: string, visiting: Set<string>): boolean => {
    const result = known.get(id)
    if (result !== undefined) return result
    if (visiting.has(id)) return false // a cycle is already in `broken`
    visiting.add(id)
    const value = (targets.get(id) ?? []).some((to) => bad(to, visiting))
    visiting.delete(id)
    known.set(id, value)
    return value
  }
  for (const node of graph.nodes) bad(node.id, new Set())
  const unresolvable = new Set([...known].filter(([, bad]) => bad).map(([id]) => id))
  return { diagnostics, unresolvable }
}
