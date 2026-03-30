/**
 * Token documentation HTML generator.
 *
 * Reads raw token JSON files and generates a self-contained HTML page with:
 *   - Color swatches grouped by collection and category
 *   - Typography previews (font family, size, weight, line height)
 *   - Spacing scale with visual bars
 *   - Effects previews (blur, opacity)
 *   - Searchable all-tokens table
 *   - Full alias chain display on brand color swatches
 *   - Brand switcher for comparing brand-specific semantic tokens
 *
 * Works with any token file structure — auto-discovers collections and modes
 * from filenames ({Collection}.{Mode}.json).
 */

import fs from 'node:fs'
import path from 'node:path'

interface TokenValue {
  $type: string
  $value: string | number
  $description?: string
  $extensions?: { 'com.figma'?: { hiddenFromPublishing?: boolean; scopes?: string[] } }
}

interface TokenGroup {
  [key: string]: TokenValue | TokenGroup
}

/**
 * Recursively extract leaf tokens from a token group, returning [path, token] pairs.
 */
function extractTokens(obj: TokenGroup, prefix: string[] = []): Array<[string[], TokenValue]> {
  const result: Array<[string[], TokenValue]> = []
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue
    if (value && typeof value === 'object' && '$value' in value) {
      result.push([[...prefix, key], value as TokenValue])
    } else if (value && typeof value === 'object') {
      result.push(...extractTokens(value as TokenGroup, [...prefix, key]))
    }
  }
  return result
}

/**
 * Resolve an alias reference like {path.to.token} to its final value
 * by walking all loaded token data.
 */
function resolveAlias(
  ref: string,
  allData: Record<string, TokenGroup>,
  visited: Set<string> = new Set(),
): string | null {
  if (visited.has(ref)) return null // circular reference
  visited.add(ref)

  const refPath = ref.replace(/^\{|\}$/g, '').split('.')
  for (const data of Object.values(allData)) {
    let current: unknown = data
    for (const segment of refPath) {
      if (
        current &&
        typeof current === 'object' &&
        segment in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[segment]
      } else {
        current = undefined
        break
      }
    }
    if (
      current &&
      typeof current === 'object' &&
      '$value' in (current as Record<string, unknown>)
    ) {
      const val = (current as TokenValue).$value
      if (typeof val === 'string' && val.startsWith('{')) {
        return resolveAlias(val, allData, visited)
      }
      return String(val)
    }
  }
  return null
}

/**
 * Build the full alias resolution chain for a token value.
 * Returns an array of steps, e.g. ["{Colors.Brand.Primary}", "{Colors.Foundation.Blue.700}", "#003f8a"]
 */
function buildAliasChain(
  value: string | number,
  allData: Record<string, TokenGroup>,
): string[] {
  const chain: string[] = []
  let current = value
  const visited = new Set<string>()

  while (typeof current === 'string' && current.startsWith('{')) {
    if (visited.has(current)) break
    visited.add(current)
    chain.push(current.replace(/^\{|\}$/g, ''))

    const refPath = current.replace(/^\{|\}$/g, '').split('.')
    let found = false
    for (const data of Object.values(allData)) {
      let node: unknown = data
      for (const segment of refPath) {
        if (node && typeof node === 'object' && segment in (node as Record<string, unknown>)) {
          node = (node as Record<string, unknown>)[segment]
        } else {
          node = undefined
          break
        }
      }
      if (node && typeof node === 'object' && '$value' in (node as Record<string, unknown>)) {
        current = (node as TokenValue).$value
        found = true
        break
      }
    }
    if (!found) break
  }

  chain.push(String(current))
  return chain
}

/**
 * Discover collections and modes from token filenames.
 */
function discoverFiles(tokensDir: string): Map<string, string[]> {
  const collections = new Map<string, string[]>()
  for (const f of fs.readdirSync(tokensDir)) {
    if (!f.endsWith('.json')) continue
    const base = f.replace(/\.json$/, '')
    const dotIdx = base.indexOf('.')
    if (dotIdx === -1) continue
    const collectionName = base.substring(0, dotIdx)
    const modeName = base.substring(dotIdx + 1)
    if (!collections.has(collectionName)) collections.set(collectionName, [])
    collections.get(collectionName)!.push(modeName)
  }
  return collections
}

/**
 * Generate the token documentation HTML page.
 */
export function generateDocsHtml(tokensDir: string, brands: string[]): string {
  // Load all token files
  const files = fs.readdirSync(tokensDir).filter((f) => f.endsWith('.json'))
  const allData: Record<string, TokenGroup> = {}
  for (const file of files) {
    allData[file] = JSON.parse(fs.readFileSync(path.join(tokensDir, file), 'utf-8'))
  }

  // Discover collections and classify into single-mode vs multi-mode
  const collections = discoverFiles(tokensDir)
  const singleModeCollections: string[] = []
  const multiModeCollections = new Map<string, string[]>()
  for (const [name, modes] of collections) {
    if (modes.length === 1) {
      singleModeCollections.push(name)
    } else {
      multiModeCollections.set(name, modes)
    }
  }

  // Extract color tokens from single-mode collections (base/shared colors)
  const baseColorTokens: Array<{
    collection: string
    segments: string[]
    name: string
    value: string
  }> = []
  for (const collName of singleModeCollections) {
    const modes = collections.get(collName)!
    const fileName = `${collName}.${modes[0]}.json`
    const data = allData[fileName]
    if (!data) continue
    const tokens = extractTokens(data)
    for (const [tokenPath, token] of tokens) {
      if (token.$type !== 'color') continue
      const value =
        typeof token.$value === 'string' && token.$value.startsWith('{')
          ? (resolveAlias(token.$value, allData) ?? String(token.$value))
          : String(token.$value)
      baseColorTokens.push({
        collection: collName,
        segments: tokenPath,
        name: tokenPath[tokenPath.length - 1],
        value,
      })
    }
  }

  // Extract color tokens from multi-mode collections (brand/theme colors)
  const brandModes =
    brands.length > 0
      ? brands
      : multiModeCollections.size > 0
        ? [...multiModeCollections.values()][0]
        : []

  const brandColorTokens: Record<
    string,
    Array<{
      collection: string
      segments: string[]
      name: string
      value: string
      alias: string
      chain: string[]
    }>
  > = {}
  for (const brand of brandModes) {
    brandColorTokens[brand] = []
    for (const [collName, modes] of multiModeCollections) {
      if (!modes.includes(brand)) continue
      const fileName = `${collName}.${brand}.json`
      const data = allData[fileName]
      if (!data) continue
      const tokens = extractTokens(data)
      for (const [tokenPath, token] of tokens) {
        if (token.$type !== 'color') continue
        const alias = String(token.$value)
        const resolved =
          typeof token.$value === 'string' && token.$value.startsWith('{')
            ? (resolveAlias(token.$value, allData) ?? alias)
            : alias
        const chain = buildAliasChain(token.$value, allData)
        brandColorTokens[brand].push({
          collection: collName,
          segments: tokenPath,
          name: tokenPath[tokenPath.length - 1],
          value: resolved,
          alias,
          chain,
        })
      }
    }
  }

  // Extract typography tokens from all single-mode collections
  const typographyData: Record<string, Array<[string, string]>> = {}

  // Scopes that indicate typography tokens (exclude from spacing/effects)
  const TYPO_SCOPES = new Set([
    'FONT_SIZE',
    'FONT_WEIGHT',
    'FONT_FAMILY',
    'LINE_HEIGHT',
    'LETTER_SPACING',
    'PARAGRAPH_SPACING',
    'PARAGRAPH_INDENT',
  ])

  // Scopes that indicate spacing tokens
  const SPACING_SCOPES = new Set(['GAP', 'WIDTH_HEIGHT'])

  // Extract spacing tokens
  const spacingTokens: Array<{ name: string; value: number }> = []

  // Extract effects tokens
  const effectsData: { blur: Array<[string, number]>; opacity: Array<[string, number]> } = {
    blur: [],
    opacity: [],
  }

  // Extract all tokens for the table
  const allTokensList: Array<{
    path: string
    type: string
    value: string
    collection: string
  }> = []

  for (const collName of singleModeCollections) {
    const modes = collections.get(collName)!
    const fileName = `${collName}.${modes[0]}.json`
    const data = allData[fileName]
    if (!data) continue
    const tokens = extractTokens(data)
    for (const [tokenPath, token] of tokens) {
      const scopes: string[] =
        (token.$extensions?.['com.figma']?.scopes as string[] | undefined) ?? []

      // All tokens table
      const resolvedValue =
        typeof token.$value === 'string' && token.$value.startsWith('{')
          ? (resolveAlias(token.$value, allData) ?? String(token.$value))
          : String(token.$value)
      allTokensList.push({
        path: tokenPath.join('.'),
        type: token.$type,
        value: resolvedValue,
        collection: collName,
      })

      // Typography
      if (token.$type === 'number' || token.$type === 'string') {
        let typoCategory: string | null = null
        if (scopes.includes('FONT_SIZE')) typoCategory = 'font-size'
        else if (scopes.includes('FONT_WEIGHT')) typoCategory = 'font-weight'
        else if (scopes.includes('FONT_FAMILY')) typoCategory = 'font-family'
        else if (scopes.includes('LINE_HEIGHT')) typoCategory = 'line-height'
        if (typoCategory) {
          if (!typographyData[typoCategory]) typographyData[typoCategory] = []
          typographyData[typoCategory].push([tokenPath.join('.'), String(token.$value)])
          continue
        }
      }

      // Spacing: number tokens with GAP or WIDTH_HEIGHT scopes, but NOT typography scopes
      if (token.$type === 'number') {
        const hasTypoScope = scopes.some((s) => TYPO_SCOPES.has(s))
        const hasSpacingScope = scopes.some((s) => SPACING_SCOPES.has(s))

        if (!hasTypoScope && hasSpacingScope) {
          const val =
            typeof token.$value === 'string' && token.$value.startsWith('{')
              ? Number(resolveAlias(token.$value, allData) ?? 0)
              : Number(token.$value)
          if (!isNaN(val)) {
            spacingTokens.push({ name: tokenPath.join('.'), value: val })
          }
        }

        // Effects: blur (EFFECT_FLOAT) and opacity (OPACITY)
        if (scopes.includes('EFFECT_FLOAT')) {
          const val = Number(token.$value)
          if (!isNaN(val)) {
            effectsData.blur.push([tokenPath.join('.'), val])
          }
        }
        if (scopes.includes('OPACITY')) {
          const val = Number(token.$value)
          if (!isNaN(val)) {
            effectsData.opacity.push([tokenPath.join('.'), val])
          }
        }
      }
    }
  }

  // Also collect tokens from multi-mode collections for the all-tokens table
  for (const [collName, modes] of multiModeCollections) {
    for (const mode of modes) {
      const fileName = `${collName}.${mode}.json`
      const data = allData[fileName]
      if (!data) continue
      const tokens = extractTokens(data)
      for (const [tokenPath, token] of tokens) {
        const resolvedValue =
          typeof token.$value === 'string' && token.$value.startsWith('{')
            ? (resolveAlias(token.$value, allData) ?? String(token.$value))
            : String(token.$value)
        allTokensList.push({
          path: tokenPath.join('.'),
          type: token.$type,
          value: resolvedValue,
          collection: `${collName} (${mode})`,
        })
      }
    }
  }

  // Sort spacing tokens by value
  spacingTokens.sort((a, b) => a.value - b.value)
  effectsData.blur.sort((a, b) => a[1] - b[1])
  effectsData.opacity.sort((a, b) => a[1] - b[1])

  // Serialize data for JS
  const jsData = JSON.stringify({
    brands: brandModes,
    baseColorTokens,
    brandColorTokens,
    typography: typographyData,
    spacing: spacingTokens,
    effects: effectsData,
    allTokens: allTokensList,
  })

  return `<!DOCTYPE html>
<html lang="en" data-brand="${brandModes[0]?.toLowerCase() ?? ''}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design Token Reference</title>
<style>
  :root {
    --bg: #161618;
    --bg-gradient: linear-gradient(135deg, #161618 0%, #1c1c1e 50%, #222224 100%);
    --surface: rgba(255, 255, 255, 0.08);
    --surface-hover: rgba(255, 255, 255, 0.12);
    --glass: rgba(255, 255, 255, 0.06);
    --glass-border: rgba(255, 255, 255, 0.12);
    --glass-highlight: rgba(255, 255, 255, 0.18);
    --glass-shadow: rgba(0, 0, 0, 0.25);
    --border: rgba(255, 255, 255, 0.1);
    --text: rgba(255, 255, 255, 0.92);
    --text-secondary: rgba(255, 255, 255, 0.55);
    --text-tertiary: rgba(255, 255, 255, 0.35);
    --accent: rgba(255, 255, 255, 0.72);
    --accent-glow: rgba(255, 255, 255, 0.15);
    --accent-subtle: rgba(255, 255, 255, 0.08);
    --radius: 16px;
    --radius-sm: 12px;
    --font: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--font);
    background: var(--bg);
    background-image: var(--bg-gradient);
    background-attachment: fixed;
    color: var(--text);
    line-height: 1.5;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px 40px;
  }

  /* Header */
  .header {
    border-bottom: 1px solid var(--border);
    padding: 14px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(30px) saturate(150%);
    -webkit-backdrop-filter: blur(30px) saturate(150%);
    margin-bottom: 40px;
    flex-wrap: wrap;
  }

  .header .logo {
    font-family: var(--font-mono);
    color: var(--accent);
    font-size: 13px;
    background: var(--accent-subtle);
    padding: 4px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.15);
    font-weight: 600;
    flex-shrink: 0;
  }

  .header h1 {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.3px;
  }

  .header .subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin-left: auto;
  }

  /* Brand dropdown */
  .brand-select-wrap {
    position: relative;
    margin-left: auto;
  }

  .brand-select {
    appearance: none;
    -webkit-appearance: none;
    background: var(--glass);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--glass-border);
    border-radius: 10px;
    padding: 7px 32px 7px 14px;
    color: var(--text);
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    outline: none;
    transition: border-color 0.2s;
    box-shadow: inset 0 1px 0 0 var(--glass-highlight);
  }

  .brand-select:hover { border-color: rgba(255,255,255,0.22); }
  .brand-select:focus { border-color: var(--accent); }

  .brand-select option {
    background: #161618;
    color: rgba(255,255,255,0.92);
  }

  /* Chevron */
  .brand-select-wrap::after {
    content: '';
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid var(--text-secondary);
    pointer-events: none;
  }

  section { margin-bottom: 48px; }

  section h2 {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-bottom: 6px;
  }

  section h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 24px 0 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .section-desc {
    color: var(--text-secondary);
    font-size: 13px;
    margin-bottom: 20px;
  }

  /* Color swatches */
  .swatch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 10px;
  }

  .swatch {
    background: var(--glass);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    transition: all 0.2s ease;
    cursor: pointer;
    position: relative;
    box-shadow: inset 0 1px 0 0 var(--glass-highlight), 0 2px 12px var(--glass-shadow);
  }

  .swatch:hover {
    border-color: var(--accent);
    box-shadow: inset 0 1px 0 0 var(--glass-highlight), 0 4px 20px var(--glass-shadow), 0 0 0 1px var(--accent-glow);
    transform: translateY(-2px);
  }

  .swatch-color {
    height: 68px;
    width: 100%;
    border-bottom: 1px solid var(--glass-border);
    position: relative;
  }

  /* Copy icon overlay on hover */
  .swatch-color::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.35);
    opacity: 0;
    transition: opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .swatch:hover .swatch-color::after { opacity: 1; }

  .copy-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 22px;
    height: 22px;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 2;
    pointer-events: none;
  }
  .swatch:hover .copy-icon { opacity: 1; }

  .swatch-info {
    padding: 8px 10px;
  }

  .swatch-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .swatch-value {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .swatch-alias {
    font-size: 10px;
    color: var(--text-tertiary);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Alias chain popover */
  .alias-chain {
    margin-top: 6px;
    padding: 6px 8px;
    background: rgba(0,0,0,0.3);
    border-radius: 6px;
    font-size: 10px;
    font-family: var(--font-mono);
    line-height: 1.6;
    display: none;
  }

  .alias-chain.show { display: block; }

  .alias-chain-step {
    color: var(--text-secondary);
  }

  .alias-chain-arrow {
    color: var(--text-tertiary);
    margin: 0 2px;
  }

  .alias-chain-final {
    color: var(--text);
    font-weight: 600;
  }

  /* Toast notification */
  .toast {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%) translateY(80px);
    background: var(--glass);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--accent);
    color: var(--text);
    padding: 10px 20px;
    border-radius: 12px;
    font-size: 13px;
    font-family: var(--font-mono);
    z-index: 1000;
    box-shadow: 0 4px 24px var(--glass-shadow), 0 0 12px var(--accent-glow);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }
  .toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  /* Typography previews */
  .type-grid {
    display: grid;
    gap: 10px;
  }

  .type-card {
    background: var(--glass);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius);
    padding: 20px 24px;
    box-shadow: inset 0 1px 0 0 var(--glass-highlight), 0 2px 12px var(--glass-shadow);
    transition: all 0.2s ease;
  }

  .type-card:hover {
    border-color: rgba(255,255,255,0.18);
    transform: translateY(-1px);
  }

  .type-preview {
    font-size: 24px;
    margin-bottom: 12px;
    line-height: 1.3;
  }

  .type-meta {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .type-meta span {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    background: var(--surface);
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  /* Font size scale */
  .font-size-scale {
    display: grid;
    gap: 8px;
  }

  .font-size-row {
    display: flex;
    align-items: baseline;
    gap: 16px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }

  .font-size-row:last-child { border-bottom: none; }

  .font-size-label {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    min-width: 90px;
    flex-shrink: 0;
  }

  .font-size-sample {
    line-height: 1.2;
    color: var(--text);
  }

  .font-size-value {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-tertiary);
    margin-left: auto;
    flex-shrink: 0;
  }

  /* Spacing scale */
  .spacing-scale {
    display: grid;
    gap: 6px;
  }

  .spacing-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }

  .spacing-row:last-child { border-bottom: none; }

  .spacing-label {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    min-width: 180px;
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .spacing-bar-wrap {
    flex: 1;
    height: 20px;
    position: relative;
  }

  .spacing-bar {
    height: 100%;
    background: linear-gradient(90deg, rgba(120,180,255,0.5), rgba(120,180,255,0.25));
    border-radius: 4px;
    min-width: 2px;
    transition: width 0.3s ease;
  }

  .spacing-val {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-tertiary);
    min-width: 50px;
    text-align: right;
    flex-shrink: 0;
  }

  /* Effects */
  .effects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }

  .effect-card {
    background: var(--glass);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    padding: 16px;
    text-align: center;
    transition: all 0.2s ease;
  }

  .effect-card:hover {
    border-color: rgba(255,255,255,0.18);
    transform: translateY(-1px);
  }

  .blur-preview {
    width: 60px;
    height: 60px;
    margin: 0 auto 10px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7);
  }

  .opacity-preview {
    width: 60px;
    height: 60px;
    margin: 0 auto 10px;
    border-radius: 8px;
    background: #6366f1;
  }

  .effect-name {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    margin-bottom: 2px;
  }

  .effect-value {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text);
    font-weight: 600;
  }

  /* All tokens table */
  .tokens-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius);
    background: var(--glass);
  }

  .tokens-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .tokens-table th {
    text-align: left;
    padding: 10px 14px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: rgba(22,22,24,0.95);
    backdrop-filter: blur(10px);
  }

  .tokens-table td {
    padding: 8px 14px;
    border-bottom: 1px solid var(--border);
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }

  .tokens-table tr:hover td {
    background: var(--surface);
    color: var(--text);
  }

  .tokens-table .td-path { color: var(--text); font-weight: 500; }

  .tokens-table .type-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    background: var(--surface);
    border: 1px solid var(--border);
  }

  .color-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    vertical-align: middle;
    margin-right: 6px;
    border: 1px solid rgba(255,255,255,0.15);
  }

  .table-count {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-bottom: 12px;
  }

  /* Search */
  .search-box {
    width: 100%;
    max-width: 400px;
    padding: 10px 16px;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    background: var(--glass);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    margin-bottom: 24px;
    box-shadow: inset 0 1px 0 0 var(--glass-highlight);
  }

  .search-box:focus {
    border-color: var(--accent);
    box-shadow: inset 0 1px 0 0 var(--glass-highlight), 0 0 0 2px var(--accent-glow);
  }

  .search-box::placeholder { color: var(--text-tertiary); }

  footer {
    text-align: center;
    color: var(--text-tertiary);
    font-size: 12px;
    padding: 24px;
    border-top: 1px solid var(--border);
    margin-top: 48px;
  }

  .hidden { display: none !important; }

  /* Tab navigation */
  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 32px;
    background: var(--glass);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-radius: 10px;
    padding: 3px;
    border: 1px solid var(--glass-border);
    width: fit-content;
    flex-wrap: wrap;
  }

  .tab-btn {
    padding: 7px 18px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab-btn:hover { color: var(--text); background: var(--surface); }
  .tab-btn.active {
    background: var(--surface-hover);
    color: var(--text);
    box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.08);
  }
</style>
</head>
<body>
<div class="header">
  <span class="logo">dta</span>
  <h1>Design Token Authority</h1>
  <span class="subtitle">Token Reference</span>
  <div class="brand-select-wrap" id="brand-switcher"></div>
</div>

<div class="container">
  <input type="text" class="search-box" id="search" placeholder="Search tokens...">

  <div class="tabs" id="tabs">
    <button class="tab-btn active" data-tab="base">Base Colors</button>
    <button class="tab-btn" data-tab="brand">Brand Colors</button>
    <button class="tab-btn" data-tab="typography">Typography</button>
    <button class="tab-btn" data-tab="spacing">Spacing</button>
    <button class="tab-btn" data-tab="effects">Effects</button>
    <button class="tab-btn" data-tab="all">All Tokens</button>
  </div>

  <section id="section-base">
    <h2>Base Colors</h2>
    <p class="section-desc">Color tokens from single-mode collections. Click to copy the hex value.</p>
    <div id="base-colors"></div>
  </section>

  <section id="section-brand" class="hidden">
    <h2>Brand Colors</h2>
    <p class="section-desc">Color tokens from multi-mode collections. Click a swatch to see its alias chain.</p>
    <div id="brand-colors"></div>
  </section>

  <section id="section-typography" class="hidden">
    <h2>Typography</h2>
    <p class="section-desc">Font sizes, weights, and families detected from token scopes.</p>
    <div id="typography"></div>
  </section>

  <section id="section-spacing" class="hidden">
    <h2>Spacing</h2>
    <p class="section-desc">Spacing scale tokens. Bar width is proportional to the token value.</p>
    <div id="spacing"></div>
  </section>

  <section id="section-effects" class="hidden">
    <h2>Effects</h2>
    <p class="section-desc">Blur and opacity tokens with live previews.</p>
    <div id="effects"></div>
  </section>

  <section id="section-all" class="hidden">
    <h2>All Tokens</h2>
    <p class="section-desc">Every token across all collections. Use the search box to filter.</p>
    <div id="table-count" class="table-count"></div>
    <div id="all-tokens"></div>
  </section>
</div>

<footer>
  Generated by <strong>Design Token Authority</strong> &middot; <span id="gen-date"></span>
</footer>

<div class="toast" id="toast"></div>

<script>
const DATA = ${jsData};
const TAB_IDS = ['base', 'brand', 'typography', 'spacing', 'effects', 'all'];

// ---- Brand switcher (dropdown) ----
const switcherEl = document.getElementById('brand-switcher');
if (DATA.brands.length > 0) {
  const select = document.createElement('select');
  select.className = 'brand-select';
  DATA.brands.forEach(brand => {
    const opt = document.createElement('option');
    opt.value = brand;
    opt.textContent = brand;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    const brand = select.value;
    document.documentElement.setAttribute('data-brand', brand.toLowerCase());
    renderBrandColors(brand);
  });
  switcherEl.appendChild(select);
}

// ---- Tabs ----
const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.getAttribute('data-tab');
    TAB_IDS.forEach(id => {
      document.getElementById('section-' + id).classList.toggle('hidden', tab !== id);
    });
  });
});

/**
 * Group tokens by collection, then dynamically by all-but-last path segments.
 */
function groupTokens(tokens, filterLower) {
  const byCollection = {};
  for (const t of tokens) {
    const fullPath = t.segments.join('.');
    const matchesFilter = !filterLower ||
      fullPath.toLowerCase().includes(filterLower) ||
      t.value.toLowerCase().includes(filterLower) ||
      (t.alias || '').toLowerCase().includes(filterLower);
    if (!matchesFilter) continue;

    if (!byCollection[t.collection]) byCollection[t.collection] = {};
    const groupSegments = t.segments.slice(0, -1);
    const groupKey = groupSegments.length > 0 ? groupSegments.join(' / ') : '_root';
    if (!byCollection[t.collection][groupKey]) byCollection[t.collection][groupKey] = [];
    byCollection[t.collection][groupKey].push(t);
  }
  return byCollection;
}

// ---- Render base colors ----
function renderBaseColors(filter) {
  const container = document.getElementById('base-colors');
  container.innerHTML = '';
  const filterLower = (filter || '').toLowerCase();
  const grouped = groupTokens(DATA.baseColorTokens, filterLower);

  for (const [collection, groups] of Object.entries(grouped)) {
    const collH2 = document.createElement('h3');
    collH2.textContent = collection;
    collH2.style.cssText = 'font-size:15px;margin-top:32px;margin-bottom:4px;color:var(--text);text-transform:none;letter-spacing:0';
    container.appendChild(collH2);

    for (const [groupPath, tokens] of Object.entries(groups)) {
      if (groupPath !== '_root') {
        const h4 = document.createElement('h3');
        h4.textContent = groupPath;
        container.appendChild(h4);
      }

      const grid = document.createElement('div');
      grid.className = 'swatch-grid';
      for (const token of tokens) {
        grid.appendChild(createSwatch(token.segments.join('.'), token.value));
      }
      container.appendChild(grid);
    }
  }

  if (container.children.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary)">No base color tokens found.</p>';
  }
}

// ---- Render brand colors ----
function renderBrandColors(brand, filter) {
  const container = document.getElementById('brand-colors');
  container.innerHTML = '';
  const tokens = DATA.brandColorTokens[brand];
  if (!tokens || tokens.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary)">No brand color data found.</p>';
    return;
  }
  const filterLower = (filter || '').toLowerCase();
  const grouped = groupTokens(tokens, filterLower);

  for (const [collection, groups] of Object.entries(grouped)) {
    const collH2 = document.createElement('h3');
    collH2.textContent = collection;
    collH2.style.cssText = 'font-size:15px;margin-top:32px;margin-bottom:4px;color:var(--text);text-transform:none;letter-spacing:0';
    container.appendChild(collH2);

    for (const [groupPath, tokens] of Object.entries(groups)) {
      if (groupPath !== '_root') {
        const h4 = document.createElement('h3');
        h4.textContent = groupPath;
        container.appendChild(h4);
      }

      const grid = document.createElement('div');
      grid.className = 'swatch-grid';
      for (const token of tokens) {
        grid.appendChild(createSwatch(token.segments.join('.'), token.value, token.alias, token.chain));
      }
      container.appendChild(grid);
    }
  }
}

// ---- Toast ----
let toastTimeout;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ---- Create swatch element ----
function createSwatch(tokenPath, value, alias, chain) {
  const swatch = document.createElement('div');
  swatch.className = 'swatch';
  swatch.title = tokenPath;

  const colorDiv = document.createElement('div');
  colorDiv.className = 'swatch-color';
  colorDiv.style.background = value;

  if (isLightColor(value)) {
    colorDiv.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.08)';
  }

  const copyIcon = document.createElement('div');
  copyIcon.className = 'copy-icon';
  copyIcon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  colorDiv.appendChild(copyIcon);

  const info = document.createElement('div');
  info.className = 'swatch-info';

  const name = document.createElement('div');
  name.className = 'swatch-name';
  const parts = tokenPath.split('.');
  name.textContent = parts.slice(-2).join('.');

  const val = document.createElement('div');
  val.className = 'swatch-value';
  val.textContent = value;

  info.appendChild(name);
  info.appendChild(val);

  if (alias && alias.startsWith('{')) {
    const aliasEl = document.createElement('div');
    aliasEl.className = 'swatch-alias';
    aliasEl.textContent = alias.replace(/[{}]/g, '');
    aliasEl.title = alias;
    info.appendChild(aliasEl);
  }

  // Alias chain (expandable)
  if (chain && chain.length > 1) {
    const chainEl = document.createElement('div');
    chainEl.className = 'alias-chain';
    const chainHtml = chain.map((step, i) => {
      if (i === chain.length - 1) {
        return '<span class="alias-chain-final">' + escapeHtml(step) + '</span>';
      }
      return '<span class="alias-chain-step">' + escapeHtml(step) + '</span>';
    }).join('<span class="alias-chain-arrow"> &rarr; </span>');
    chainEl.innerHTML = chainHtml;
    info.appendChild(chainEl);
  }

  swatch.appendChild(colorDiv);
  swatch.appendChild(info);

  swatch.addEventListener('click', (e) => {
    // Toggle alias chain if it exists
    const chainEl = swatch.querySelector('.alias-chain');
    if (chainEl) {
      chainEl.classList.toggle('show');
    }
    navigator.clipboard.writeText(value).then(() => {
      showToast('Copied ' + value);
    });
  });

  return swatch;
}

function isLightColor(hex) {
  if (!hex || !hex.startsWith('#')) return false;
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

// ---- Render typography ----
function renderTypography() {
  const container = document.getElementById('typography');
  container.innerHTML = '';
  const typo = DATA.typography;

  if (Object.keys(typo).length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary)">No typography tokens found (tokens need FONT_SIZE, FONT_WEIGHT, or FONT_FAMILY scopes).</p>';
    return;
  }

  if (typo['font-family']) {
    const h3 = document.createElement('h3');
    h3.textContent = 'Font Families';
    container.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'type-grid';
    for (const [name, value] of typo['font-family']) {
      const card = document.createElement('div');
      card.className = 'type-card';
      card.innerHTML =
        '<div class="type-preview" style="font-family: \\'' + escapeHtml(value) + '\\', sans-serif">' +
        escapeHtml(value) + ' — The quick brown fox jumps over the lazy dog</div>' +
        '<div class="type-meta"><span>' + escapeHtml(name) + '</span>' +
        '<span>font-family: ' + escapeHtml(value) + '</span></div>';
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }

  if (typo['font-size']) {
    const h3 = document.createElement('h3');
    h3.textContent = 'Font Sizes';
    container.appendChild(h3);

    const card = document.createElement('div');
    card.className = 'type-card';
    const scale = document.createElement('div');
    scale.className = 'font-size-scale';

    for (const [name, value] of typo['font-size']) {
      const row = document.createElement('div');
      row.className = 'font-size-row';
      row.innerHTML =
        '<span class="font-size-label">' + escapeHtml(name) + '</span>' +
        '<span class="font-size-sample" style="font-size: ' + escapeHtml(value) + 'px">The quick brown fox</span>' +
        '<span class="font-size-value">' + escapeHtml(value) + 'px</span>';
      scale.appendChild(row);
    }
    card.appendChild(scale);
    container.appendChild(card);
  }

  if (typo['font-weight']) {
    const h3 = document.createElement('h3');
    h3.textContent = 'Font Weights';
    container.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'type-grid';
    for (const [name, value] of typo['font-weight']) {
      const card = document.createElement('div');
      card.className = 'type-card';
      card.innerHTML =
        '<div class="type-preview" style="font-weight: ' + escapeHtml(value) + '">' +
        escapeHtml(value) + '</div>' +
        '<div class="type-meta"><span>' + escapeHtml(name) + '</span></div>';
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }
}

// ---- Render spacing ----
function renderSpacing() {
  const container = document.getElementById('spacing');
  container.innerHTML = '';
  const tokens = DATA.spacing;

  if (!tokens || tokens.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary)">No spacing tokens found.</p>';
    return;
  }

  const maxVal = Math.max(...tokens.map(t => t.value), 1);
  const card = document.createElement('div');
  card.className = 'type-card';
  const scale = document.createElement('div');
  scale.className = 'spacing-scale';

  for (const token of tokens) {
    const row = document.createElement('div');
    row.className = 'spacing-row';
    const pct = Math.min((token.value / maxVal) * 100, 100);
    row.innerHTML =
      '<span class="spacing-label" title="' + escapeHtml(token.name) + '">' + escapeHtml(token.name.split('.').slice(-2).join('.')) + '</span>' +
      '<div class="spacing-bar-wrap"><div class="spacing-bar" style="width: ' + pct + '%"></div></div>' +
      '<span class="spacing-val">' + token.value + 'px</span>';
    scale.appendChild(row);
  }

  card.appendChild(scale);
  container.appendChild(card);
}

// ---- Render effects ----
function renderEffects() {
  const container = document.getElementById('effects');
  container.innerHTML = '';
  const fx = DATA.effects;

  if ((!fx.blur || fx.blur.length === 0) && (!fx.opacity || fx.opacity.length === 0)) {
    container.innerHTML = '<p style="color: var(--text-secondary)">No effects tokens found.</p>';
    return;
  }

  if (fx.blur && fx.blur.length > 0) {
    const h3 = document.createElement('h3');
    h3.textContent = 'Blur';
    container.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'effects-grid';
    for (const [name, value] of fx.blur) {
      const card = document.createElement('div');
      card.className = 'effect-card';
      const shortName = name.split('.').slice(-1)[0];
      card.innerHTML =
        '<div class="blur-preview" style="filter: blur(' + value + 'px)"></div>' +
        '<div class="effect-name">' + escapeHtml(shortName) + '</div>' +
        '<div class="effect-value">' + value + 'px</div>';
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }

  if (fx.opacity && fx.opacity.length > 0) {
    const h3 = document.createElement('h3');
    h3.textContent = 'Opacity';
    container.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'effects-grid';
    for (const [name, value] of fx.opacity) {
      const card = document.createElement('div');
      card.className = 'effect-card';
      const shortName = name.split('.').slice(-1)[0];
      const cssOpacity = value / 100;
      card.innerHTML =
        '<div class="opacity-preview" style="opacity: ' + cssOpacity + '"></div>' +
        '<div class="effect-name">' + escapeHtml(shortName) + '</div>' +
        '<div class="effect-value">' + value + '%</div>';
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }
}

// ---- Render all tokens table ----
function renderAllTokens(filter) {
  const container = document.getElementById('all-tokens');
  const countEl = document.getElementById('table-count');
  container.innerHTML = '';
  const filterLower = (filter || '').toLowerCase();

  const filtered = filterLower
    ? DATA.allTokens.filter(t =>
        t.path.toLowerCase().includes(filterLower) ||
        t.type.toLowerCase().includes(filterLower) ||
        t.value.toLowerCase().includes(filterLower) ||
        t.collection.toLowerCase().includes(filterLower))
    : DATA.allTokens;

  countEl.textContent = filtered.length + ' of ' + DATA.allTokens.length + ' tokens';

  const wrap = document.createElement('div');
  wrap.className = 'tokens-table-wrap';
  wrap.style.maxHeight = '600px';
  wrap.style.overflowY = 'auto';

  const table = document.createElement('table');
  table.className = 'tokens-table';
  table.innerHTML = '<thead><tr><th>Token Path</th><th>Type</th><th>Value</th><th>Collection</th></tr></thead>';

  const tbody = document.createElement('tbody');
  const limit = Math.min(filtered.length, 500);
  for (let i = 0; i < limit; i++) {
    const t = filtered[i];
    const tr = document.createElement('tr');
    const valueCellContent = t.type === 'color' && t.value.startsWith('#')
      ? '<span class="color-dot" style="background:' + escapeHtml(t.value) + '"></span>' + escapeHtml(t.value)
      : escapeHtml(t.value);
    tr.innerHTML =
      '<td class="td-path">' + escapeHtml(t.path) + '</td>' +
      '<td><span class="type-badge">' + escapeHtml(t.type) + '</span></td>' +
      '<td>' + valueCellContent + '</td>' +
      '<td>' + escapeHtml(t.collection) + '</td>';
    tbody.appendChild(tr);
  }
  if (filtered.length > 500) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="4" style="text-align:center;color:var(--text-tertiary)">Showing first 500 of ' + filtered.length + ' tokens. Use search to narrow results.</td>';
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  container.appendChild(wrap);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ---- Search ----
const searchEl = document.getElementById('search');
searchEl.addEventListener('input', () => {
  const q = searchEl.value;
  renderBaseColors(q);
  const brandSelect = document.querySelector('.brand-select');
  if (brandSelect) renderBrandColors(brandSelect.value, q);
  renderAllTokens(q);
});

// ---- Initial render ----
renderBaseColors();
if (DATA.brands.length > 0) renderBrandColors(DATA.brands[0]);
renderTypography();
renderSpacing();
renderEffects();
renderAllTokens();
document.getElementById('gen-date').textContent = new Date().toLocaleDateString();
</script>
</body>
</html>`
}
