import type { DiffResult } from '../result-schema.js'
import { baseInWords, headInWords } from '../sides.js'
import { flatMap } from './flat.js'
import { PLACEMENT_JS } from './placement.js'
import { DRAFTING_TABLE_CSS } from './tokens-css.js'

/**
 * The review report (`index.html` in the report folder): one static page with relative links
 * only, styled with the DTA Drafting Table tokens. Explained changes are grouped by token
 * change (samples and a contact sheet), unexplained ones are listed one by one.
 *
 * A story row (TICKET-109, the design-system `DiffCard`) shows only "after", with each changed
 * element outlined and the tokens that explain it in notes under it, a table of those tokens
 * and links to the whole images. "Show before" swaps the image in place; unexplained rows have
 * the diff overlay on. Works without JavaScript: "after", the outlines and the links stay, the
 * notes line up under the image and the toggles are left out.
 */

type Story = DiffResult['stories'][number]
type Group = NonNullable<DiffResult['review']>['tokens'][number]
type State = Group['before']
type Region = { x: number; y: number; width: number; height: number }

const SAMPLES = 2
/** Image pixels shown below the lowest changed box. */
const CROP_MARGIN = 48

const escape = (value: unknown) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const percent = (ratio: number) => `${(ratio * 100).toFixed(ratio < 0.001 && ratio > 0 ? 3 : 2)}%`
const ref = (s: Pick<Story, 'id' | 'viewport'>) => `${s.id}@${s.viewport}`
const anchor = (prefix: string, value: string) =>
  `${prefix}-${value.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')}`
const storyAnchor = (s: Pick<Story, 'id' | 'viewport'>) => anchor('story', ref(s))
const shortToken = (id: string) => id.split(' (')[0]
const layerOf = (id: string) => /\(([^)]*)\)$/.exec(id)?.[1] ?? ''

/**
 * The verdicts in the status colours (TICKET-120): pass is success (the dot), fail error (the
 * square). "Changes to review" is a diff state, not a problem: it is `signal` like Checks'
 * "changes to review" and the design system's changed chip (TICKET-121): the tint in
 * signal-subtle, the word and its dot in signal-text (signal-bg is under 3:1 on the tint in
 * Light). The action tint stays for actions and links.
 */
const VERDICT: Record<NonNullable<DiffResult['verdict']>, { label: string; tone: string }> = {
  pass: { label: 'Pass', tone: 'pass' },
  review: { label: 'Changes to review', tone: 'review' },
  fail: { label: 'Unexplained changes', tone: 'fail' },
}

const isColor = (value: unknown) =>
  typeof value === 'string' && /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(value.trim())

function value(state: State) {
  if (!state) return '<span class="none">—</span>'
  const resolved = state.resolved ?? state.raw
  const swatch = isColor(resolved)
    ? `<span class="swatch" style="background:${escape(resolved)}"></span>`
    : ''
  const raw = String(state.raw)
  const alias =
    raw.startsWith('{') && state.resolved !== undefined
      ? `<code>${escape(raw)}</code> <span class="dim">${escape(state.resolved)}</span>`
      : `<code>${escape(raw)}</code>`
  return `<span class="value">${swatch}${alias}</span>`
}

/** What a token change was and is, by `name (Collection · Mode)`. */
interface Change {
  before?: State
  after?: State
  type?: string
}

function changesById(result: DiffResult): Map<string, Change> {
  const byId = new Map<string, Change>()
  for (const c of result.tokens.changes) {
    byId.set(`${c.name} (${c.collection} · ${c.mode})`, {
      before: c.before,
      after: c.after,
      type: c.type,
    })
  }
  for (const g of result.review?.tokens ?? []) {
    const known = byId.get(g.id)
    byId.set(g.id, { ...known, before: g.before ?? known?.before, after: g.after ?? known?.after })
  }
  return byId
}

const aliasPath = (state: State) => {
  const match = state ? /^\{(.+)\}$/.exec(String(state.raw).trim()) : null
  return match ? match[1].split('.') : null
}

/**
 * The change in a note (board decision 5): a colour shows its alias step, the last two segments
 * of the alias path and only the step when the palette stays (`Nova 500 → 600`); everything else
 * shows the resolved values (`8 → 24`).
 */
function noteChange(change: Change | undefined): string {
  if (!change || (!change.before && !change.after)) return ''
  const { before, after } = change
  const color =
    change.type === 'color' ||
    isColor(before?.resolved ?? before?.raw) ||
    isColor(after?.resolved ?? after?.raw)
  const from = aliasPath(before)
  const to = aliasPath(after)
  if (color && from && to) {
    const a = from.slice(-2)
    const b = to.slice(-2)
    const samePalette = a.length === 2 && b.length === 2 && a[0] === b[0]
    return `${a.join(' ')} → ${samePalette ? b[1] : b.join(' ')}`
  }
  const show = (state: State) => (state ? String(state.resolved ?? state.raw) : '—')
  return `${show(before)} → ${show(after)}`
}

/**
 * Redline labels (signal-fg on signal-bg) are the design system's one AA exception (4.5:1, see
 * the Redline component): marked so the rendered contrast audit knows, like Redline and Badge.
 */
const REDLINE_LABEL = ' data-contrast-exception="redline label"'

const chip = (tone: string, text: string) =>
  `<span class="chip ${tone}"${tone === 'token' ? REDLINE_LABEL : ''}>${escape(text)}</span>`

function cause(story: Story) {
  if (story.status !== 'changed') return ''
  const a = story.attribution
  if (!a) return chip('fail', 'unexplained')
  const tokens = a.tokens.map((t) => chip('token', shortToken(t.id))).join('')
  return a.explained ? tokens : `${chip('fail', 'unexplained')}${tokens}`
}

/** A changed box and what explains it: token notes, or "unexplained · no token". */
interface Cluster {
  region: Region
  /** The token changes that explain the box (its set groups list entries). */
  ids: string[]
  notes: Array<{ token: string; change: string }>
  unexplained?: boolean
}

/** One cluster per distinct box: tokens that change the same box share its notes (stacked). */
function clustersOf(story: Story, changes: Map<string, Change>): Cluster[] {
  const a = story.attribution
  if (!a) return []
  const byBox = new Map<string, Cluster>()
  for (const t of a.tokens) {
    for (const region of t.regions) {
      const key = `${region.x},${region.y},${region.width},${region.height}`
      const cluster = byBox.get(key) ?? { region, ids: [], notes: [] }
      cluster.ids.push(t.id)
      cluster.notes.push({ token: shortToken(t.id), change: noteChange(changes.get(t.id)) })
      byBox.set(key, cluster)
    }
  }
  const out = [...byBox.values()]
  if (a.unexplainedRegion) {
    out.push({ region: a.unexplainedRegion, ids: [], notes: [], unexplained: true })
  }
  return out
}

const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(3)}%`

/**
 * Outlines over the image, in % of the compared canvas, 2 px outside the element's box; then one
 * numbered marker per box, shown and placed by the script when the box's notes are listed.
 */
function marks(clusters: Cluster[], canvas: { width: number; height: number }) {
  const outlines = clusters.map(
    ({ region: r, unexplained }, i) =>
      `<span class="mark${unexplained ? ' unexplained' : ''}" data-i="${i}" style="left:calc(${pct(r.x, canvas.width)} - 3px);top:calc(${pct(r.y, canvas.height)} - 3px);width:calc(${pct(r.width, canvas.width)} + 6px);height:calc(${pct(r.height, canvas.height)} + 6px)"></span>`,
  )
  const markers = clusters.map((_, i) => `<span class="key" data-i="${i}"${REDLINE_LABEL}></span>`)
  return outlines.join('') + markers.join('')
}

/**
 * The notes: one stack per box with a leader to it. The inline script places them under the
 * boxes (never over another outlined box); without it they line up under the image.
 */
function notes(clusters: Cluster[]) {
  const note = (token: string, change: string) =>
    `<span class="note"${REDLINE_LABEL}><span class="note-token">${escape(token)}</span>${change ? `<span class="note-sep"> · </span><span class="note-change">${escape(change)}</span>` : ''}</span>`
  return clusters
    .map(({ region: r, ids, notes, unexplained }, i) => {
      const stack = unexplained
        ? '<span class="note unexplained"><span class="note-token">unexplained</span><span class="note-sep"> · </span><span class="note-change">no token</span></span>'
        : notes.map((n) => note(n.token, n.change)).join('')
      const set = unexplained ? 'unexplained' : [...new Set(ids)].sort().join('|')
      return `<span class="cluster" data-i="${i}" data-set="${escape(set)}" data-box="${r.x},${r.y},${r.width},${r.height}"${unexplained ? ' data-side' : ''}><span class="leader" aria-hidden="true"></span><span class="key" aria-hidden="true"${REDLINE_LABEL}></span><span class="stack">${stack}</span></span>`
    })
    .join('')
}

/** The box, the tick and the on/off word: one toggle button (aria-pressed). */
function toggle(kind: 'before' | 'overlay', label: string, on: boolean, describedBy: string) {
  return `<button type="button" class="toggle" data-toggle="${kind}" aria-pressed="${on}" aria-label="${label}" aria-describedby="${describedBy}"><span class="box" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"></path></svg></span><span class="word">${label}</span><span class="state">${on ? 'on' : 'off'}</span></button>`
}

/** Both sides in words (TICKET-123): "main · 1a2b3c4", "feature/x · 9f3c1a2 + uncommitted changes". */
interface Context {
  changes: Map<string, Change>
  before: string
  after: string
  /** Reads an image of the report folder (for the flat map); absent: notes go in the list. */
  image?: (path: string) => Uint8Array | undefined
}

/** The flat map of the shown image's cropped canvas, or nothing (then every note is listed). */
function flatOf(ctx: Context, path: string, height: number): string | undefined {
  try {
    const png = ctx.image?.(path)
    return png ? flatMap(png, height) : undefined
  } catch {
    return undefined
  }
}

/** A column head of the token table: the side in words, its ref and short hash under it. */
const sideHead = (word: string, refs: string) =>
  `<th scope="col"><span class="col-word">${word}</span><span class="col-ref">${escape(refs)}</span></th>`

function tokenTable(story: Story, ctx: Context) {
  const tokens = story.attribution?.tokens ?? []
  if (tokens.length === 0) return ''
  const rows = tokens.map((t) => {
    const change = ctx.changes.get(t.id)
    return `<tr><th scope="row"><code>${escape(shortToken(t.id))}</code></th><td data-label="Before">${value(change?.before)}</td><td data-label="With this change">${value(change?.after)}</td><td data-label="Outlined"><span>${t.elements.map((e) => `<code>${escape(e)}</code>`).join(', ')}</span></td></tr>`
  })
  return `<table class="tokens-explained"><caption class="meta">Explained by ${tokens.length} ${tokens.length === 1 ? 'token' : 'tokens'}</caption><thead><tr><th scope="col">Explained by</th>${sideHead('Before', ctx.before)}${sideHead('With this change', ctx.after)}<th scope="col">Outlined</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
}

/**
 * One story × viewport: "after" with outlines and notes ("Show before" swaps the image in
 * place), the token table and the whole images. Added and removed stories show their one side.
 */
function row(story: Story, ctx: Context) {
  const { base, head, diff } = story.images
  const id = storyAnchor(story)
  const title = `${id}-title`
  const a = story.attribution
  const full = a && a.canvas.width > 0 && a.canvas.height > 0 ? a.canvas : undefined
  const unexplained = story.status === 'changed' && !a?.explained
  const both = Boolean(base && head)
  const clusters = full ? clustersOf(story, ctx.changes) : []
  // Cropped a little below the lowest changed box: the rest of the page did not change.
  const canvas =
    full && clusters.length > 0
      ? {
          width: full.width,
          height: Math.min(
            full.height,
            Math.max(...clusters.map((c) => c.region.y + c.region.height)) + CROP_MARGIN,
          ),
        }
      : full
  const overlay = unexplained && both && Boolean(diff)
  const flat = canvas && clusters.length > 0 && head ? flatOf(ctx, head, canvas.height) : undefined

  // Both headings of a two-sided row (with their meta) sit in one grid cell, the other one hidden:
  // switching them moves nothing (the larger sets the box).
  const heading = (text: string, small: string) =>
    `<strong>${text}</strong> <span class="side-meta">${escape(small)}</span>`
  const side = both
    ? `<span class="swap"><span class="when-after">${heading('With this change', ctx.after)}</span><span class="when-before">${heading('Before this change', ctx.before)}</span></span>`
    : head
      ? `<span>${heading('With this change', 'new story')}</span>`
      : `<span>${heading('Before this change', `${ctx.before} · removed story`)}</span>`
  const shown = head ?? base
  const toggles = both
    ? `<div class="toggles">${overlay ? toggle('overlay', 'Diff overlay', true, title) : ''}${toggle('before', 'Show before', false, title)}</div>`
    : ''
  const view = shown
    ? `<div class="view"${overlay ? ' data-overlay' : ''}>
    <div class="bar">
      <p class="side" aria-live="polite">${side}</p>
      ${toggles}
    </div>
    <div class="stage">
      <div class="canvas"${canvas ? ` style="aspect-ratio:${canvas.width} / ${canvas.height};max-width:${canvas.width}px" data-w="${canvas.width}" data-h="${canvas.height}"${flat ? ` data-flat="${flat}"` : ''}` : ''}>
        <img class="shot after" src="${escape(shown)}" alt="${escape(`${ref(story)} ${head ? 'with this change' : 'before this change'}`)}" loading="lazy">
        ${both ? `<img class="shot before" src="${escape(base!)}" alt="${escape(`${ref(story)} before this change`)}" loading="lazy">` : ''}
        ${overlay ? `<img class="shot overlay" src="${escape(diff!)}" alt="">` : ''}
        ${canvas && clusters.length > 0 ? `<div class="marks" aria-hidden="true">${marks(clusters, canvas)}</div>` : ''}
      </div>
      ${canvas && clusters.length > 0 ? `<div class="notes">${notes(clusters)}</div>` : ''}
    </div>
  </div>`
    : '<p class="empty">Not rendered.</p>'
  const why = unexplained
    ? `<p class="why">No changed token accounts for ${a?.tokens.length ? 'some of ' : ''}these pixels: a component, content or layout change. The dashed box marks where; the overlay shows which pixels.</p>`
    : ''
  const links = [
    base ? `<a href="${escape(base)}">before</a>` : '',
    head ? `<a href="${escape(head)}">after</a>` : '',
    diff ? `<a href="${escape(diff)}">diff</a>` : '',
  ].filter(Boolean)
  return `<article class="story" id="${id}">
  <header>
    <h4 id="${title}"><code>${escape(story.id)}</code> <span class="dim">${story.viewport} px${story.status === 'changed' ? ` · ${percent(story.ratio)} changed` : ''}</span></h4>
    <div class="causes">${chip(story.status, story.status)}${story.status === 'changed' ? (unexplained ? chip('fail', 'unexplained') : chip('explained', 'explained')) : ''}</div>
  </header>
  ${view}
  ${tokenTable(story, ctx)}
  ${why}
  ${links.length > 0 ? `<p class="whole">Whole images: ${links.join(' ')}</p>` : ''}
</article>`
}

function group(g: Group, stories: Map<string, Story>, ctx: Context) {
  const members = g.stories.map((s) => stories.get(s)).filter((s): s is Story => Boolean(s))
  const samples = members.slice(0, SAMPLES)
  const sheet = members.length > SAMPLES ? members : []
  return `<article class="group" id="${anchor('token', g.id)}">
  <header>
    <div class="token-title">
      <span class="tag big"${REDLINE_LABEL}>${escape(shortToken(g.id))}</span>
      <span class="meta">${escape(layerOf(g.id))}</span>
    </div>
    <p class="change">${value(g.before)} <span class="arrow" data-contrast-exception="redline arrow (non-text, 3:1)">→</span> ${value(g.after)}</p>
    <p class="explains">Explains <strong>${members.length}</strong> ${members.length === 1 ? 'story' : 'stories'} ${g.needsReview ? chip('review', 'to review') : chip('pass', 'below threshold')}</p>
  </header>
  <div class="samples">${samples.map((s) => row(s, ctx)).join('\n')}</div>
  ${
    sheet.length > 0
      ? `<h4 class="meta">Contact sheet · ${sheet.length} stories</h4>
  <ul class="sheet">${sheet
    .map(
      (s) =>
        `<li><a href="#${storyAnchor(s)}"><img src="${escape(s.images.diff ?? s.images.head ?? '')}" alt="" loading="lazy"><span><code>${escape(ref(s))}</code> ${percent(s.ratio)}</span></a></li>`,
    )
    .join('')}</ul>`
      : ''
  }
</article>`
}

function changeTable(result: DiffResult) {
  const rows = result.tokens.changes.map(
    (c) =>
      `<tr><td>${chip(c.kind, c.kind)}</td><td><code>${escape(c.name)}</code></td><td class="dim">${escape(`${c.collection} · ${c.mode}`)}</td><td>${value(c.before)}</td><td>${value(c.after)}</td></tr>`,
  )
  return rows.length === 0
    ? '<p class="empty">No token changes.</p>'
    : `<div class="table"><table><thead><tr><th>Kind</th><th>Token</th><th>Collection · mode</th><th>Before</th><th>With this change</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
}

function storyTable(result: DiffResult) {
  const rows = result.stories.map(
    (s) =>
      `<tr><td>${s.status === 'unchanged' ? `<code>${escape(s.id)}</code>` : `<a href="#${storyAnchor(s)}"><code>${escape(s.id)}</code></a>`}</td><td>${s.viewport}px</td><td>${chip(s.status, s.status)}</td><td>${s.status === 'changed' || s.status === 'unchanged' ? percent(s.ratio) : '—'}</td><td>${cause(s)}</td></tr>`,
  )
  return `<div class="table"><table><thead><tr><th>Story</th><th>Viewport</th><th>Status</th><th>Changed</th><th>Cause</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
}

/*
 * Outlines, leaders and notes are signal with a 1 px ink line (board decision 4): signal alone is
 * under 3:1 on a light story page, the ink line holds there and signal holds on dark surfaces.
 * The screenshots do not follow the report's theme, so the ink is the fixed `ink-900`, and the
 * stage is the story page's own paper.
 */
const STYLE = `
*,*::before,*::after{box-sizing:border-box}
html{color-scheme:light}
html[data-brand="graphite"]{color-scheme:dark}
body{margin:0;background-color:var(--bg-canvas);color:var(--fg-default);font-family:var(--font-sans);font-size:calc(var(--type-body-size)*1px);line-height:var(--type-body-line-height)}
.page{max-width:1180px;margin:0 auto;grid-template-columns:minmax(0,1fr);padding:var(--space-8) max(var(--space-4),env(safe-area-inset-right)) var(--space-16) max(var(--space-4),env(safe-area-inset-left));display:grid;gap:var(--space-12)}
.masthead{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--space-4)}
.mark-logo{display:flex;align-items:center;gap:10px;font-weight:var(--type-title-weight);font-size:calc(var(--type-title-size)*1px)}
.mark-logo svg{flex:none}
.masthead .meta{display:block}
h1{margin:0;font-size:clamp(34px,6vw,calc(var(--type-display-lg-size)*1px));line-height:var(--type-display-lg-line-height);letter-spacing:var(--type-display-lg-letter-spacing);text-wrap:balance}
h2{margin:0 0 var(--space-4);font-size:calc(var(--type-heading-size)*1px);line-height:var(--type-heading-line-height);letter-spacing:var(--type-heading-letter-spacing)}
h3,h4{margin:0}
.meta{font-family:var(--font-mono);font-size:calc(var(--type-meta-size)*1px);letter-spacing:var(--type-meta-letter-spacing);color:var(--fg-subtle);text-transform:uppercase}
.dim{color:var(--fg-subtle)}
code{font-family:var(--font-mono);font-size:.86em}
a{color:var(--action-text)}
a:focus-visible,button:focus-visible{outline:var(--stroke-focus) solid var(--action-bg);outline-offset:2px}
.intro{display:grid;gap:var(--space-4)}
.refs{margin:0;display:flex;flex-wrap:wrap;gap:4px var(--space-6);text-transform:none}
.lede{margin:0;color:var(--fg-muted);max-width:68ch}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-2);margin:0;padding:0;list-style:none}
.stats li{padding:var(--space-4);border:var(--stroke-hairline) solid var(--border-default);border-radius:var(--radius-md);background:var(--bg-surface)}
.stats strong{display:block;font-size:calc(var(--type-heading-size)*1px);line-height:1}
nav.toc{display:flex;flex-wrap:wrap;gap:var(--space-2)}
nav.toc a{padding:6px 12px;border:var(--stroke-hairline) solid var(--border-default);border-radius:var(--radius-full);background:var(--bg-surface);color:var(--fg-default);text-decoration:none;font-size:calc(var(--type-body-sm-size)*1px)}
.chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:var(--radius-full);font-family:var(--font-mono);font-size:calc(var(--type-meta-size)*1px);background:var(--bg-subtle);color:var(--fg-muted);white-space:nowrap}
.chip.pass,.chip.unchanged{background:var(--status-success-subtle);color:var(--status-success-text)}
.chip.changed,.chip.added,.chip.affected{background:var(--action-subtle);color:var(--action-text)}
.chip.review{background:var(--signal-subtle);color:var(--signal-text)}
.chip.removed{background:var(--signal-subtle);color:var(--signal-text)}
.chip.fail{background:var(--status-error-subtle);color:var(--status-error-text)}
.chip.pass::before,.chip.unchanged::before,.chip.review::before,.chip.fail::before{content:"";flex:none;width:6px;height:6px;margin-right:6px;border-radius:var(--radius-full);background:var(--status-success-marker)}
.chip.fail::before{border-radius:0;background:var(--status-error-marker)}
.chip.review::before{background:currentColor}
.chip.token{background:var(--signal-bg);color:var(--signal-fg);border-radius:4px}
.verdict{font-size:calc(var(--type-body-sm-size)*1px);padding:6px 14px}
.theme{min-height:44px;padding:0 16px;border:var(--stroke-ink) solid var(--border-strong);border-radius:var(--radius-md);background:transparent;color:var(--fg-default);font:inherit;font-weight:var(--type-label-weight);cursor:pointer}
.group,.story,.panel{border:var(--stroke-hairline) solid var(--border-default);border-radius:var(--radius-lg);background:var(--bg-surface);min-width:0}
.group{padding:var(--space-6);display:grid;grid-template-columns:minmax(0,1fr);gap:var(--space-6)}
.group>header{display:grid;gap:var(--space-2)}
.token-title{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3)}
.tag{display:inline-block;padding:2px 6px;border-radius:4px;background:var(--signal-bg);color:var(--signal-fg);font-family:var(--font-mono);font-size:calc(var(--type-redline-size)*1px);line-height:var(--type-redline-line-height);white-space:nowrap}
.tag.big{font-size:calc(var(--type-code-size)*1px);padding:4px 10px}
.change,.explains{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-2)}
.arrow{color:var(--signal-bg);font-weight:700}
.value{display:inline-flex;align-items:center;gap:6px}
.swatch{width:18px;height:18px;border-radius:4px;border:var(--stroke-hairline) solid var(--border-default);flex:none}
.samples,.list{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--space-4)}
.page>*,.group>*,.story>*,.samples>*,.list>*{min-width:0}
.story{padding:var(--space-6);display:grid;grid-template-columns:minmax(0,1fr);gap:var(--space-4)}
.story>header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:var(--space-2)}
.story h4{font-weight:400}
.causes{display:flex;flex-wrap:wrap;gap:6px}
.view{display:grid;gap:var(--space-3);min-width:0}
.bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--space-3);min-height:44px}
.side{margin:0;min-width:12em}
.side>span>span,.side>span:not(.swap){display:flex;flex-wrap:wrap;align-items:baseline;column-gap:var(--space-3);row-gap:2px}
.side strong{font-size:calc(var(--type-title-size)*1px);font-weight:var(--type-title-weight)}
.side-meta{font-family:var(--font-mono);font-size:calc(var(--type-meta-size)*1px);color:var(--fg-subtle)}
.swap{display:inline-grid}
.swap>*{grid-area:1/1}
.when-before,.view[data-before] .when-after{visibility:hidden}
.view[data-before] .when-before{visibility:visible}
.toggles{display:flex;flex-wrap:wrap;gap:var(--space-2)}
html:not(.js) .toggles{display:none}
.toggle{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:0 14px;border:var(--stroke-ink) solid var(--border-strong);border-radius:var(--radius-md);background:var(--bg-surface);color:var(--fg-default);font:inherit;font-weight:var(--type-label-weight);cursor:pointer}
.toggle[aria-pressed="true"]{background:var(--bg-subtle)}
.toggle .box{display:inline-grid;place-items:center;width:18px;height:18px;border:var(--stroke-ink) solid var(--fg-default);border-radius:4px}
.toggle .box svg{visibility:hidden}
.toggle[aria-pressed="true"] .box{background:var(--fg-default);color:var(--bg-surface)}
.toggle[aria-pressed="true"] .box svg{visibility:visible}
.toggle .state{display:inline-block;width:3ch;text-align:left;font-family:var(--font-mono);font-weight:400;font-size:calc(var(--type-meta-size)*1px);color:var(--fg-muted)}
.stage{position:relative;overflow:hidden;border:var(--stroke-hairline) solid var(--border-default);border-radius:var(--radius-md);background:var(--paper-100);padding-bottom:var(--room,0px)}
.canvas{position:relative;display:grid}
.shot{grid-area:1/1;display:block;max-width:100%;height:auto}
.canvas[data-w]{display:block;overflow:hidden}
.canvas[data-w] .shot{position:absolute;top:0;left:0;width:100%;max-width:none}
.shot.before,.shot.overlay{visibility:hidden}
.shot.overlay{mix-blend-mode:multiply;pointer-events:none}
.view[data-overlay] .shot.overlay{visibility:visible}
.view[data-before] .shot.before{visibility:visible}
.view[data-before] .shot.after,.view[data-before] .shot.overlay,.view[data-before] .marks,.view[data-before] .notes{visibility:hidden}
.marks{position:absolute;inset:0;pointer-events:none}
.mark{position:absolute;border:var(--stroke-hairline) solid var(--ink-900);outline:var(--stroke-ink) solid var(--signal-bg);border-radius:2px}
.mark:not(.unexplained){box-shadow:0 0 0 3px var(--ink-900)}
.mark.unexplained{border-style:dashed;outline-style:dashed}
.notes{display:flex;flex-wrap:wrap;gap:var(--space-2);padding:var(--space-2)}
.cluster{display:contents}
.leader{display:none}
.stack{display:inline-flex;flex-direction:column;align-items:flex-start;gap:4px}
html.js .notes{position:absolute;left:0;top:0;width:100%;height:0;padding:0}
html.js .leader{display:block;position:absolute;width:4px;background:var(--signal-bg);border-left:var(--stroke-hairline) solid var(--ink-900);border-right:var(--stroke-hairline) solid var(--ink-900)}
html.js .stack{position:absolute;max-width:100%}
.note{display:inline-block;padding:3px 8px;border:var(--stroke-hairline) solid var(--ink-900);border-radius:4px;background:var(--signal-bg);color:var(--signal-fg);font-family:var(--font-mono);font-size:calc(var(--type-meta-size)*1px);line-height:var(--type-meta-line-height);white-space:nowrap}
.note.unexplained{border-style:dashed;background:var(--paper-0);color:var(--ink-900)}
.key{display:none;position:absolute;box-sizing:border-box;min-width:20px;height:20px;padding:0 5px;border:var(--stroke-hairline) solid var(--ink-900);border-radius:var(--radius-full);background:var(--signal-bg);color:var(--signal-fg);font-family:var(--font-mono);font-size:calc(var(--type-meta-size)*1px);line-height:18px;text-align:center;white-space:nowrap}
.marks>.key.keyed,html.js .cluster.keyed:not(.merged)>.key{display:block}
html.js .cluster.merged>.stack{display:none}
html.js .cluster.keyed>.leader{display:none}
.tokens-explained{width:100%;border-collapse:collapse;font-size:calc(var(--type-body-sm-size)*1px)}
.tokens-explained caption{text-align:left;padding-bottom:var(--space-2);display:none}
.tokens-explained th,.tokens-explained td{padding:10px 12px 10px 0;text-align:left;border-bottom:var(--stroke-hairline) solid var(--border-default);vertical-align:middle;font-weight:400}
.tokens-explained thead th{font-family:var(--font-mono);font-size:calc(var(--type-meta-size)*1px);color:var(--fg-subtle);vertical-align:bottom}
.col-word,.col-ref{display:block}
.col-word{color:var(--fg-default)}
.why{margin:0;max-width:68ch}
.whole{margin:0;display:flex;flex-wrap:wrap;gap:var(--space-2);color:var(--fg-muted);font-size:calc(var(--type-body-sm-size)*1px)}
.sheet{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-2)}
.sheet a{display:grid;gap:4px;text-decoration:none;color:var(--fg-default);font-size:calc(var(--type-body-sm-size)*1px)}
.sheet img{width:100%;height:100px;object-fit:cover;object-position:top left;border-radius:var(--radius-sm);border:var(--stroke-hairline) solid var(--border-default);background:var(--bg-surface)}
details.all>summary{cursor:pointer;font-weight:var(--type-label-weight);min-height:44px;display:flex;align-items:center}
.table{overflow-x:auto;border:var(--stroke-hairline) solid var(--border-default);border-radius:var(--radius-md);background:var(--bg-surface)}
.table table{border-collapse:collapse;width:100%;font-size:calc(var(--type-body-sm-size)*1px)}
.table th,.table td{padding:10px 12px;text-align:left;border-bottom:var(--stroke-hairline) solid var(--border-default);vertical-align:middle}
.table th{font-family:var(--font-mono);font-weight:400;font-size:calc(var(--type-meta-size)*1px);color:var(--fg-subtle);text-transform:uppercase;letter-spacing:var(--type-meta-letter-spacing)}
.table tr:last-child td{border-bottom:0}
.empty{margin:0;color:var(--fg-subtle)}
footer{color:var(--fg-subtle);font-size:calc(var(--type-body-sm-size)*1px)}
@media (max-width:640px){
.group{padding:var(--space-4)}
.story{padding:var(--space-3)}
.bar{display:grid;grid-template-columns:minmax(0,1fr)}
.toggles{display:grid;grid-template-columns:minmax(0,1fr)}
.toggle{width:100%}
.stage{margin-inline:calc(-1*(var(--space-4) + var(--space-3) + var(--stroke-hairline)));border-radius:0;border-left:0;border-right:0}
.group .stage{margin-inline:calc(-1*(var(--space-4) + var(--space-4) + var(--space-3) + 2*var(--stroke-hairline)))}
.note-sep{display:none}
.note-change{display:block}
.tokens-explained caption{display:block}
.tokens-explained thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.tokens-explained tr{display:grid;grid-template-columns:minmax(0,1fr);padding:var(--space-3) 0;border-bottom:var(--stroke-hairline) solid var(--border-default)}
.tokens-explained tbody tr{grid-template-columns:max-content minmax(0,1fr);column-gap:var(--space-3)}
.tokens-explained th,.tokens-explained td{display:grid;grid-template-columns:subgrid;grid-column:1/-1;align-items:baseline;padding:2px 0;border:0}
.tokens-explained th{display:block}
.tokens-explained td::before{content:attr(data-label);color:var(--fg-subtle);font-family:var(--font-mono);font-size:calc(var(--type-meta-size)*1px)}
}
`

const SCRIPT = `
(() => {
  const root = document.documentElement
  const button = document.querySelector('[data-theme-toggle]')
  const label = () => { if (button) button.textContent = root.dataset.brand === 'graphite' ? 'Light' : 'Graphite' }
  label()
  button && button.addEventListener('click', () => {
    root.dataset.brand = root.dataset.brand === 'graphite' ? 'light' : 'graphite'
    try { localStorage.setItem('dta-diff-theme', root.dataset.brand) } catch {}
    label()
  })
  // "Show before" and "Diff overlay": aria-pressed buttons; the image swaps in place, outlines
  // and notes hide but keep their space, the label switches (CSS, on data-before).
  for (const view of document.querySelectorAll('.view')) {
    for (const toggle of view.querySelectorAll('[data-toggle]')) {
      toggle.addEventListener('click', () => {
        const on = toggle.getAttribute('aria-pressed') !== 'true'
        toggle.setAttribute('aria-pressed', String(on))
        toggle.querySelector('.state').textContent = on ? 'on' : 'off'
        if (toggle.dataset.toggle === 'overlay') { view.toggleAttribute('data-overlay', on); return }
        view.toggleAttribute('data-before', on)
      })
    }
  }
  // Notes under their boxes: per band of boxes that share rows, in lanes below the band. A stack
  // moves right of its neighbour while its leader still lands on its box, else it takes the next
  // lane, its leader clear of the notes above. "unexplained" sits right of its box when it fits.
  // A note stays on the image only where it covers nothing but one flat colour (data-flat: the
  // screenshot's flat cells) or lies below the image; otherwise its box gets a numbered marker and
  // its notes go in a list under the image (TICKET-123). Without a flat map every note is listed.
  const GAP = 8
  const KEY = 20
${PLACEMENT_JS}
  const decode = (map) => {
    if (!map) return null
    const [cell, cols, rows, rle] = map.split(';')
    const cells = []
    for (const [, ch, n] of rle.matchAll(/([A-Za-z.])(\\d+)/g)) for (let k = 0; k < Number(n); k++) cells.push(ch)
    return { cell: Number(cell), cols: Number(cols), rows: Number(rows), cells }
  }
  // Arranges the notes of \`items\` (no DOM writes): { it, x, top, lx } per item.
  const arrange = (items, W) => {
    const spots = []
    const below = []
    for (const it of items) {
      if (it.side && it.r + GAP + it.w <= W && !it.notSide) spots.push({ it, x: it.r + GAP, top: Math.max(0, (it.t + it.b - it.h) / 2), lx: -9999, side: true })
      else below.push(it)
    }
    const bands = []
    for (const it of below) {
      const band = bands[bands.length - 1]
      if (band && it.t < band.bottom) { band.items.push(it); band.bottom = Math.max(band.bottom, it.b) }
      else bands.push({ items: [it], bottom: it.b })
    }
    // The leftmost point under the box, at least \`from\`, outside the notes of earlier lanes.
    const free = (it, from, blocked) => {
      let lx = Math.max(from, it.l + 6)
      for (const [a, b] of blocked.slice().sort((p, q) => p[0] - q[0])) if (lx >= a - 3 && lx <= b + 3) lx = b + 4
      return lx <= it.r - 4 ? lx : null
    }
    for (const band of bands) {
      const lanes = []
      const placed = []
      for (const it of band.items.sort((a, b) => a.l - b.l)) {
        let spot = null
        for (let k = 0; k <= lanes.length && !spot; k++) {
          const lane = lanes[k] || { right: -Infinity, height: 0, items: [] }
          const blocked = lanes.slice(0, k).flatMap((l) => l.items.map((o) => [o.x, o.x + o.it.w]))
          const lx = free(it, lane.right + GAP + 6, blocked)
          const fresh = k === lanes.length
          if (lx === null && !fresh) continue
          const at = lx === null ? it.l + 6 : lx
          const x = Math.max(0, Math.min(at - 6, W - it.w))
          if (!fresh && x < lane.right + GAP) continue
          if (fresh) lanes.push(lane)
          spot = { lane, x, lx: Math.min(Math.max(at, x + 4), x + it.w - 4) }
        }
        const o = { it, x: spot.x, lx: spot.lx, top: 0 }
        spot.lane.right = o.x + it.w
        spot.lane.height = Math.max(spot.lane.height, it.h)
        spot.lane.items.push(o)
        placed.push(o)
      }
      let top = band.bottom + GAP
      for (const lane of lanes) {
        for (const o of lane.items) o.top = top
        top += lane.height + 4
      }
      spots.push(...placed)
    }
    return spots
  }
  const hits = (a, list) => list.some((b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3])
  // An outline is a ring: something inside the box it outlines (a marker on a nested element) does
  // not cross it, only something that overlaps the ring's band does.
  const crosses = (a, rings) => rings.some(([o, i]) => hits(a, [o]) && !(a[0] >= i[0] && a[1] >= i[1] && a[2] <= i[2] && a[3] <= i[3]))
  const layout = (stage) => {
    const canvas = stage.querySelector('.canvas[data-w]')
    const notes = stage.querySelector('.notes')
    if (!canvas || !notes) return
    const W = canvas.clientWidth, H = canvas.clientHeight
    const kx = W / Number(canvas.dataset.w), ky = H / Number(canvas.dataset.h)
    const flat = decode(canvas.dataset.flat)
    const items = [...notes.querySelectorAll('.cluster')].map((el) => {
      const [x, y, w, h] = el.dataset.box.split(',').map(Number)
      const stack = el.querySelector('.stack')
      el.classList.remove('keyed', 'merged')
      const marker = canvas.querySelector('.marks>.key[data-i="' + el.dataset.i + '"]')
      if (marker) marker.classList.remove('keyed')
      // Measured at the left edge, so a stack placed near the right before is not measured narrow.
      stack.style.left = '0px'
      const l = x * kx, t = y * ky, r = (x + w) * kx, b = (y + h) * ky
      // The outline's outer edge: 3 px outside the box, its 2 px outline and the ink line.
      return { el, marker, sig: el.dataset.set, leader: el.querySelector('.leader'), key: el.querySelector('.key'), stack, side: el.hasAttribute('data-side'), l, t, r, b, ring: { l: l - 6, t: t - 6, r: r + 6, b: b + 6 }, w: Math.min(stack.offsetWidth, W), h: stack.offsetHeight }
    }).sort((a, b) => a.t - b.t || a.l - b.l)
    // Each outline as [outer edge, inner edge] (the mark's border sits 3 px outside the box).
    const rings = items.map((it) => [[it.ring.l, it.ring.t, it.ring.r, it.ring.b], [it.l - 2, it.t - 2, it.r + 2, it.b + 2]])
    // Covers nothing but one flat colour of the screenshot (below the image is the stage's paper).
    const flatAt = (x, y, w, h) => {
      if (!flat) return false
      const iy1 = Math.min((y + h) / ky, flat.rows * flat.cell)
      if (y / ky >= iy1) return true
      const c0 = Math.max(0, Math.floor(x / kx / flat.cell)), c1 = Math.min(flat.cols - 1, Math.ceil((x + w) / kx / flat.cell) - 1)
      const r0 = Math.max(0, Math.floor(y / ky / flat.cell)), r1 = Math.min(flat.rows - 1, Math.ceil(iy1 / flat.cell) - 1)
      const first = flat.cells[r0 * flat.cols + c0]
      if (first === '.') return false
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (flat.cells[r * flat.cols + c] !== first) return false
      return true
    }
    const keyed = new Set(flat ? [] : items)
    let spots = [], placed = []
    for (let round = 0; round <= 2 * items.length; round++) {
      spots = arrange(items.filter((it) => !keyed.has(it)), W)
      const noteRects = spots.map((s) => [s.x, s.top, s.x + s.it.w, s.top + s.it.h])
      // Markers in reading order, each on a flat spot clear of outlines, notes and other markers.
      placed = []
      let n = 0
      for (const it of items) {
        if (!keyed.has(it) || !it.marker) continue
        it.n = ++n
        it.marker.textContent = String(n)
        const size = { w: Math.max(KEY, it.marker.offsetWidth), h: KEY }
        const spot = markerSpot(it.ring, size, W, H, (x, y, w, h) => flatAt(x, y, w, h) && !crosses([x, y, x + w, y + h], rings) && !hits([x, y, x + w, y + h], [...noteRects, ...placed.map((p) => p.rect)]))
        placed.push({ it, x: spot.x, y: spot.y, rect: [spot.x, spot.y, spot.x + size.w, spot.y + size.h] })
      }
      const blocked = [...placed.map((p) => p.rect)]
      const bad = spots.filter((s) => {
        const rect = [s.x, s.top, s.x + s.it.w, s.top + s.it.h]
        return !flatAt(s.x, s.top, s.it.w, s.it.h) || hits(rect, blocked) || crosses(rect, rings)
      })
      if (bad.length === 0) break
      for (const s of bad) {
        // An "unexplained" note that does not fit beside its box tries under it first.
        if (s.side) s.it.notSide = true
        else keyed.add(s.it)
      }
    }
    let lowest = 0
    for (const { it, x, top, lx } of spots) {
      it.stack.style.left = x + 'px'
      it.stack.style.top = top + 'px'
      it.leader.style.left = (lx - 2) + 'px'
      it.leader.style.top = it.b + 'px'
      it.leader.style.height = Math.max(0, top - it.b) + 'px'
      lowest = Math.max(lowest, top + it.h)
    }
    for (const p of placed) {
      p.it.marker.classList.add('keyed')
      p.it.marker.style.left = p.x + 'px'
      p.it.marker.style.top = p.y + 'px'
    }
    // The list under the image: one entry per set of token changes ("1, 2"), its notes once.
    let top = Math.max(lowest, H) + GAP
    const listed = items.filter((it) => keyed.has(it))
    let n = 0
    for (const it of listed) if (!it.n) it.n = ++n; else n = it.n
    for (const group of groupKeys(listed)) {
      const [it, ...rest] = group.items
      for (const other of rest) other.el.classList.add('keyed', 'merged')
      it.el.classList.add('keyed')
      it.key.textContent = group.ns.join(', ')
      const kw = Math.max(KEY, it.key.offsetWidth)
      it.key.style.left = GAP + 'px'
      it.key.style.top = top + 'px'
      it.stack.style.left = (GAP + kw + GAP) + 'px'
      it.stack.style.top = top + 'px'
      top += Math.max(KEY, it.stack.offsetHeight) + GAP
      lowest = top - GAP
    }
    for (const it of items) { it.notSide = false; it.n = 0 }
    stage.style.setProperty('--room', Math.max(0, Math.ceil(lowest - H + GAP)) + 'px')
  }
  const all = () => { for (const stage of document.querySelectorAll('.stage')) layout(stage) }
  all()
  addEventListener('resize', all)
  document.fonts && document.fonts.ready.then(all)
})()
`

/** Before first paint: the theme (the stored choice, else the system preference) and `.js`. */
const THEME_BOOT = `(() => { const root = document.documentElement; root.classList.add('js'); let t = null; try { t = localStorage.getItem('dta-diff-theme') } catch {} if (!t && matchMedia('(prefers-color-scheme: dark)').matches) t = 'graphite'; if (t) root.dataset.brand = t })()`

const LOGO = `<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect x="11" y="3" width="18" height="18" rx="4" fill="var(--action-bg)"></rect><rect x="4" y="10" width="18" height="18" rx="4" fill="none" stroke="var(--fg-default)" stroke-width="2.5"></rect></svg>`

/**
 * The report page. `options.image` reads an image of the report folder by its path in
 * `result.json` (`head/…png`): with it, notes sit on a screenshot only where it is flat (see
 * `flat.ts`); without it every changed box gets a numbered marker and its notes are listed under
 * the image.
 */
export function renderReportHtml(
  result: DiffResult,
  options: { image?: (path: string) => Uint8Array | undefined } = {},
): string {
  const review = result.review
  const verdict = VERDICT[result.verdict ?? review?.verdict ?? 'pass']
  const byRef = new Map(result.stories.map((s) => [ref(s), s]))
  const changed = result.stories.filter((s) => s.status === 'changed')
  const unexplained = changed.filter((s) => !s.attribution?.explained)
  const addedRemoved = result.stories.filter((s) => s.status === 'added' || s.status === 'removed')
  const counts = result.tokens.counts
  const tokenTotal = counts.changed + counts.added + counts.removed
  const ctx: Context = {
    changes: changesById(result),
    before: baseInWords(result.base),
    after: headInWords(result.head),
    image: options.image,
  }

  const stat = (n: number, label: string) =>
    `<li><strong>${n}</strong><span class="meta">${label}</span></li>`
  const sections: string[] = []
  const toc: string[] = []
  const section = (id: string, title: string, body: string) => {
    toc.push(`<a href="#${id}">${escape(title)}</a>`)
    sections.push(
      `<section id="${id}" aria-labelledby="${id}-title"><h2 id="${id}-title">${escape(title)}</h2>${body}</section>`,
    )
  }

  if (review && review.tokens.length > 0) {
    section(
      'by-token',
      'By token change',
      `<div class="list">${review.tokens.map((g) => group(g, byRef, ctx)).join('\n')}</div>`,
    )
  }
  if (unexplained.length > 0) {
    section(
      'unexplained',
      'Unexplained',
      `<div class="list">${unexplained.map((s) => row(s, ctx)).join('\n')}</div>`,
    )
  }
  if (addedRemoved.length > 0) {
    section(
      'added',
      'Added and removed',
      `<div class="list">${addedRemoved.map((s) => row(s, ctx)).join('\n')}</div>`,
    )
  }
  const explained = changed.filter((s) => s.attribution?.explained)
  const shownInGroups = new Set((review?.tokens ?? []).flatMap((g) => g.stories.slice(0, SAMPLES)))
  const rest = explained.filter((s) => !shownInGroups.has(ref(s)))
  section(
    'stories',
    'All stories',
    storyTable(result) +
      (rest.length > 0
        ? `<details class="all"><summary>Every explained story (${rest.length} more)</summary><div class="list">${rest.map((s) => row(s, ctx)).join('\n')}</div></details>`
        : ''),
  )
  section('tokens', 'Token changes', changeTable(result))

  return `<!doctype html>
<html lang="en" data-brand="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>dta diff · ${escape(verdict.label)}</title>
<script>${THEME_BOOT}</script>
<style>${DRAFTING_TABLE_CSS}
${STYLE}</style>
</head>
<body>
<div class="page">
  <header class="masthead">
    <div class="mark-logo">${LOGO}<span>dta diff</span></div>
    <button type="button" class="theme" data-theme-toggle>Graphite</button>
  </header>
  <div class="intro">
    <p class="meta refs"><span>Before: ${escape(ctx.before)}</span><span>With this change: ${escape(ctx.after)}</span></p>
    <h1>${escape(verdict.label)}</h1>
    <p>${chip(verdict.tone, verdict.label)}</p>
    <ul class="stats">
      ${stat(tokenTotal, 'tokens changed')}
      ${stat(changed.length, 'stories changed')}
      ${stat(review?.explained ?? 0, 'explained by tokens')}
      ${stat(unexplained.length, 'unexplained')}
      ${stat(addedRemoved.length, 'added or removed')}
    </ul>
    <nav class="toc" aria-label="Sections">${toc.join('')}</nav>
  </div>
  ${sections.join('\n')}
  <footer>Rendered by <code>dta diff</code> · schema <code>${escape(result.schema)}</code> · <a href="result.json">result.json</a> · <a href="summary.md">summary.md</a></footer>
</div>
<script>${SCRIPT}</script>
</body>
</html>
`
}
