import { parseAlias } from './alias.js'
import { indexTokens } from './lookup.js'
import { nameToDot, nameToSlash } from './names.js'
import type { TokenModel, TokenName, TokenType, TokenValue } from './types.js'

/** One token in one mode. */
export interface GraphNode {
  /** `Collection.Mode/Group/Sub/Token`, the same id v1 `dta graph` printed. */
  id: string
  collection: string
  mode: string
  name: TokenName
  type: TokenType
  value: TokenValue
  /** The aliased token's name, or null for raw values. */
  aliasTarget: TokenName | null
}

export interface GraphEdge {
  from: string
  to: string
}

export interface GraphCycle {
  /** Node ids; the first id is repeated at the end, e.g. `[a, b, a]`. */
  path: string[]
}

export interface DanglingAlias {
  sourceId: string
  /** `Collection.Mode` of the token with the alias. */
  file: string
  /** The alias as written, e.g. `{Colors.Brand.Primary}`. */
  rawAlias: string
  /** The name the alias points at (dot form). */
  targetName: string
}

export interface GraphStats {
  totalTokens: number
  aliasTokens: number
  /** Rounded to a whole percent. */
  aliasPercentage: number
  maxChainDepth: number
  circularRefs: number
  danglingAliases: number
  orphanedTokens: number
  fileCount: number
  /** By `Collection.Mode`. */
  tokensByFile: Record<string, number>
  tokensByType: Record<string, number>
}

export interface GraphAnalysis {
  nodes: GraphNode[]
  edges: GraphEdge[]
  cycles: GraphCycle[]
  danglingAliases: DanglingAlias[]
  /** Raw-value tokens that no alias points at. */
  orphanedTokens: string[]
  /** Number of alias hops from each node to a raw value. */
  chainDepths: Record<string, number>
  maxChainDepth: number
  stats: GraphStats
}

/**
 * Analyses the alias graph of a token model: one node per token and mode, edges from
 * aliases to their targets, cycles, dangling aliases, orphans, chain depths and statistics.
 *
 * An alias is read in the node's own mode for tokens in the same collection, and in the
 * first mode of the target's collection otherwise (the default `resolve` selection).
 * Plain data out; never throws, and terminates on cyclic input.
 */
export function analyzeGraph(model: TokenModel): GraphAnalysis {
  const byName = indexTokens(model)
  const nodes: GraphNode[] = []
  const nodeById = new Map<string, GraphNode>()

  for (const collection of model.collections) {
    for (const mode of collection.modes) {
      for (const token of collection.tokens) {
        const value = token.values[mode]
        if (value === undefined) continue
        const node: GraphNode = {
          id: `${collection.name}.${mode}/${nameToSlash(token.name)}`,
          collection: collection.name,
          mode,
          name: token.name,
          type: token.type,
          value,
          aliasTarget: parseAlias(value),
        }
        nodes.push(node)
        nodeById.set(node.id, node)
      }
    }
  }

  const edges: GraphEdge[] = []
  const danglingAliases: DanglingAlias[] = []
  const target = new Map<string, string>()
  const referenced = new Set<string>()

  for (const node of nodes) {
    if (!node.aliasTarget) continue
    const targetName = nameToDot(node.aliasTarget)
    const found = byName.get(targetName)?.[0]
    const mode =
      found && (found.collection.name === node.collection ? node.mode : found.collection.modes[0])
    const to = found && `${found.collection.name}.${mode}/${nameToSlash(found.token.name)}`
    if (to !== undefined && nodeById.has(to)) {
      edges.push({ from: node.id, to })
      target.set(node.id, to)
      referenced.add(to)
    } else {
      danglingAliases.push({
        sourceId: node.id,
        file: `${node.collection}.${node.mode}`,
        rawAlias: `{${targetName}}`,
        targetName,
      })
    }
  }

  // Every node has at most one outgoing edge, so walking the pointers finds cycles and depths.
  const cycles: GraphCycle[] = []
  const chainDepths: Record<string, number> = {}
  const state = new Map<string, 1 | 2>() // 1 = on the current walk, 2 = finished
  for (const start of nodes) {
    if (state.has(start.id)) continue
    const walk: string[] = []
    let tail: number
    for (let id: string | undefined = start.id; ; ) {
      state.set(id, 1)
      walk.push(id)
      const next = target.get(id)
      if (next === undefined) {
        tail = 0
        break
      }
      const nextState = state.get(next)
      if (nextState === 1) {
        cycles.push({ path: [...walk.slice(walk.indexOf(next)), next] })
        tail = 1
        break
      }
      if (nextState === 2) {
        tail = 1 + chainDepths[next]
        break
      }
      id = next
    }
    for (let i = walk.length - 1, depth = tail; i >= 0; i--, depth++) {
      chainDepths[walk[i]] = depth
      state.set(walk[i], 2)
    }
  }
  const maxChainDepth = Math.max(0, ...Object.values(chainDepths))

  const orphanedTokens = nodes
    .filter((n) => !n.aliasTarget && !referenced.has(n.id))
    .map((n) => n.id)

  const tokensByFile: Record<string, number> = {}
  const tokensByType: Record<string, number> = {}
  let aliasTokens = 0
  for (const node of nodes) {
    const file = `${node.collection}.${node.mode}`
    tokensByFile[file] = (tokensByFile[file] ?? 0) + 1
    tokensByType[node.type] = (tokensByType[node.type] ?? 0) + 1
    if (node.aliasTarget) aliasTokens++
  }

  return {
    nodes,
    edges,
    cycles,
    danglingAliases,
    orphanedTokens,
    chainDepths,
    maxChainDepth,
    stats: {
      totalTokens: nodes.length,
      aliasTokens,
      aliasPercentage: nodes.length > 0 ? Math.round((aliasTokens / nodes.length) * 100) : 0,
      maxChainDepth,
      circularRefs: cycles.length,
      danglingAliases: danglingAliases.length,
      orphanedTokens: orphanedTokens.length,
      fileCount: Object.keys(tokensByFile).length,
      tokensByFile,
      tokensByType,
    },
  }
}
