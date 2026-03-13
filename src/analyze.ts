/**
 * TICKET-014: Figma variable structure autodiscovery.
 *
 * Analyzes a Figma file's variable collections and infers the design system
 * layering (primitives, brand, dimension, semantic) using heuristics.
 */

import {
  GetLocalVariablesResponse,
  LocalVariable,
  LocalVariableCollection,
} from '@figma/rest-api-spec'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayerRole = 'primitives' | 'brand' | 'dimension' | 'semantic' | 'unknown'

export interface CollectionAnalysis {
  collectionId: string
  name: string
  modeCount: number
  modeNames: string[]
  variableCount: number
  aliasRatio: number // 0–1
  inferredRole: LayerRole
  confidence: number // 0–1
  notes: string[]
}

export interface AnalysisResult {
  collections: CollectionAnalysis[]
  suggestedLayers: {
    primitives?: string
    brand?: string
    dimension?: string
  }
  suggestedBrands: string[]
}

// ---------------------------------------------------------------------------
// Heuristic patterns
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Core analysis
// ---------------------------------------------------------------------------

function computeAliasRatio(
  collection: LocalVariableCollection,
  variables: { [id: string]: LocalVariable },
): number {
  let totalValues = 0
  let aliasValues = 0

  for (const varId of collection.variableIds) {
    const variable = variables[varId]
    if (!variable || variable.remote) continue

    for (const modeId of Object.keys(variable.valuesByMode)) {
      totalValues++
      const value = variable.valuesByMode[modeId]
      if (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        value.type === 'VARIABLE_ALIAS'
      ) {
        aliasValues++
      }
    }
  }

  return totalValues === 0 ? 0 : aliasValues / totalValues
}

function matchesDimensionPattern(modeNames: string[]): boolean {
  if (modeNames.length < 2) return false
  return modeNames.every((name) => DIMENSION_MODE_PATTERNS.some((p) => p.test(name.trim())))
}

function inferRole(
  collection: LocalVariableCollection,
  aliasRatio: number,
  variableCount: number,
): { role: LayerRole; confidence: number; notes: string[] } {
  const modeCount = collection.modes.length
  const modeNames = collection.modes.map((m) => m.name)
  const notes: string[] = []

  // Dimension detection — mode names match responsive patterns
  if (matchesDimensionPattern(modeNames)) {
    const confidence = modeCount >= 2 ? 0.92 : 0.75
    return { role: 'dimension', confidence, notes }
  }

  // Primitives — single mode, mostly raw values (low alias ratio)
  if (modeCount === 1 && aliasRatio < 0.1) {
    let confidence = 0.9
    if (variableCount < 10) {
      confidence = 0.65
      notes.push(`Only ${variableCount} variables — consider reviewing manually`)
    }
    return { role: 'primitives', confidence, notes }
  }

  // Brand — multiple modes, high alias ratio
  if (modeCount > 1 && aliasRatio > 0.7) {
    const confidence = aliasRatio > 0.85 ? 0.94 : 0.8
    return { role: 'brand', confidence, notes }
  }

  // Semantic — single mode, high alias ratio
  if (modeCount === 1 && aliasRatio > 0.7) {
    const confidence = aliasRatio > 0.85 ? 0.9 : 0.75
    return { role: 'semantic', confidence, notes }
  }

  // Multiple modes, low alias ratio, doesn't match dimension patterns
  if (modeCount > 1 && aliasRatio < 0.3) {
    notes.push('Multiple modes with low alias ratio — could be a themed primitives collection')
    return { role: 'unknown', confidence: 0.4, notes }
  }

  // Fallback — mixed signals
  notes.push('Mixed alias ratio and mode count — review manually')
  return { role: 'unknown', confidence: 0.3, notes }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyzeCollections(response: GetLocalVariablesResponse): AnalysisResult {
  const collections = response.meta.variableCollections
  const variables = response.meta.variables

  const analyses: CollectionAnalysis[] = []

  for (const collection of Object.values(collections)) {
    if (collection.remote) continue

    const localVarCount = collection.variableIds.filter(
      (id) => variables[id] && !variables[id].remote,
    ).length

    const aliasRatio = computeAliasRatio(collection, variables)
    const { role, confidence, notes } = inferRole(collection, aliasRatio, localVarCount)

    analyses.push({
      collectionId: collection.id,
      name: collection.name,
      modeCount: collection.modes.length,
      modeNames: collection.modes.map((m) => m.name),
      variableCount: localVarCount,
      aliasRatio,
      inferredRole: role,
      confidence,
      notes,
    })
  }

  // Build suggested layers — pick the highest-confidence collection for each role
  const suggestedLayers: AnalysisResult['suggestedLayers'] = {}
  const suggestedBrands: string[] = []

  const byRole = (role: LayerRole) =>
    analyses.filter((a) => a.inferredRole === role).sort((a, b) => b.confidence - a.confidence)[0]

  const primitivesCollection = byRole('primitives')
  const brandCollection = byRole('brand')
  const dimensionCollection = byRole('dimension')

  if (primitivesCollection) suggestedLayers.primitives = primitivesCollection.name
  if (brandCollection) {
    suggestedLayers.brand = brandCollection.name
    suggestedBrands.push(...brandCollection.modeNames)
  }
  if (dimensionCollection) suggestedLayers.dimension = dimensionCollection.name

  return { collections: analyses, suggestedLayers, suggestedBrands }
}

// ---------------------------------------------------------------------------
// Console report formatting
// ---------------------------------------------------------------------------

export function formatAnalysisReport(result: AnalysisResult): string {
  const lines: string[] = []

  lines.push('')
  lines.push('Collection Analysis')
  lines.push('─'.repeat(90))

  // Header
  const header = [
    padRight('Collection', 30),
    padRight('Vars', 7),
    padRight('Alias%', 8),
    padRight('Modes', 7),
    padRight('Inferred Role', 16),
    padRight('Conf.', 6),
  ].join('')
  lines.push(header)
  lines.push('─'.repeat(90))

  for (const c of result.collections) {
    const aliasPercent = `${Math.round(c.aliasRatio * 100)}%`
    const modesStr = `${c.modeCount}`
    const confStr = c.confidence.toFixed(2)
    const warning = c.confidence < 0.75 ? ' ⚠' : ''

    const row = [
      padRight(c.name, 30),
      padRight(String(c.variableCount), 7),
      padRight(aliasPercent, 8),
      padRight(modesStr, 7),
      padRight(c.inferredRole, 16),
      padRight(confStr, 6),
    ].join('')

    lines.push(row + warning)
  }

  lines.push('─'.repeat(90))

  // Notes
  const warnings = result.collections.filter((c) => c.notes.length > 0)
  for (const c of warnings) {
    for (const note of c.notes) {
      lines.push(`⚠ "${c.name}" — ${note}`)
    }
  }

  // Suggested config
  if (Object.keys(result.suggestedLayers).length > 0) {
    lines.push('')
    lines.push('Suggested layers config:')
    lines.push('  layers: {')
    if (result.suggestedLayers.primitives) {
      lines.push(`    primitives: '${result.suggestedLayers.primitives}',`)
    }
    if (result.suggestedLayers.brand) {
      lines.push(`    brand: '${result.suggestedLayers.brand}',`)
    }
    if (result.suggestedLayers.dimension) {
      lines.push(`    dimension: '${result.suggestedLayers.dimension}',`)
    }
    lines.push('  }')

    if (result.suggestedBrands.length > 0) {
      lines.push(`  brands: [${result.suggestedBrands.map((b) => `'${b}'`).join(', ')}]`)
    }
  }

  lines.push('')
  return lines.join('\n')
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length)
}
