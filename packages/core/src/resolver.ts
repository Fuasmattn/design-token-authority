import { parseTokenJson, reservedKeyMessage } from './json.js'
import { readEntries, type Entry } from './entries.js'
import { pointerSegments } from './references.js'
import { AXIS_SEPARATOR } from './modes.js'
import type { Diagnostic, TokenFileInput, TokenLayers, TokenValue } from './types.js'

/**
 * DTCG 2025.10 resolver documents (Resolver module): sets, modifiers with contexts, and the
 * order they apply in. DTA maps one onto collections and modes (spec dtcg-2025-10, decision 7):
 *
 * - every **set** is a single-mode collection named after the set, holding the tokens it
 *   defines last;
 * - every **modifier** is a multi-mode collection named after it, one mode per context, holding
 *   the tokens its contexts change; a context that leaves a token alone keeps the value of the
 *   sets before it.
 *
 * Sources merge in order and the last occurrence wins; aliases resolve after merging, so they
 * (and `$extends`) reach across sets. A token that two modifiers change is an error until
 * several modifiers combine as axes (TICKET-137).
 */

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isGroup = (value: unknown): value is Json => isObject(value) && !('$value' in value)

export interface ResolverRead {
  /** One tree per collection and mode, for the parser. */
  inputs: Array<TokenFileInput & { collection: string; mode: string }>
  diagnostics: Diagnostic[]
  /** The default mode of each modifier collection. */
  defaults: Record<string, string>
  /** File names the document read (sources), so other token files can be reported. */
  used: Set<string>
  /** The modifiers, in resolution order: each is a collection (or an axis of a combined one). */
  modifiers: string[]
  /** Collections of tokens several modifiers change, with each token's layers by path key. */
  combined: Array<{ collection: string; axes: string[]; layers: Map<string, TokenLayers> }>
}

/** Up to this many combinations of modifier contexts, all are compared (see `changes`). */
const MAX_COMBINATIONS = 256

interface Stage {
  kind: 'set' | 'modifier'
  name: string
  /** A set's sources, merged. */
  tree?: Json
  /** A modifier's contexts, each merged, in document order. */
  contexts?: Map<string, Json>
  default?: string
}

/** Deep merge in order: groups merge, a token (or anything else) replaces what was there. */
function merge(into: Json, from: Json): Json {
  const out: Json = { ...into }
  for (const [key, value] of Object.entries(from)) {
    out[key] = isGroup(value) && isGroup(out[key]) ? merge(out[key] as Json, value) : value
  }
  return out
}

const dirOf = (fileName: string) => fileName.split('/').slice(0, -1).join('/')
function joinPath(dir: string, relative: string): string {
  const parts = [...(dir ? dir.split('/') : []), ...relative.split('/')]
  const out: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

export function readResolver(
  document: TokenFileInput,
  files: TokenFileInput[],
  inputs: Record<string, string>,
): ResolverRead {
  const diagnostics: Diagnostic[] = []
  const used = new Set<string>([document.fileName])
  const empty = { inputs: [], diagnostics, defaults: {}, used, modifiers: [], combined: [] }
  const fail = (code: string, message: string) =>
    diagnostics.push({ severity: 'error', code, message, file: document.fileName })
  const warn = (code: string, message: string) =>
    diagnostics.push({ severity: 'warning', code, message, file: document.fileName })

  let root: unknown
  try {
    const parsed = parseTokenJson(document.content)
    root = parsed.value
    if (parsed.reservedKeys > 0)
      fail('reserved-key', reservedKeyMessage(document.fileName, parsed.reservedKeys))
  } catch (error) {
    fail('invalid-json', `"${document.fileName}" is not valid JSON: ${(error as Error).message}`)
    return empty
  }
  if (!isObject(root)) {
    fail('not-an-object', `"${document.fileName}" must contain a JSON object.`)
    return empty
  }
  if (root.version !== '2025.10') {
    fail(
      'resolver-version',
      `"${document.fileName}" has version ${JSON.stringify(root.version)}; DTA reads resolver documents of version "2025.10".`,
    )
    return empty
  }
  if (!Array.isArray(root.resolutionOrder)) {
    fail('resolver-order', 'The resolver document needs a "resolutionOrder" list.')
    return empty
  }

  const byName = new Map(files.map((f) => [f.fileName, f]))
  const base = dirOf(document.fileName)
  const cache = new Map<string, Json | null>()

  /** A token tree from a file (relative to the resolver), optionally at a pointer inside it. */
  const loadFile = (ref: string): Json | null => {
    const [path, fragment] = ref.split('#')
    const name = joinPath(base, path)
    if (!cache.has(name)) {
      const file = byName.get(name)
      if (!file) {
        fail('resolver-ref', `$ref "${ref}": the file "${name}" is not in the tokens directory.`)
        cache.set(name, null)
      } else {
        used.add(name)
        try {
          const parsed = parseTokenJson(file.content)
          if (parsed.reservedKeys > 0)
            fail('reserved-key', reservedKeyMessage(name, parsed.reservedKeys))
          const tree = parsed.value
          if (isObject(tree)) cache.set(name, tree)
          else {
            fail('not-an-object', `"${name}" must contain a JSON object.`)
            cache.set(name, null)
          }
        } catch (error) {
          fail('invalid-json', `"${name}" is not valid JSON: ${(error as Error).message}`)
          cache.set(name, null)
        }
      }
    }
    const tree = cache.get(name) ?? null
    if (!tree || !fragment) return tree
    const at = pointerAt(tree, fragment)
    if (!isObject(at)) {
      fail('resolver-ref', `$ref "${ref}" points at nothing in "${name}".`)
      return null
    }
    return at
  }

  function pointerAt(tree: unknown, pointer: string): unknown {
    let node = tree
    for (const key of pointerSegments(pointer.startsWith('#') ? pointer : `#${pointer}`)) {
      node = Array.isArray(node) ? node[Number(key)] : isObject(node) ? node[key] : undefined
    }
    return node
  }

  const sets = isObject(root.sets) ? root.sets : {}
  const modifiers = isObject(root.modifiers) ? root.modifiers : {}
  const setTrees = new Map<string, Json>()
  const setStack: string[] = []

  /** The merged tokens of a list of sources. `owner` names what holds them, for messages. */
  const mergeSources = (sources: unknown, owner: string): Json => {
    if (!Array.isArray(sources)) {
      fail('resolver-sources', `${owner} needs a "sources" list.`)
      return {}
    }
    let tree: Json = {}
    for (const source of sources) {
      if (isObject(source) && typeof source.$ref === 'string') {
        const ref = source.$ref
        const { $ref: _ref, ...siblings } = source
        let loaded: Json | null
        if (ref.startsWith('#/modifiers')) {
          fail(
            'resolver-ref',
            `${owner} refers to a modifier ("${ref}"); only resolutionOrder may.`,
          )
          continue
        } else if (ref.startsWith('#/resolutionOrder')) {
          fail(
            'resolver-ref',
            `${owner} points into resolutionOrder ("${ref}"), which is not allowed.`,
          )
          continue
        } else if (ref.startsWith('#/sets/')) {
          loaded = setTree(pointerSegments(ref)[1])
        } else if (ref.startsWith('#')) {
          const at = pointerAt(root, ref)
          loaded = isObject(at) ? at : null
          if (!loaded)
            fail('resolver-ref', `$ref "${ref}" points at nothing in the resolver document.`)
        } else {
          loaded = loadFile(ref)
        }
        // Keys next to $ref replace the referenced content's, shallowly.
        if (loaded) tree = merge(tree, { ...loaded, ...siblings })
      } else if (isObject(source)) {
        tree = merge(tree, source)
      } else {
        fail('resolver-sources', `${owner} has a source that is neither tokens nor a $ref.`)
      }
    }
    return tree
  }

  function setTree(name: string): Json | null {
    const known = setTrees.get(name)
    if (known) return known
    const set = sets[name]
    if (!isObject(set)) {
      fail('resolver-ref', `There is no set "${name}" in the resolver document.`)
      return null
    }
    if (setStack.includes(name)) {
      fail(
        'resolver-circular',
        `Sets refer to each other in a circle: ${[...setStack, name].join(' → ')}.`,
      )
      return null
    }
    setStack.push(name)
    const tree = mergeSources(set.sources, `Set "${name}"`)
    setStack.pop()
    setTrees.set(name, tree)
    return tree
  }

  const modifierStage = (name: string, modifier: unknown): Stage | null => {
    if (!isObject(modifier) || !isObject(modifier.contexts)) {
      fail('resolver-modifier', `Modifier "${name}" needs "contexts".`)
      return null
    }
    const names = Object.keys(modifier.contexts)
    if (names.length === 0) {
      fail('resolver-modifier', `Modifier "${name}" has no contexts.`)
      return null
    }
    if (names.length === 1) warn('resolver-modifier', `Modifier "${name}" has only one context.`)
    if (modifier.default !== undefined && !names.includes(String(modifier.default))) {
      fail(
        'resolver-modifier',
        `Modifier "${name}" has default ${JSON.stringify(modifier.default)}, which is not one of its contexts (${names.join(', ')}).`,
      )
      return null
    }
    const contexts = new Map<string, Json>()
    for (const context of names) {
      contexts.set(
        context,
        mergeSources(
          (modifier.contexts as Json)[context],
          `Context "${context}" of modifier "${name}"`,
        ),
      )
    }
    return {
      kind: 'modifier',
      name,
      contexts,
      ...(typeof modifier.default === 'string' ? { default: modifier.default } : {}),
    }
  }

  // The stages, in resolution order.
  const stages: Stage[] = []
  const inlineNames = new Set<string>()
  for (const [i, item] of (root.resolutionOrder as unknown[]).entries()) {
    if (isObject(item) && typeof item.$ref === 'string') {
      const [kind, name] = pointerSegments(item.$ref)
      const { $ref: _ref, ...siblings } = item
      if (kind === 'sets' && name !== undefined && isObject(sets[name])) {
        const tree = setTree(name)
        if (tree) stages.push({ kind: 'set', name, tree })
      } else if (kind === 'modifiers' && name !== undefined && isObject(modifiers[name])) {
        const stage = modifierStage(name, { ...(modifiers[name] as Json), ...siblings })
        if (stage) stages.push(stage)
      } else {
        fail(
          'resolver-order',
          `resolutionOrder item ${i + 1}: "${item.$ref}" is not a set or modifier of the document.`,
        )
      }
    } else if (
      isObject(item) &&
      typeof item.name === 'string' &&
      (item.type === 'set' || item.type === 'modifier')
    ) {
      if (inlineNames.has(item.name)) {
        fail('resolver-order', `resolutionOrder has two inline items named "${item.name}".`)
        continue
      }
      inlineNames.add(item.name)
      if (item.type === 'set') {
        stages.push({
          kind: 'set',
          name: item.name,
          tree: mergeSources(item.sources, `Set "${item.name}"`),
        })
      } else {
        const stage = modifierStage(item.name, item)
        if (stage) stages.push(stage)
      }
    } else {
      fail(
        'resolver-order',
        `resolutionOrder item ${i + 1} needs a $ref, or a "name" and a "type" ("set" or "modifier").`,
      )
    }
  }

  // The context each modifier is read in by default: the config's, the document's default, or
  // the first one (with a note, as the report asks for an input there).
  const defaults: Record<string, string> = {}
  for (const name of Object.keys(inputs)) {
    if (!stages.some((s) => s.kind === 'modifier' && s.name === name))
      fail(
        'resolver-input',
        `The config selects a context for "${name}", which is not a modifier of the resolver document.`,
      )
  }
  for (const stage of stages) {
    if (stage.kind !== 'modifier' || !stage.contexts) continue
    const names = [...stage.contexts.keys()]
    const chosen = inputs[stage.name]
    if (chosen !== undefined && !names.includes(chosen)) {
      fail(
        'resolver-input',
        `The config selects "${chosen}" for modifier "${stage.name}", which has the contexts ${names.join(', ')}.`,
      )
    }
    const fallback = names[0]
    defaults[stage.name] =
      chosen !== undefined && names.includes(chosen) ? chosen : (stage.default ?? fallback)
    if (chosen === undefined && stage.default === undefined) {
      warn(
        'resolver-default',
        `Modifier "${stage.name}" has no default and the config selects no context; DTA reads "${fallback}" where one context is needed.`,
      )
    }
  }

  // The tokens in every context of every modifier, the others at their default.
  /** Merged in order; a modifier selected as null is left out (for the layers of a token). */
  const flatten = (selection: Record<string, string | null>): Map<string, Entry> => {
    let tree: Json = {}
    for (const stage of stages) {
      if (stage.kind === 'set' && stage.tree) tree = merge(tree, stage.tree)
      if (stage.kind === 'modifier' && stage.contexts) {
        const chosen = stage.name in selection ? selection[stage.name] : defaults[stage.name]
        const context = chosen === null ? undefined : stage.contexts.get(chosen)
        if (context) tree = merge(tree, context)
      }
    }
    const { entries, problems } = readEntries(tree)
    // Each context reads the same files again: report each problem once.
    for (const problem of problems) {
      const key = `${problem.code}|${problem.message}`
      if (reported.has(key)) continue
      reported.add(key)
      diagnostics.push({ ...problem, file: document.fileName })
    }
    return new Map(entries.map((entry) => [JSON.stringify(entry.path), entry]))
  }
  const reported = new Set<string>()
  const quiet = flatten

  const defaultTree = flatten({})
  const modifierStages = stages.filter((s) => s.kind === 'modifier' && s.contexts)
  const perContext = new Map<string, Map<string, Map<string, Entry>>>()
  for (const stage of modifierStages) {
    const contexts = new Map<string, Map<string, Entry>>()
    for (const context of stage.contexts?.keys() ?? [])
      contexts.set(context, quiet({ [stage.name]: context }))
    perContext.set(stage.name, contexts)
  }

  /**
   * The last set that defines a path (in the default selection), for the token's collection. A
   * token a group inherits through `$extends` is written in no set: the last set that holds its
   * nearest group owns it.
   */
  const lastSet = (path: string[]): string | null => {
    for (let length = path.length; length > 0; length--) {
      let owner: string | null = null
      for (const stage of stages) {
        if (stage.kind !== 'set' || !stage.tree) continue
        let node: unknown = stage.tree
        for (const key of path.slice(0, length)) node = isObject(node) ? node[key] : undefined
        const found = length === path.length ? isObject(node) && '$value' in node : isGroup(node)
        if (found) owner = stage.name
      }
      if (owner) return owner
    }
    return null
  }

  const sameEntry = (a: Entry | undefined, b: Entry | undefined) =>
    JSON.stringify(a && [a.type, a.value]) === JSON.stringify(b && [b.type, b.value])

  const owned = new Map<string, Map<string, Entry>>() // "set/…", "modifier/…/…" → entries
  const combined = new Map<string, { axes: string[]; keys: string[] }>()
  const add = (key: string, path: string, entry: Entry) => {
    const map = owned.get(key) ?? owned.set(key, new Map()).get(key)
    map?.set(path, entry)
  }
  const paths = new Set([...defaultTree.keys()])
  for (const contexts of perContext.values())
    for (const entries of contexts.values()) for (const key of entries.keys()) paths.add(key)

  // Which modifiers change a token: one does when switching its context changes the token for
  // some choice of the others (not only at their defaults: a later modifier can undo an earlier
  // one, and a default context can hide one). Every combination is merged once; past
  // MAX_COMBINATIONS only the defaults of the others are tried, with a warning.
  const names = modifierStages.map((stage) => stage.name)
  const contextsOf = (stage: Stage) => [...(stage.contexts?.keys() ?? [])]
  const total = modifierStages.reduce((n, stage) => n * Math.max(1, contextsOf(stage).length), 1)
  const exhaustive = total <= MAX_COMBINATIONS
  if (!exhaustive) {
    diagnostics.push({
      severity: 'warning',
      code: 'resolver-combinations',
      message: `The modifiers have ${total} combinations of contexts; DTA compares each modifier's contexts with the others at their defaults only (up to ${MAX_COMBINATIONS} it compares all), so a token one modifier changes only away from another's default can be read wrong.`,
      file: document.fileName,
    })
  }
  const combinations = exhaustive
    ? modifierStages.reduce<string[][]>(
        (all, stage) => all.flatMap((combo) => contextsOf(stage).map((c) => [...combo, c])),
        [[]],
      )
    : []
  const merged = combinations.map((combo) =>
    quiet(Object.fromEntries(names.map((name, i) => [name, combo[i]]))),
  )
  const changes = (key: string, index: number): boolean => {
    if (!exhaustive) {
      const contexts = [...(perContext.get(names[index])?.values() ?? [])]
      return contexts.some((entries) => !sameEntry(entries.get(key), contexts[0].get(key)))
    }
    // Combinations that differ only in this modifier's context.
    const groups = new Map<string, Entry | undefined | null>()
    for (let i = 0; i < combinations.length; i++) {
      const others = combinations[i].filter((_, j) => j !== index).join('\u0000')
      const entry = merged[i].get(key)
      if (!groups.has(others)) groups.set(others, entry ?? null)
      else if (!sameEntry(groups.get(others) ?? undefined, entry)) return true
    }
    return false
  }

  for (const key of paths) {
    const varying = modifierStages.filter((_, index) => changes(key, index))
    if (varying.length > 1) {
      // Several modifiers change it: a collection for that combination of modifiers.
      const axes = varying.map((stage) => stage.name)
      const name = axes.join(AXIS_SEPARATOR)
      const group = combined.get(name) ?? combined.set(name, { axes, keys: [] }).get(name)
      group?.keys.push(key)
      continue
    }
    if (varying.length === 1) {
      const stage = varying[0]
      for (const [context, entries] of perContext.get(stage.name) ?? []) {
        const entry = entries.get(key)
        if (entry) add(`modifier/${stage.name}/${context}`, key, entry)
      }
      continue
    }
    const entry = defaultTree.get(key)
    if (!entry) continue
    const path = JSON.parse(key) as string[]
    const set = lastSet(path)
    if (set) add(`set/${set}`, key, entry)
    else {
      // Defined the same way in every context of a modifier: it belongs to that modifier.
      const modifier = modifierStages.find((stage) =>
        [...(stage.contexts?.values() ?? [])].some((tree) => {
          let node: unknown = tree
          for (const k of path) node = isObject(node) ? node[k] : undefined
          return isObject(node) && '$value' in node
        }),
      )
      if (modifier)
        for (const context of modifier.contexts?.keys() ?? [])
          add(`modifier/${modifier.name}/${context}`, key, entry)
    }
  }

  // Combined collections: one mode per combination of contexts, and each token's layers (the
  // sets' value, then what each context of each modifier sets), for CSS that combines freely.
  const none = Object.fromEntries(modifierStages.map((stage) => [stage.name, null]))
  const bare = flatten(none)
  const layers = new Map<string, Map<string, TokenLayers>>()
  /** Every combination of the axes' contexts, in resolution order: [["a","light"], …]. */
  const combosOf = (axes: string[]) =>
    axes
      .map((axis) => [
        ...(modifierStages.find((stage) => stage.name === axis)?.contexts?.keys() ?? []),
      ])
      .reduce<string[][]>(
        (all, list) => all.flatMap((combo) => list.map((context) => [...combo, context])),
        [[]],
      )
  for (const [name, group] of combined) {
    for (const combo of combosOf(group.axes)) {
      const entries = flatten(Object.fromEntries(group.axes.map((axis, i) => [axis, combo[i]])))
      for (const key of group.keys) {
        const entry = entries.get(key)
        if (entry) add(`combined/${name}/${combo.join(AXIS_SEPARATOR)}`, key, entry)
      }
    }
    const byToken = new Map<string, TokenLayers>()
    for (const key of group.keys) {
      const path = JSON.parse(key) as string[]
      const base = bare.get(key)
      byToken.set(key, {
        ...(base ? { base: base.value } : {}),
        axes: group.axes.map((axis) => {
          const stage = modifierStages.find((s) => s.name === axis)
          const contexts: Record<string, TokenValue> = {}
          for (const [context, tree] of stage?.contexts ?? []) {
            let node: unknown = tree
            for (const k of path) node = isObject(node) ? node[k] : undefined
            if (!(isObject(node) && '$value' in node)) continue
            const value = flatten({ ...none, [axis]: context }).get(key)?.value
            if (value !== undefined) contexts[context] = value
          }
          return { axis, contexts }
        }),
      })
    }
    layers.set(name, byToken)
  }

  /** A tree holding the given tokens, each with its own type (an alias without one stays so). */
  const treeOf = (entries: Map<string, Entry>): Json => {
    const tree: Json = {}
    for (const [key, entry] of entries) {
      const path = JSON.parse(key) as string[]
      let node = tree
      for (const segment of path.slice(0, -1)) node = (node[segment] ??= {}) as Json
      node[path[path.length - 1]] = {
        ...((entry.type as string) === 'alias' ? {} : { $type: entry.type }),
        $value: entry.value,
        ...(entry.description !== undefined ? { $description: entry.description } : {}),
        ...(entry.extensions ? { $extensions: entry.extensions } : {}),
        ...(entry.deprecated !== undefined ? { $deprecated: entry.deprecated } : {}),
      }
    }
    return tree
  }

  const result: ResolverRead['inputs'] = []
  for (const stage of stages) {
    if (stage.kind === 'set') {
      const entries = owned.get(`set/${stage.name}`)
      if (entries) {
        result.push({
          fileName: `${document.fileName}#sets/${stage.name}`,
          collection: stage.name,
          mode: 'Value',
          content: JSON.stringify(treeOf(entries)),
        })
      }
    } else {
      for (const context of stage.contexts?.keys() ?? []) {
        const entries = owned.get(`modifier/${stage.name}/${context}`)
        result.push({
          fileName: `${document.fileName}#modifiers/${stage.name}/${context}`,
          collection: stage.name,
          mode: context,
          content: JSON.stringify(entries ? treeOf(entries) : {}),
        })
      }
    }
  }
  for (const [name, group] of combined) {
    for (const combo of combosOf(group.axes)) {
      const mode = combo.join(AXIS_SEPARATOR)
      const entries = owned.get(`combined/${name}/${mode}`)
      result.push({
        fileName: `${document.fileName}#modifiers/${group.axes.join('+')}/${combo.join('+')}`,
        collection: name,
        mode,
        content: JSON.stringify(entries ? treeOf(entries) : {}),
      })
    }
  }
  return {
    inputs: result,
    diagnostics,
    defaults,
    used,
    modifiers: modifierStages.map((stage) => stage.name),
    combined: [...combined].map(([name, group]) => ({
      collection: name,
      axes: group.axes,
      layers: layers.get(name) ?? new Map(),
    })),
  }
}
