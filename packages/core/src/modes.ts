import type { Collection, TokenModel } from './types.js'

/** Joins modifier names into a combined collection's name, and contexts into its modes. */
export const AXIS_SEPARATOR = ' × '

/** Which mode to read in each collection, by collection name. Missing → the default mode. */
export type ModeSelection = Record<string, string>

/**
 * The mode a selection picks in a collection: the one named for it, else (for a combination of
 * resolver modifiers) the combination of the contexts selected for its modifiers, each falling
 * back to its default, else the collection's default mode.
 */
export function modeOf(collection: Collection, selection: ModeSelection): string {
  const direct = selection[collection.name]
  if (direct !== undefined) return direct
  const fallback = collection.defaultMode ?? collection.modes[0]
  if (!collection.axes) return fallback
  const defaults = fallback.split(AXIS_SEPARATOR)
  return collection.axes.map((axis, i) => selection[axis] ?? defaults[i]).join(AXIS_SEPARATOR)
}

/**
 * The selection with each combined collection's mode spelled out per modifier (`brand × theme`
 * selected as `b × dark` also selects `b` for `brand` and `dark` for `theme`), so every
 * collection a reference reaches is read in the same contexts.
 */
export function expandSelection(model: TokenModel, selection: ModeSelection): ModeSelection {
  const out = { ...selection }
  for (const collection of model.collections) {
    const mode = selection[collection.name]
    if (!collection.axes || mode === undefined) continue
    const contexts = mode.split(AXIS_SEPARATOR)
    if (contexts.length !== collection.axes.length) continue
    collection.axes.forEach((axis, i) => {
      out[axis] ??= contexts[i]
    })
  }
  return out
}
