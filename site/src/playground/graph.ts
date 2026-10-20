/**
 * The playground's dependency graph (TICKET-078, spec decisions 3 and 5): what `@dta/core` says
 * about the token model, for the modes shown, in the shape the design-system graph components
 * draw (GraphCanvas, GraphList, GraphSwitcher), and a token's details as `dta token get` gives
 * them. Pure: `analyzeGraph` (nodes, alias edges, cycles, dangling aliases, unused raw values;
 * run once by `analyse`, so this chunk does not carry it),
 * `resolve` (each row's value and chain in the modes shown, like Figma), `describeToken` (every
 * reading of a token) and `codeNames` from `@dta/build` (pure; no Style Dictionary); the findings
 * are the Lint view's. No copy of the analysis.
 *
 * Board decisions (Graph.dc.html, approved 2026-10-20): a dangling alias ends in a "missing" row
 * built here from the alias's target name (the engine reports it in `danglingAliases`, not as a
 * node), placed in the layer and group whose names it shares most; the graph shows one mode per
 * multi-mode collection (brand, breakpoint), the panel every reading.
 *
 * Loaded lazily with the Graph tab (graph-engine.ts), like the outputs.
 */
import {
  describeToken,
  nameToDot,
  resolve,
  toColor,
  type GraphAnalysis,
  type GraphNode,
  type TokenModel,
} from '@dta/core'
import { codeNames } from '@dta/build'
import type { DetailLine, DetailNote } from '../components/ds/DetailPanel'
import type {
  GraphData,
  GraphEdgeData,
  GraphGroupData,
  GraphLayerData,
  GraphNodeData,
  GraphSeverity,
} from '../components/ds/graph-layout'
import type { NotePart, SwitcherGroup } from '../components/ds/GraphSwitcher'
import { parseTokenId, type PlaygroundResult } from './analyse'

type Modes = Record<string, string>

/** Where a finding is in the Lint view (its rule and line), to open it there. */
export interface FindingRef {
  group: number
  line: number
}

interface Located {
  ref: FindingRef
  severity: GraphSeverity
  label: string
  rule: string
  text: string
  collection: string
  mode: string
}

/** The order of the columns: by layer role (the 3-layer model), then as read. */
const ROLE_ORDER: Record<string, number> = {
  primitives: 0,
  brand: 1,
  semantic: 2,
  unknown: 3,
  dimension: 4,
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** `1 error`, `2 warnings`, `1 error, 1 warning`; the worst severity first. */
function countText(found: readonly { severity: GraphSeverity }[]) {
  const errors = found.filter((f) => f.severity === 'error').length
  const warnings = found.length - errors
  const parts = []
  if (errors) parts.push(plural(errors, 'error'))
  if (warnings) parts.push(plural(warnings, 'warning'))
  return { text: parts.join(', '), severity: (errors ? 'error' : 'warning') as GraphSeverity }
}

/** The group label and the row's own part: `Colors.Foundation` + `Blue.500`. */
export function splitName(name: readonly string[]): { group: string; leaf: string } {
  const cut = Math.min(2, Math.max(0, name.length - 1))
  return { group: name.slice(0, cut).join('.'), leaf: name.slice(cut).join('.') }
}

/** The collections in column order, from the Structure view's roles. */
function collectionsInOrder(result: PlaygroundResult) {
  const model = result.model as TokenModel
  const role = new Map(result.structure?.rows.map((row) => [row.name, row.role]) ?? [])
  return model.collections
    .map((collection, index) => ({ collection, index, role: role.get(collection.name) }))
    .sort(
      (a, b) =>
        (ROLE_ORDER[a.role ?? 'unknown'] ?? 3) - (ROLE_ORDER[b.role ?? 'unknown'] ?? 3) ||
        a.index - b.index,
    )
}

/** The mode shown for every collection: the requested one where it exists, else the first. */
export function graphModes(model: TokenModel, requested: Modes = {}): Modes {
  return Object.fromEntries(
    model.collections.map((collection) => {
      const wanted = requested[collection.name]
      return [
        collection.name,
        wanted && collection.modes.includes(wanted) ? wanted : collection.modes[0],
      ]
    }),
  )
}

/** A token id (`Collection.Mode/Path`) split by the model's collections; undefined if unknown. */
export const parseNodeId = parseTokenId

/** The same token in the modes shown. */
export function idInModes(model: TokenModel, id: string, modes: Modes): string {
  const parsed = parseNodeId(model, id)
  if (!parsed) return id
  return `${parsed.collection}.${modes[parsed.collection] ?? parsed.mode}/${parsed.path}`
}

/** Every finding of the Lint view with where it is: the token(s) or the layer it is about. */
function locateFindings(result: PlaygroundResult, graph: GraphAnalysis) {
  const model = result.model as TokenModel
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const byNode = new Map<string, Located[]>()
  const byLayer = new Map<string, Located[]>()
  const all: Located[] = []
  result.lint?.rules.forEach((rule, group) =>
    rule.findings.forEach((finding, line) => {
      const base = {
        ref: { group, line },
        severity: finding.severity,
        label: finding.label,
        rule: finding.rule,
        text: finding.text,
      }
      const node = nodeById.get(finding.tokenPath)
      if (node) {
        // A circular alias is about every token on the circle.
        const cycle = graph.cycles.find((c) => c.path.includes(node.id))
        const ids =
          cycle && finding.rule === 'no-circular-aliases' ? [...new Set(cycle.path)] : [node.id]
        const located = { ...base, collection: node.collection, mode: node.mode }
        all.push(located)
        for (const id of ids) byNode.set(id, [...(byNode.get(id) ?? []), located])
        return
      }
      const collection = model.collections.find(
        (c) =>
          finding.tokenPath.startsWith(`${c.name}.`) &&
          c.modes.includes(finding.tokenPath.slice(c.name.length + 1)),
      )
      if (!collection) return
      const mode = finding.tokenPath.slice(collection.name.length + 1)
      const located = { ...base, collection: collection.name, mode }
      all.push(located)
      const key = `${collection.name}.${mode}`
      byLayer.set(key, [...(byLayer.get(key) ?? []), located])
    }),
  )
  return { byNode, byLayer, all }
}

/** Short words for a file finding on a layer header (`default mode name`). */
const LAYER_WORDS: Record<string, string> = {
  'no-default-mode-names': 'default mode name',
}

const worst = (found: readonly Located[] | undefined): GraphSeverity | undefined =>
  !found?.length ? undefined : found.some((f) => f.severity === 'error') ? 'error' : 'warning'

export interface GraphView {
  modes: Modes
  /** The modes of the multi-mode collections, `BrandA · Desktop`. */
  label: string
  data: GraphData
  switcher: SwitcherGroup[]
  note: NotePart[]
  /** The ids of the rows drawn (not the missing targets). */
  ids: Set<string>
  /** Opens a layer finding: its id (as GraphLayerFinding) → where it is in the Lint view. */
  layerFindings: Map<string, FindingRef>
  /** The Lint view's findings by token (graph id) and by layer. */
  findings: ReturnType<typeof locateFindings>
}

/** The graph for the modes shown. */
export function buildGraph(result: PlaygroundResult, requested: Modes = {}): GraphView {
  const model = result.model as TokenModel
  const modes = graphModes(model, requested)
  const graph = result.graph as GraphAnalysis
  const found = locateFindings(result, graph)
  const order = collectionsInOrder(result)
  const shown = (node: GraphNode) => modes[node.collection] === node.mode
  const view = graph.nodes.filter(shown)
  const ids = new Set(view.map((node) => node.id))
  const orphans = new Set(graph.orphanedTokens)
  const inCycle = new Set(graph.cycles.flatMap((cycle) => cycle.path))

  // Rows, in the model's order, per collection and group.
  const groupsOf = new Map<string, Map<string, GraphNodeData[]>>()
  for (const node of view) {
    const read = resolve(model, node.name, modes)
    const chain = read.chain.map((step) => nameToDot(step.name))
    const seen = new Set<string>()
    const via = chain.slice(1).filter((name) => {
      if (seen.has(name) || name === chain[0]) return false
      seen.add(name)
      return true
    })
    const problemCode = read.ok ? undefined : read.diagnostics[0]?.code
    if (problemCode === 'dangling-alias') {
      // The name the chain's last alias points at (the engine's dangling alias of that token).
      const last = read.chain[read.chain.length - 1]
      const lastId = last && `${last.collection}.${last.mode}/${last.name.join('/')}`
      const dangling = graph.danglingAliases.find((d) => d.sourceId === lastId)
      if (dangling) via.push(dangling.targetName)
    }
    const { group, leaf } = splitName(node.name)
    const data: GraphNodeData = {
      id: node.id,
      name: nameToDot(node.name),
      group,
      leaf,
      ...(read.ok ? { value: String(read.value) } : {}),
      ...(read.ok && typeof read.value === 'string' && toColor(read.value)
        ? { swatch: read.value }
        : {}),
      ...(via.length ? { via } : {}),
      ...(problemCode
        ? {
            problem:
              problemCode === 'dangling-alias'
                ? 'does not exist'
                : problemCode === 'circular-alias' || inCycle.has(node.id)
                  ? 'circular'
                  : 'does not resolve',
          }
        : {}),
      ...(worst(found.byNode.get(node.id)) ? { severity: worst(found.byNode.get(node.id)) } : {}),
      ...(orphans.has(node.id) ? { unused: true } : {}),
    }
    const groups = groupsOf.get(node.collection) ?? new Map<string, GraphNodeData[]>()
    groups.set(group, [...(groups.get(group) ?? []), data])
    groupsOf.set(node.collection, groups)
  }

  // Arrows: the engine's alias edges, each read into the modes shown (as `resolve` does).
  const edges: GraphEdgeData[] = []
  for (const edge of graph.edges) {
    if (!ids.has(edge.from)) continue
    const to = idInModes(model, edge.to, modes)
    if (!ids.has(to)) continue
    const circular = inCycle.has(edge.from) && inCycle.has(to)
    edges.push({ from: edge.from, to, kind: circular ? 'circular' : 'alias' })
  }

  // A dangling alias points at a missing row, in the layer and group its name shares most with.
  const columns = order.map(({ collection }) => collection.name)
  for (const dangling of graph.danglingAliases) {
    if (!ids.has(dangling.sourceId)) continue
    const target = dangling.targetName.split('.')
    const id = `missing:${dangling.targetName}`
    let best = { collection: columns[0], score: -1, after: -1 }
    for (const collection of columns) {
      const groups = groupsOf.get(collection)
      if (!groups) continue
      for (const nodes of groups.values()) {
        nodes.forEach((row, index) => {
          const name = row.name.split('.')
          let score = 0
          while (score < name.length - 1 && name[score] === target[score]) score++
          if (score > best.score) best = { collection, score, after: index }
          else if (score === best.score && collection === best.collection) best.after = index
        })
      }
    }
    const { group, leaf } = splitName(target)
    const groups = groupsOf.get(best.collection) ?? new Map<string, GraphNodeData[]>()
    const list = [...(groups.get(group) ?? [])]
    const missing: GraphNodeData = {
      id,
      name: dangling.targetName,
      group,
      leaf,
      missing: true,
      severity: 'error',
      problem: 'does not exist',
    }
    if (!list.some((row) => row.id === id)) {
      const at = list.reduce(
        (last, row, index) =>
          row.name.split('.').slice(0, -1).join('.') === target.slice(0, -1).join('.')
            ? index
            : last,
        list.length - 1,
      )
      list.splice(at + 1, 0, missing)
      groups.set(group, list)
      groupsOf.set(best.collection, groups)
    }
    edges.push({ from: dangling.sourceId, to: id, kind: 'dangling' })
  }

  const layerFindings = new Map<string, FindingRef>()
  const layers: GraphLayerData[] = order.map(({ collection }) => {
    const mode = modes[collection.name]
    const groups: GraphGroupData[] = [
      ...(groupsOf.get(collection.name) ?? new Map()).entries(),
    ].map(([label, nodes]) => ({ label, nodes }))
    const tokens = view.filter((node) => node.collection === collection.name).length
    const files = found.byLayer.get(`${collection.name}.${mode}`) ?? []
    const located = [
      ...files,
      ...found.all.filter(
        (f) => f.collection === collection.name && f.mode === mode && !files.includes(f),
      ),
    ]
    const findings = files.map((f) => {
      const id = `${f.ref.group}-${f.ref.line}`
      layerFindings.set(id, f.ref)
      return { id, severity: f.severity, text: LAYER_WORDS[f.rule] ?? f.rule }
    })
    return {
      collection: collection.name,
      mode,
      count: plural(tokens, 'token'),
      ...(findings.length ? { findings } : {}),
      ...(located.length ? { status: countText(located) } : {}),
      groups,
    }
  })

  // The switcher: one control per multi-mode collection, each mode with its findings.
  const switcher: SwitcherGroup[] = order
    .filter(({ collection }) => collection.modes.length > 1)
    .map(({ collection, role }) => ({
      id: collection.name,
      label: role === 'brand' ? 'Brand' : role === 'dimension' ? 'Breakpoint' : collection.name,
      selected: modes[collection.name],
      options: collection.modes.map((mode) => {
        const here = found.all.filter((f) => f.collection === collection.name && f.mode === mode)
        if (!here.length) return { value: mode }
        const { text, severity } = countText(here)
        return { value: mode, count: text, severity }
      }),
    }))

  const label = order
    .filter(({ collection }) => collection.modes.length > 1)
    .map(({ collection }) => modes[collection.name])
    .join(' · ')
  const aliases = view.filter((node) => node.aliasTarget).length
  const inView = found.all.filter((f) => modes[f.collection] === f.mode)
  const total = found.all.length
  const noun = found.all.every((f) => f.severity === 'error')
    ? 'error'
    : found.all.every((f) => f.severity === 'warning')
      ? 'warning'
      : 'finding'
  const note: NotePart[] = [
    `${plural(view.length, 'token')}${label ? ` in ${label}` : ''}, ${aliases} alias${aliases === 1 ? '' : 'es'}; `,
  ]
  if (total === 0) note.push('no lint findings. ')
  else {
    note.push({
      text: `${inView.length} of ${plural(total, noun)}`,
      severity:
        inView.some((f) => f.severity === 'error') || noun === 'error' ? 'error' : 'warning',
    })
    note.push(` ${total === 1 ? 'is' : 'are'} in this view. `)
  }
  note.push(
    'Arrows run from an alias to the token it uses. Arrow keys move along the graph, Enter opens a token.',
  )

  return {
    modes,
    label,
    data: { layers, edges },
    switcher,
    note,
    ids,
    layerFindings,
    findings: found,
  }
}

/** What the detail panel shows for a token: every reading, as `dta token get` prints it. */
export interface TokenDetail {
  kicker: string
  title: string
  /** `Every brand`, or none when the token reads the same everywhere. */
  scope?: string
  /** The modes the graph shows, `BrandA · Desktop`. */
  shows: string
  lines: DetailLine[]
  facts: { label: string; value: string }[]
  notes: DetailNote[]
  /** The token's first finding in the Lint view (one in view first). */
  lint?: FindingRef
  /** Modes of its findings the graph does not show: `Show BrandB` switches to them. */
  elsewhere: { collection: string; mode: string }[]
}

const modeLabel = (modes: Record<string, string>) =>
  Object.values(modes).join(' · ') || 'every mode'

export function tokenDetail(
  result: PlaygroundResult,
  view: GraphView,
  id: string,
): TokenDetail | undefined {
  const model = result.model as TokenModel
  const parsed = parseNodeId(model, id)
  if (!parsed) return undefined
  const name = parsed.path.split('/').join('.')
  const token = describeToken(model, name)
  if (!token) return undefined
  const roles = new Map(result.structure?.rows.map((row) => [row.name, row.role]) ?? [])
  const lines: DetailLine[] = token.readings.map((reading) => {
    const inView = Object.entries(reading.modes).every(([c, m]) => view.modes[c] === m)
    const chain = reading.chain.length > 1 ? `  ${reading.chain.join(' → ')}` : ''
    const value = reading.value === undefined ? undefined : String(reading.value)
    return {
      name: modeLabel(reading.modes),
      ...(inView ? { tag: 'in view' } : {}),
      ...(reading.error
        ? { detail: `unresolved: ${reading.error}`, severity: 'error' as const }
        : {
            detail: `${value ?? '–'}${chain}`,
            ...(value && toColor(value) ? { swatch: value } : {}),
          }),
    }
  })
  const varies = [...new Set(token.readings.flatMap((reading) => Object.keys(reading.modes)))]
  const words = varies.map((collection) =>
    roles.get(collection) === 'brand'
      ? 'brand'
      : roles.get(collection) === 'dimension'
        ? 'breakpoint'
        : `mode of ${collection}`,
  )
  const names = codeNames(
    model,
    { brands: result.structure?.brands ?? [] },
    token,
    token.extensions,
  )
  const facts = names
    ? [
        { label: 'CSS', value: `var(${names.css})` },
        ...(names.tailwind ? [{ label: 'Tailwind', value: names.tailwind }] : []),
      ]
    : [
        {
          label: 'Build',
          value: `Not in the build output: dta build writes ${token.collection} only in the modes listed in brands.`,
        },
      ]

  // Its findings in every mode, in the Lint view's order.
  const located = view.findings
  const collection = model.collections.find((c) => c.name === parsed.collection)
  const mine: Located[] = []
  for (const mode of collection?.modes ?? []) {
    for (const f of located.byNode.get(`${parsed.collection}.${mode}/${parsed.path}`) ?? []) {
      if (!mine.includes(f)) mine.push(f)
    }
  }
  mine.sort((a, b) => a.ref.group - b.ref.group || a.ref.line - b.ref.line)
  const multi = (collection?.modes.length ?? 0) > 1
  const notes: DetailNote[] = mine.map((f) => ({
    severity: f.severity,
    kicker: [f.label, f.rule, ...(multi ? [f.mode] : [])].join(' · '),
    text: f.text,
  }))
  const shownFirst = [...mine].sort(
    (a, b) =>
      Number(view.modes[b.collection] === b.mode) - Number(view.modes[a.collection] === a.mode),
  )
  const elsewhere: { collection: string; mode: string }[] = []
  for (const f of mine) {
    if (view.modes[f.collection] === f.mode) continue
    if (!elsewhere.some((e) => e.collection === f.collection && e.mode === f.mode))
      elsewhere.push({ collection: f.collection, mode: f.mode })
  }
  return {
    kicker: `Token · ${token.type} · ${token.collection}`,
    title: token.name,
    ...(token.readings.length > 1 && words.length ? { scope: `Every ${words.join(' and ')}` } : {}),
    shows: view.label,
    lines,
    facts,
    notes,
    ...(shownFirst[0] ? { lint: shownFirst[0].ref } : {}),
    elsewhere,
  }
}
