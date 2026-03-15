/**
 * Detect the format of an imported token file.
 *
 * Supported formats:
 *   - 'tokenhaus': Single file exported by the tokenHaus Figma plugin.
 *     Identified by root-level $extensions.com.figma.modes metadata.
 *   - 'dtcg-per-mode': One-file-per-mode DTCG format (our native format).
 *     Leaf tokens have $type/$value with scalar values.
 *   - 'unknown': Neither pattern matches.
 */

export type ImportFormat = 'tokenhaus' | 'dtcg-per-mode' | 'unknown'

function hasTokenHausMetadata(data: Record<string, unknown>): boolean {
  const ext = data.$extensions
  if (typeof ext !== 'object' || ext === null) return false
  const figma = (ext as Record<string, unknown>)['com.figma']
  if (typeof figma !== 'object' || figma === null) return false
  return 'modes' in figma
}

function hasDtcgLeafTokens(data: Record<string, unknown>): boolean {
  for (const value of Object.values(data)) {
    if (typeof value !== 'object' || value === null) continue
    const obj = value as Record<string, unknown>
    if ('$type' in obj && '$value' in obj) {
      // Check if $value is scalar (not multi-mode object)
      const v = obj.$value
      return typeof v !== 'object' || v === null
    }
    // Recurse one level
    if (hasDtcgLeafTokens(obj)) return true
  }
  return false
}

export function detectFormat(data: Record<string, unknown>): ImportFormat {
  if (hasTokenHausMetadata(data)) return 'tokenhaus'
  if (hasDtcgLeafTokens(data)) return 'dtcg-per-mode'
  return 'unknown'
}
