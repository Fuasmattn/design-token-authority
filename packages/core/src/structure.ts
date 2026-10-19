import { parseAlias } from './alias.js'
import type { Collection, TokenModel } from './types.js'

/** What a collection is used for in a layered token system. */
export type LayerRole = 'primitives' | 'brand' | 'dimension' | 'semantic' | 'unknown'

export interface CollectionStructure {
  name: string
  modeNames: string[]
  modeCount: number
  /** Distinct tokens, however many modes they have values in. */
  variableCount: number
  /** Share of values (token × mode) that are aliases, 0–1. */
  aliasRatio: number
  inferredRole: LayerRole
  /** 0–1; `unknown` roles are at most 0.4. */
  confidence: number
  notes: string[]
}

export interface StructureAnalysis {
  collections: CollectionStructure[]
  /** Every collection name, in model order. */
  suggestedCollections: string[]
  /** The most confident collection for each role, if any. */
  suggestedLayers: { primitives?: string; brand?: string; dimension?: string }
  /** The modes of the suggested brand collection. */
  suggestedBrands: string[]
}

/** Below this confidence a role is a guess to review (`dta analyze` marks it with ⚠). */
export const LOW_CONFIDENCE = 0.75

const DIMENSION_MODE_PATTERNS = [
  /^desktop$/i,
  /^mobile$/i,
  /^tablet$/i,
  /^phone$/i,
  /^sm$/i,
  /^md$/i,
  /^lg$/i,
  /^xl$/i,
  /^xxl$/i,
  /^xs$/i,
  /^small$/i,
  /^medium$/i,
  /^large$/i,
  /^compact$/i,
  /^expanded$/i,
]

function matchesDimensionPattern(modeNames: string[]): boolean {
  if (modeNames.length < 2) return false
  return modeNames.every((name) => DIMENSION_MODE_PATTERNS.some((p) => p.test(name.trim())))
}

function aliasRatio(collection: Collection): number {
  let total = 0
  let aliases = 0
  for (const token of collection.tokens) {
    for (const value of Object.values(token.values)) {
      total++
      if (typeof value === 'string' && parseAlias(value)) aliases++
    }
  }
  return total === 0 ? 0 : aliases / total
}

function inferRole(modeNames: string[], ratio: number, variableCount: number) {
  const modeCount = modeNames.length
  const notes: string[] = []

  if (matchesDimensionPattern(modeNames))
    return { role: 'dimension' as const, confidence: 0.92, notes }

  if (modeCount === 1 && ratio < 0.1) {
    if (variableCount < 10) {
      notes.push(`Only ${variableCount} variables — consider reviewing manually`)
      return { role: 'primitives' as const, confidence: 0.65, notes }
    }
    return { role: 'primitives' as const, confidence: 0.9, notes }
  }

  if (modeCount > 1 && ratio > 0.7) {
    return { role: 'brand' as const, confidence: ratio > 0.85 ? 0.94 : 0.8, notes }
  }

  if (modeCount === 1 && ratio > 0.7) {
    return { role: 'semantic' as const, confidence: ratio > 0.85 ? 0.9 : 0.75, notes }
  }

  if (modeCount > 1 && ratio < 0.3) {
    notes.push('Multiple modes with low alias ratio — could be a themed primitives collection')
    return { role: 'unknown' as const, confidence: 0.4, notes }
  }

  notes.push('Mixed alias ratio and mode count — review manually')
  return { role: 'unknown' as const, confidence: 0.3, notes }
}

/**
 * Infers the layers of a token system (primitives, brand, dimension, semantic) from the
 * collections, modes and alias ratios of a token model. It works on any model, whether it
 * came from Figma, a plugin export or token files. Ambiguous setups get the role `unknown`
 * with a low confidence and a note; nothing throws.
 *
 * Collections and modes follow the model's order (sorted by name), not Figma's.
 */
export function analyzeStructure(model: TokenModel): StructureAnalysis {
  const collections: CollectionStructure[] = model.collections.map((collection) => {
    const ratio = aliasRatio(collection)
    const variableCount = collection.tokens.length
    const { role, confidence, notes } = inferRole(collection.modes, ratio, variableCount)
    return {
      name: collection.name,
      modeNames: [...collection.modes],
      modeCount: collection.modes.length,
      variableCount,
      aliasRatio: ratio,
      inferredRole: role,
      confidence,
      notes,
    }
  })

  const mostConfident = (role: LayerRole) =>
    collections
      .filter((c) => c.inferredRole === role)
      .sort((a, b) => b.confidence - a.confidence)[0]

  const suggestedLayers: StructureAnalysis['suggestedLayers'] = {}
  const primitives = mostConfident('primitives')
  const brand = mostConfident('brand')
  const dimension = mostConfident('dimension')
  if (primitives) suggestedLayers.primitives = primitives.name
  if (brand) suggestedLayers.brand = brand.name
  if (dimension) suggestedLayers.dimension = dimension.name

  return {
    collections,
    suggestedCollections: collections.map((c) => c.name),
    suggestedLayers,
    suggestedBrands: brand ? [...brand.modeNames] : [],
  }
}
