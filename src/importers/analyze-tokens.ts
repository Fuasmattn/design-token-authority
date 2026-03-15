/**
 * Autodiscovery from converted per-mode token files.
 *
 * Mirrors the heuristics in src/analyze.ts but operates on
 * Record<filename, TokensFile> (the output of convertTokenHausExport)
 * instead of a Figma API response.
 */

import { AnalysisResult, CollectionAnalysis, LayerRole } from '../analyze.js'
import { TokensFile } from '../token_types.js'

// ---------------------------------------------------------------------------
// Heuristic patterns (same as analyze.ts)
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

function matchesDimensionPattern(modeNames: string[]): boolean {
  if (modeNames.length < 2) return false
  return modeNames.every((name) => DIMENSION_MODE_PATTERNS.some((p) => p.test(name.trim())))
}

// ---------------------------------------------------------------------------
// Token tree walking
// ---------------------------------------------------------------------------

interface TokenStats {
  totalTokens: number
  aliasTokens: number
}

function countTokens(obj: Record<string, unknown>, stats: TokenStats): void {
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue
    if (typeof value !== 'object' || value === null) continue

    const v = value as Record<string, unknown>
    if ('$type' in v && '$value' in v) {
      stats.totalTokens++
      if (typeof v.$value === 'string' && v.$value.startsWith('{') && v.$value.endsWith('}')) {
        stats.aliasTokens++
      }
    } else {
      countTokens(v, stats)
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse filenames like "Collection.Mode.json" into collection→modes map,
 * then apply the same heuristics as analyzeCollections.
 */
export function analyzeTokenFiles(tokenFiles: Record<string, TokensFile>): AnalysisResult {
  // Group by collection name: { collectionName: { modeName: TokensFile } }
  const collections = new Map<string, Map<string, TokensFile>>()

  for (const [fileName, content] of Object.entries(tokenFiles)) {
    const base = fileName.replace(/\.json$/, '')
    const dotIdx = base.indexOf('.')
    if (dotIdx === -1) continue

    const collectionName = base.substring(0, dotIdx)
    const modeName = base.substring(dotIdx + 1)

    if (!collections.has(collectionName)) {
      collections.set(collectionName, new Map())
    }
    collections.get(collectionName)!.set(modeName, content)
  }

  const analyses: CollectionAnalysis[] = []

  for (const [collectionName, modes] of collections) {
    const modeNames = [...modes.keys()]
    const modeCount = modeNames.length

    // Count tokens and aliases across all modes
    const stats: TokenStats = { totalTokens: 0, aliasTokens: 0 }
    for (const content of modes.values()) {
      countTokens(content as Record<string, unknown>, stats)
    }

    const aliasRatio = stats.totalTokens === 0 ? 0 : stats.aliasTokens / stats.totalTokens
    const variableCount = stats.totalTokens // approximate — counts across modes

    // Infer role using same heuristics as analyze.ts
    let role: LayerRole = 'unknown'
    let confidence = 0.3
    const notes: string[] = []

    if (matchesDimensionPattern(modeNames)) {
      role = 'dimension'
      confidence = modeCount >= 2 ? 0.92 : 0.75
    } else if (modeCount === 1 && aliasRatio < 0.1) {
      role = 'primitives'
      confidence = 0.9
      if (variableCount < 10) {
        confidence = 0.65
        notes.push(`Only ${variableCount} variables — consider reviewing manually`)
      }
    } else if (modeCount > 1 && aliasRatio > 0.7) {
      role = 'brand'
      confidence = aliasRatio > 0.85 ? 0.94 : 0.8
    } else if (modeCount === 1 && aliasRatio > 0.7) {
      role = 'semantic'
      confidence = aliasRatio > 0.85 ? 0.9 : 0.75
    } else if (modeCount > 1 && aliasRatio < 0.3) {
      notes.push('Multiple modes with low alias ratio — could be a themed primitives collection')
      confidence = 0.4
    } else {
      notes.push('Mixed alias ratio and mode count — review manually')
    }

    analyses.push({
      collectionId: collectionName,
      name: collectionName,
      modeCount,
      modeNames,
      variableCount,
      aliasRatio,
      inferredRole: role,
      confidence,
      notes,
    })
  }

  // Build suggested layers
  const suggestedLayers: AnalysisResult['suggestedLayers'] = {}
  const suggestedBrands: string[] = []

  const byRole = (r: LayerRole) =>
    analyses.filter((a) => a.inferredRole === r).sort((a, b) => b.confidence - a.confidence)[0]

  const primitivesCollection = byRole('primitives')
  const brandCollection = byRole('brand')
  const dimensionCollection = byRole('dimension')

  if (primitivesCollection) suggestedLayers.primitives = primitivesCollection.name
  if (brandCollection) {
    suggestedLayers.brand = brandCollection.name
    suggestedBrands.push(...brandCollection.modeNames)
  }
  if (dimensionCollection) suggestedLayers.dimension = dimensionCollection.name

  const suggestedCollections = analyses.map((a) => a.name)

  return { collections: analyses, suggestedCollections, suggestedLayers, suggestedBrands }
}
