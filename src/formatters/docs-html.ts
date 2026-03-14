/**
 * Token documentation HTML generator.
 *
 * Reads raw token JSON files and generates a self-contained HTML page with:
 *   - Color swatches grouped by category (primitives + semantic per brand)
 *   - Typography previews (font family, size, weight, line height)
 *   - Brand switcher for comparing brand-specific semantic tokens
 *
 * The page uses the same data-brand CSS variable mechanism from TICKET-026
 * for live brand switching.
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
function extractTokens(
  obj: TokenGroup,
  prefix: string[] = [],
): Array<[string[], TokenValue]> {
  const result: Array<[string[], TokenValue]> = []
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && '$value' in value) {
      result.push([[...prefix, key], value as TokenValue])
    } else if (value && typeof value === 'object') {
      result.push(...extractTokens(value as TokenGroup, [...prefix, key]))
    }
  }
  return result
}

/**
 * Resolve an alias reference like {Colors.grey.50} to its final value
 * by walking the token data.
 */
function resolveAlias(
  ref: string,
  allData: Record<string, TokenGroup>,
): string | null {
  const refPath = ref.replace(/^\{|\}$/g, '').split('.')
  for (const data of Object.values(allData)) {
    let current: unknown = data
    for (const segment of refPath) {
      if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[segment]
      } else {
        current = undefined
        break
      }
    }
    if (current && typeof current === 'object' && '$value' in (current as Record<string, unknown>)) {
      const val = (current as TokenValue).$value
      if (typeof val === 'string' && val.startsWith('{')) {
        return resolveAlias(val, allData)
      }
      return String(val)
    }
  }
  return null
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

  // Extract primitives
  const primFile = files.find((f) => f.startsWith('Primitives'))
  const primitives = primFile ? allData[primFile] : {}

  // Extract primitive colors
  const primColorTokens = primitives.Colors
    ? extractTokens(primitives.Colors as TokenGroup)
    : []

  // Group primitive colors by first path segment
  const primColorGroups: Record<string, Array<[string[], string]>> = {}
  for (const [tokenPath, token] of primColorTokens) {
    if (token.$type !== 'color') continue
    const group = tokenPath[0]
    if (!primColorGroups[group]) primColorGroups[group] = []
    const value =
      typeof token.$value === 'string' && token.$value.startsWith('{')
        ? resolveAlias(token.$value, allData) ?? String(token.$value)
        : String(token.$value)
    primColorGroups[group].push([tokenPath, value])
  }

  // Extract brand semantic colors
  const brandColorData: Record<
    string,
    Record<string, Array<[string[], string, string]>>
  > = {}
  for (const brand of brands) {
    const brandFile = files.find((f) => f.includes(`Brand(Alias).${brand}.json`))
    if (!brandFile) continue
    const brandTokens = allData[brandFile]
    const colorTokens = brandTokens.Colors
      ? extractTokens(brandTokens.Colors as TokenGroup)
      : []

    const groups: Record<string, Array<[string[], string, string]>> = {}
    for (const [tokenPath, token] of colorTokens) {
      if (token.$type !== 'color') continue
      const group = tokenPath[0]
      if (!groups[group]) groups[group] = []
      const alias = String(token.$value)
      const resolved =
        typeof token.$value === 'string' && token.$value.startsWith('{')
          ? resolveAlias(token.$value, allData) ?? alias
          : alias
      groups[group].push([tokenPath, resolved, alias])
    }
    brandColorData[brand] = groups
  }

  // Extract typography tokens from primitives
  const typographyData: Record<string, Array<[string, string]>> = {}
  if (primitives.Typography) {
    for (const [category, group] of Object.entries(primitives.Typography as TokenGroup)) {
      if (typeof group !== 'object' || '$value' in group) continue
      const tokens = extractTokens(group as TokenGroup)
      typographyData[category] = tokens.map(([p, t]) => [p.join('.'), String(t.$value)])
    }
  }

  // Serialize data for JS
  const jsData = JSON.stringify({
    brands,
    primColorGroups: Object.fromEntries(
      Object.entries(primColorGroups).map(([group, tokens]) => [
        group,
        tokens.map(([p, v]) => ({ path: p.join('.'), value: v })),
      ]),
    ),
    brandColorData: Object.fromEntries(
      Object.entries(brandColorData).map(([brand, groups]) => [
        brand,
        Object.fromEntries(
          Object.entries(groups).map(([group, tokens]) => [
            group,
            tokens.map(([p, v, a]) => ({ path: p.join('.'), value: v, alias: a })),
          ]),
        ),
      ]),
    ),
    typography: typographyData,
  })

  return `<!DOCTYPE html>
<html lang="en" data-brand="${brands[0]?.toLowerCase() ?? ''}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design Token Reference</title>
<style>
  :root {
    --bg: #f5f5f7;
    --bg-card: rgba(255, 255, 255, 0.72);
    --bg-card-hover: rgba(255, 255, 255, 0.85);
    --text: #1d1d1f;
    --text-secondary: #6e6e73;
    --text-tertiary: #aeaeb2;
    --border: rgba(0, 0, 0, 0.08);
    --accent: #0071e3;
    --radius: 16px;
    --radius-sm: 10px;
    --shadow: 0 2px 12px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.1);
    --shadow-hover: 0 4px 20px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0, 0, 0, 0.12);
    --font: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1d1d1f;
      --bg-card: rgba(44, 44, 46, 0.72);
      --bg-card-hover: rgba(44, 44, 46, 0.85);
      --text: #f5f5f7;
      --text-secondary: #a1a1a6;
      --text-tertiary: #636366;
      --border: rgba(255, 255, 255, 0.1);
      --shadow: 0 2px 12px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1);
      --shadow-hover: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.12);
    }
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 24px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 48px;
    flex-wrap: wrap;
    gap: 16px;
  }

  header h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .brand-switcher {
    display: flex;
    gap: 4px;
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 12px;
    padding: 4px;
    border: 1px solid var(--border);
  }

  .brand-btn {
    padding: 8px 20px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .brand-btn:hover { color: var(--text); }
  .brand-btn.active {
    background: var(--accent);
    color: white;
    box-shadow: 0 2px 8px rgba(0, 113, 227, 0.3);
  }

  section { margin-bottom: 56px; }

  section h2 {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-bottom: 8px;
  }

  section h3 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 24px 0 12px;
    text-transform: capitalize;
  }

  .section-desc {
    color: var(--text-secondary);
    font-size: 14px;
    margin-bottom: 24px;
  }

  /* Color swatches */
  .swatch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 12px;
  }

  .swatch {
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    transition: all 0.2s ease;
    cursor: default;
    position: relative;
  }

  .swatch:hover {
    background: var(--bg-card-hover);
    box-shadow: var(--shadow-hover);
    transform: translateY(-2px);
  }

  .swatch-color {
    height: 72px;
    width: 100%;
    border-bottom: 1px solid var(--border);
  }

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

  /* Tooltip */
  .swatch .tooltip {
    display: none;
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--text);
    color: var(--bg);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-family: var(--font-mono);
    white-space: nowrap;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .swatch:hover .tooltip { display: block; }

  /* Typography previews */
  .type-grid {
    display: grid;
    gap: 12px;
  }

  .type-card {
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px 24px;
    box-shadow: var(--shadow);
    transition: all 0.2s ease;
  }

  .type-card:hover {
    box-shadow: var(--shadow-hover);
    transform: translateY(-1px);
  }

  .type-preview {
    font-size: 24px;
    margin-bottom: 12px;
    line-height: 1.3;
  }

  .type-meta {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .type-meta span {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    background: rgba(0, 0, 0, 0.04);
    padding: 4px 10px;
    border-radius: 6px;
  }

  @media (prefers-color-scheme: dark) {
    .type-meta span { background: rgba(255, 255, 255, 0.06); }
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

  /* Search */
  .search-box {
    width: 100%;
    max-width: 400px;
    padding: 10px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    margin-bottom: 24px;
  }

  .search-box:focus {
    border-color: var(--accent);
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
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 12px;
    padding: 4px;
    border: 1px solid var(--border);
    width: fit-content;
  }

  .tab-btn {
    padding: 8px 20px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab-btn:hover { color: var(--text); }
  .tab-btn.active {
    background: white;
    color: var(--text);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  }

  @media (prefers-color-scheme: dark) {
    .tab-btn.active {
      background: rgba(255, 255, 255, 0.12);
      color: var(--text);
    }
  }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Design Token Reference</h1>
    <div id="brand-switcher" class="brand-switcher"></div>
  </header>

  <input type="text" class="search-box" id="search" placeholder="Search tokens...">

  <div class="tabs" id="tabs">
    <button class="tab-btn active" data-tab="primitives">Primitives</button>
    <button class="tab-btn" data-tab="semantic">Semantic</button>
    <button class="tab-btn" data-tab="typography">Typography</button>
  </div>

  <section id="section-primitives">
    <h2>Primitive Colors</h2>
    <p class="section-desc">Raw color values from the global palette. These are referenced by semantic tokens.</p>
    <div id="prim-colors"></div>
  </section>

  <section id="section-semantic" class="hidden">
    <h2>Semantic Colors</h2>
    <p class="section-desc">Brand-specific color tokens. Switch brands to compare values.</p>
    <div id="brand-colors"></div>
  </section>

  <section id="section-typography" class="hidden">
    <h2>Typography</h2>
    <p class="section-desc">Font families, sizes, weights, and line heights.</p>
    <div id="typography"></div>
  </section>
</div>

<footer>
  Generated by design-token-farm &middot; <span id="gen-date"></span>
</footer>

<script>
const DATA = ${jsData};

// ---- Brand switcher ----
const switcherEl = document.getElementById('brand-switcher');
DATA.brands.forEach((brand, i) => {
  const btn = document.createElement('button');
  btn.className = 'brand-btn' + (i === 0 ? ' active' : '');
  btn.textContent = brand;
  btn.addEventListener('click', () => {
    document.documentElement.setAttribute('data-brand', brand.toLowerCase());
    switcherEl.querySelectorAll('.brand-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderBrandColors(brand);
  });
  switcherEl.appendChild(btn);
});

// ---- Tabs ----
const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.getAttribute('data-tab');
    document.getElementById('section-primitives').classList.toggle('hidden', tab !== 'primitives');
    document.getElementById('section-semantic').classList.toggle('hidden', tab !== 'semantic');
    document.getElementById('section-typography').classList.toggle('hidden', tab !== 'typography');
  });
});

// ---- Render primitive colors ----
function renderPrimColors(filter) {
  const container = document.getElementById('prim-colors');
  container.innerHTML = '';
  const filterLower = (filter || '').toLowerCase();

  for (const [group, tokens] of Object.entries(DATA.primColorGroups)) {
    const filtered = tokens.filter(t =>
      !filterLower || t.path.toLowerCase().includes(filterLower) || t.value.toLowerCase().includes(filterLower)
    );
    if (filtered.length === 0) continue;

    const h3 = document.createElement('h3');
    h3.textContent = group;
    container.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'swatch-grid';
    for (const token of filtered) {
      grid.appendChild(createSwatch(token.path, token.value));
    }
    container.appendChild(grid);
  }
}

// ---- Render brand colors ----
function renderBrandColors(brand, filter) {
  const container = document.getElementById('brand-colors');
  container.innerHTML = '';
  const data = DATA.brandColorData[brand];
  if (!data) {
    container.innerHTML = '<p style="color: var(--text-secondary)">No brand data found.</p>';
    return;
  }
  const filterLower = (filter || '').toLowerCase();

  for (const [group, tokens] of Object.entries(data)) {
    const filtered = tokens.filter(t =>
      !filterLower || t.path.toLowerCase().includes(filterLower) ||
      t.value.toLowerCase().includes(filterLower) || t.alias.toLowerCase().includes(filterLower)
    );
    if (filtered.length === 0) continue;

    const h3 = document.createElement('h3');
    h3.textContent = group;
    container.appendChild(h3);

    const grid = document.createElement('div');
    grid.className = 'swatch-grid';
    for (const token of filtered) {
      const swatch = createSwatch(token.path, token.value, token.alias);
      grid.appendChild(swatch);
    }
    container.appendChild(grid);
  }
}

// ---- Create swatch element ----
function createSwatch(tokenPath, value, alias) {
  const swatch = document.createElement('div');
  swatch.className = 'swatch';

  const colorDiv = document.createElement('div');
  colorDiv.className = 'swatch-color';
  colorDiv.style.background = value;

  // Check if color is light to add a subtle inner border
  if (isLightColor(value)) {
    colorDiv.style.borderBottom = '1px solid rgba(0,0,0,0.08)';
    colorDiv.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.06)';
  }

  const info = document.createElement('div');
  info.className = 'swatch-info';

  const name = document.createElement('div');
  name.className = 'swatch-name';
  // Show last 2 segments of path for readability
  const parts = tokenPath.split('.');
  name.textContent = parts.slice(-2).join('.');
  name.title = tokenPath;

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

  // Tooltip with full path
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.textContent = tokenPath;

  swatch.appendChild(tooltip);
  swatch.appendChild(colorDiv);
  swatch.appendChild(info);

  // Click to copy
  swatch.addEventListener('click', () => {
    navigator.clipboard.writeText(value).then(() => {
      tooltip.textContent = 'Copied!';
      setTimeout(() => { tooltip.textContent = tokenPath; }, 1200);
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

  // Font families
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

  // Font sizes
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

  // Font weights
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ---- Search ----
const searchEl = document.getElementById('search');
searchEl.addEventListener('input', () => {
  const q = searchEl.value;
  renderPrimColors(q);
  const activeBrand = document.querySelector('.brand-btn.active');
  if (activeBrand) renderBrandColors(activeBrand.textContent, q);
});

// ---- Initial render ----
renderPrimColors();
if (DATA.brands.length > 0) renderBrandColors(DATA.brands[0]);
renderTypography();
document.getElementById('gen-date').textContent = new Date().toLocaleDateString();
</script>
</body>
</html>`
}
