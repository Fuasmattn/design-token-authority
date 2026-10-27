/**
 * Orphaned variables (TICKET-021): variables in the Figma file whose token is no longer in the
 * token files, and the request that deletes them. `dta push` never deletes; this is the separate,
 * explicit path.
 *
 * Deliberately narrow, so a mistake cannot empty a file:
 * - only collections that exist in the token files with at least one token are looked at (a
 *   collection that was never pulled, that the caller left out, or whose file is empty, is left
 *   alone);
 * - a collection that would lose more than half of its variables is left alone unless
 *   `allowBulk` (that usually means the token files are incomplete, not that the tokens are gone);
 * - variables deleted in Figma but still referenced (`deletedButReferenced`) are not variables
 *   any more and are neither deleted again nor counted as aliasing;
 * - variables from a library (`remote`) are never deleted;
 * - an orphan that another variable still aliases is kept and named, since deleting it would
 *   break that alias: push first, then prune.
 */
import { nameToDot, toHex, type Diagnostic, type TokenModel } from '@dta/core'
import type { PostVariablesRequestBody } from '@figma/rest-api-spec'
import type { LocalVariable, LocalVariablesResponse } from './schemas.js'

export interface Orphan {
  id: string
  /** Dot form: `Colors.Brand.Old`. */
  name: string
  collection: string
  /** The value in each mode of the collection, as a token file would write it. */
  values: Array<{ mode: string; value: string }>
}

export interface PrunePlan {
  /** What `payload` deletes, by collection and name. */
  orphans: Orphan[]
  /** Orphans that are not deleted because other variables alias them. */
  kept: Array<Orphan & { aliasedBy: string[] }>
  /** Collections left alone because more than half of their variables would go (no `allowBulk`). */
  bulk: Array<{ collection: string; orphans: number; variables: number }>
  /** The `POST /v1/files/:key/variables` body; null when there is nothing to delete. */
  payload: PostVariablesRequestBody | null
  /** Notes: collections in Figma that are not in the token files, left alone. */
  diagnostics: Diagnostic[]
}

const dot = (name: string) => name.split('/').join('.')

function shown(
  value: LocalVariable['valuesByMode'][string] | undefined,
  variables: Record<string, LocalVariable>,
): string {
  if (value === undefined) return '–'
  if (typeof value !== 'object') return String(value)
  if ('type' in value) {
    const target = variables[value.id]
    return target ? `{${dot(target.name)}}` : `{${value.id}}`
  }
  if ('color' in value) return '(composed colour)'
  return toHex(value)
}

export function planPrune(
  model: TokenModel,
  response: LocalVariablesResponse,
  options: { allowBulk?: boolean } = {},
): PrunePlan {
  const { variableCollections } = response.meta
  // Deleted-but-referenced variables are not variables any more: out of every count.
  const variables = Object.fromEntries(
    Object.entries(response.meta.variables).filter(
      ([, variable]) => !variable.deletedButReferenced,
    ),
  )
  const diagnostics: Diagnostic[] = []
  const nothing = (): PrunePlan => ({ orphans: [], kept: [], bulk: [], payload: null, diagnostics })

  // Two collections with one name: which one the token files mean is unknown. Refuse, as push does.
  const seen = new Set<string>()
  for (const collection of Object.values(variableCollections)) {
    if (collection.remote) continue
    if (seen.has(collection.name)) {
      diagnostics.push({
        severity: 'error',
        code: 'duplicate-collection',
        message: `The Figma file has two collections named "${collection.name}"; prune does not guess which one the token files mean.`,
      })
      return nothing()
    }
    seen.add(collection.name)
  }

  // Names compared in dot form: a token file key "Spacing.4" and Figma's "Spacing/4" are the
  // same token for DTA. Names are unique across collections (a project rule): a token that moved
  // to another collection is not an orphan of the old one.
  const local = new Map(
    model.collections
      .filter((collection) => collection.tokens.length > 0)
      .map((collection) => [collection.name, collection]),
  )
  const everywhere = new Set(
    model.collections.flatMap((collection) =>
      collection.tokens.map((token) => nameToDot(token.name)),
    ),
  )

  const bulk: PrunePlan['bulk'] = []
  const candidates: Orphan[] = []
  for (const collection of Object.values(variableCollections)) {
    if (collection.remote) continue
    const ids = collection.variableIds.filter((id) => variables[id] && !variables[id].remote)
    if (!local.has(collection.name)) {
      const count = ids.length
      diagnostics.push({
        severity: 'warning',
        code: 'prune-collection-skipped',
        message: `The Figma collection "${collection.name}" is not in the token files (or has no tokens there), so its ${count} variable${count === 1 ? ' is' : 's are'} left alone.`,
      })
      continue
    }
    const found: Orphan[] = []
    for (const id of ids) {
      const variable = variables[id]
      if (everywhere.has(dot(variable.name))) continue
      found.push({
        id,
        name: dot(variable.name),
        collection: collection.name,
        values: collection.modes.map((mode) => ({
          mode: mode.name,
          value: shown(variable.valuesByMode[mode.modeId], variables),
        })),
      })
    }
    if (found.length > ids.length / 2 && !options.allowBulk) {
      bulk.push({ collection: collection.name, orphans: found.length, variables: ids.length })
      continue
    }
    candidates.push(...found)
  }

  // Who still aliases each candidate, among the variables that stay. A kept orphan stays too,
  // so what it aliases is looked at again, until nothing changes.
  const leaving = new Set(candidates.map((orphan) => orphan.id))
  const aliasedBy = new Map<string, string[]>()
  for (let changed = true; changed;) {
    changed = false
    for (const variable of Object.values(variables)) {
      if (leaving.has(variable.id)) continue
      for (const value of Object.values(variable.valuesByMode)) {
        if (typeof value !== 'object' || !('type' in value) || !leaving.has(value.id)) continue
        const list = aliasedBy.get(value.id) ?? []
        if (!list.includes(dot(variable.name))) list.push(dot(variable.name))
        aliasedBy.set(value.id, list)
        leaving.delete(value.id)
        changed = true
      }
    }
  }
  const orphans = candidates.filter((orphan) => leaving.has(orphan.id))
  const kept = candidates
    .filter((orphan) => !leaving.has(orphan.id))
    .map((orphan) => ({ ...orphan, aliasedBy: aliasedBy.get(orphan.id) ?? [] }))

  return {
    orphans,
    kept,
    bulk,
    payload:
      orphans.length === 0
        ? null
        : { variables: orphans.map((orphan) => ({ action: 'DELETE', id: orphan.id })) },
    diagnostics,
  }
}
