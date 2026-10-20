import type { DiffResult } from '../result-schema.js'
import { DRAFTING_TABLE_CSS } from './tokens-css.js'

/**
 * The review report (`index.html` in the report folder): one static page with relative links
 * only, styled with the DTA Drafting Table tokens. Explained changes are grouped by token
 * change (samples and a contact sheet), unexplained ones are listed one by one, and every
 * changed story has baseline, candidate, diff and a drag-to-compare slider.
 */

type Story = DiffResult['stories'][number]
type Group = NonNullable<DiffResult['review']>['tokens'][number]
type State = Group['before']

const SAMPLES = 2

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
 * square); "changes to review" is a diff state, not a problem, and keeps the action tint.
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

const chip = (tone: string, text: string) => `<span class="chip ${tone}">${escape(text)}</span>`

function cause(story: Story) {
  if (story.status !== 'changed') return ''
  const a = story.attribution
  if (!a) return chip('fail', 'unexplained')
  const tokens = a.tokens.map((t) => chip('token', shortToken(t.id))).join('')
  return a.explained ? tokens : `${chip('fail', 'unexplained')}${tokens}`
}

/** Absolutely placed marks over the image, in % of the compared canvas. */
function marks(story: Story) {
  const a = story.attribution
  if (!a || a.canvas.width === 0 || a.canvas.height === 0) return ''
  const box = (r: { x: number; y: number; width: number; height: number }) =>
    `left:${((r.x / a.canvas.width) * 100).toFixed(3)}%;top:${((r.y / a.canvas.height) * 100).toFixed(3)}%;width:${((r.width / a.canvas.width) * 100).toFixed(3)}%;height:${((r.height / a.canvas.height) * 100).toFixed(3)}%`
  const tokenMarks = a.tokens
    .filter((t) => t.regions.length > 0)
    .map(
      (t) =>
        `<span class="mark" style="${box(t.regions[0])}"><span class="tag">${escape(shortToken(t.id))}</span></span>`,
    )
  const unexplained = a.unexplainedRegion
    ? [
        `<span class="mark unexplained" style="${box(a.unexplainedRegion)}"><span class="tag">unexplained</span></span>`,
      ]
    : []
  return tokenMarks.concat(unexplained).join('')
}

function thumbs(story: Story) {
  const cell = (label: string, src: string | undefined) =>
    src
      ? `<figure><a href="${escape(src)}"><img src="${escape(src)}" alt="${escape(`${label} of ${ref(story)}`)}" loading="lazy"></a><figcaption>${label}</figcaption></figure>`
      : `<figure class="missing"><div>not rendered</div><figcaption>${label}</figcaption></figure>`
  return `<div class="thumbs">${cell('baseline', story.images.base)}${cell('candidate', story.images.head)}${cell(`diff ${percent(story.ratio)}`, story.images.diff)}</div>`
}

/** Baseline, candidate, diff and the drag-to-compare slider for one story × viewport. */
function compare(story: Story) {
  const { base, head, diff } = story.images
  const slider =
    base && head
      ? `<div class="slider" data-slider>
  <div class="stage">
    <img class="under" src="${escape(base)}" alt="">
    <div class="over"><img src="${escape(head)}" alt=""></div>
    ${diff ? `<img class="diff-layer" src="${escape(diff)}" alt="">` : ''}
    <div class="marks">${marks(story)}</div>
    <span class="handle" aria-hidden="true"></span>
  </div>
  <div class="controls">
    <span class="meta">baseline</span>
    <input type="range" min="0" max="100" value="50" aria-label="${escape(`Divider between baseline (left) and candidate (right) of ${ref(story)}, in percent`)}">
    <span class="meta">candidate</span>
    ${diff ? '<label class="toggle"><input type="checkbox" data-diff> diff overlay</label>' : ''}
  </div>
</div>`
      : ''
  return `<article class="story" id="${storyAnchor(story)}">
  <header>
    <h4><code>${escape(story.id)}</code> <span class="dim">${story.viewport}px</span></h4>
    <div class="causes">${chip(story.status, story.status)}${cause(story)}</div>
  </header>
  ${thumbs(story)}
  ${slider}
</article>`
}

function group(g: Group, stories: Map<string, Story>) {
  const members = g.stories.map((s) => stories.get(s)).filter((s): s is Story => Boolean(s))
  const samples = members.slice(0, SAMPLES)
  const sheet = members.length > SAMPLES ? members : []
  return `<article class="group" id="${anchor('token', g.id)}">
  <header>
    <div class="token-title">
      <span class="tag big">${escape(shortToken(g.id))}</span>
      <span class="meta">${escape(layerOf(g.id))}</span>
    </div>
    <p class="change">${value(g.before)} <span class="arrow">→</span> ${value(g.after)}</p>
    <p class="explains">Explains <strong>${members.length}</strong> ${members.length === 1 ? 'story' : 'stories'} ${g.needsReview ? chip('review', 'to review') : chip('pass', 'below threshold')}</p>
  </header>
  <div class="samples">${samples.map(compare).join('\n')}</div>
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

function tokenTable(result: DiffResult) {
  const rows = result.tokens.changes.map(
    (c) =>
      `<tr><td>${chip(c.kind, c.kind)}</td><td><code>${escape(c.name)}</code></td><td class="dim">${escape(`${c.collection} · ${c.mode}`)}</td><td>${value(c.before)}</td><td>${value(c.after)}</td></tr>`,
  )
  return rows.length === 0
    ? '<p class="empty">No token changes.</p>'
    : `<div class="table"><table><thead><tr><th>Kind</th><th>Token</th><th>Collection · mode</th><th>Before</th><th>After</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
}

function storyTable(result: DiffResult) {
  const rows = result.stories.map(
    (s) =>
      `<tr><td>${s.status === 'unchanged' ? `<code>${escape(s.id)}</code>` : `<a href="#${storyAnchor(s)}"><code>${escape(s.id)}</code></a>`}</td><td>${s.viewport}px</td><td>${chip(s.status, s.status)}</td><td>${s.status === 'changed' || s.status === 'unchanged' ? percent(s.ratio) : '—'}</td><td>${cause(s)}</td></tr>`,
  )
  return `<div class="table"><table><thead><tr><th>Story</th><th>Viewport</th><th>Status</th><th>Changed</th><th>Cause</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
}

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
a:focus-visible,button:focus-visible,input:focus-visible{outline:var(--stroke-focus) solid var(--action-bg);outline-offset:2px}
.intro{display:grid;gap:var(--space-4)}
.lede{margin:0;color:var(--fg-muted);max-width:68ch}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-2);margin:0;padding:0;list-style:none}
.stats li{padding:var(--space-4);border:var(--stroke-hairline) solid var(--border-default);border-radius:var(--radius-md);background:var(--bg-surface)}
.stats strong{display:block;font-size:calc(var(--type-heading-size)*1px);line-height:1}
nav.toc{display:flex;flex-wrap:wrap;gap:var(--space-2)}
nav.toc a{padding:6px 12px;border:var(--stroke-hairline) solid var(--border-default);border-radius:var(--radius-full);background:var(--bg-surface);color:var(--fg-default);text-decoration:none;font-size:calc(var(--type-body-sm-size)*1px)}
.chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:var(--radius-full);font-family:var(--font-mono);font-size:calc(var(--type-meta-size)*1px);background:var(--bg-subtle);color:var(--fg-muted);white-space:nowrap}
.chip.pass,.chip.unchanged{background:var(--status-success-subtle);color:var(--status-success-text)}
.chip.review,.chip.changed,.chip.added,.chip.affected{background:var(--action-subtle);color:var(--action-text)}
.chip.removed{background:var(--signal-subtle);color:var(--signal-text)}
.chip.fail{background:var(--status-error-subtle);color:var(--status-error-text)}
.chip.pass::before,.chip.unchanged::before,.chip.fail::before{content:"";flex:none;width:6px;height:6px;margin-right:6px;border-radius:var(--radius-full);background:var(--status-success-marker)}
.chip.fail::before{border-radius:0;background:var(--status-error-marker)}
.chip.token{background:var(--signal-bg);color:var(--signal-fg);border-radius:4px}
.verdict{font-size:calc(var(--type-body-sm-size)*1px);padding:6px 14px}
.theme{min-height:44px;padding:0 16px;border:var(--stroke-ink) solid var(--border-strong);border-radius:var(--radius-md);background:transparent;color:var(--fg-default);font:inherit;font-weight:var(--type-label-weight);cursor:pointer}
.group,.story,.panel{border:var(--stroke-hairline) solid var(--border-default);border-radius:var(--radius-lg);background:var(--bg-surface);min-width:0}
.group{padding:var(--space-6);display:grid;grid-template-columns:minmax(0,1fr);gap:var(--space-6)}
@media (max-width:640px){.group{padding:var(--space-4)}.story{padding:var(--space-3)}}
.group>header{display:grid;gap:var(--space-2)}
.token-title{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3)}
.tag{display:inline-block;padding:2px 6px;border-radius:4px;background:var(--signal-bg);color:var(--signal-fg);font-family:var(--font-mono);font-size:calc(var(--type-redline-size)*1px);line-height:var(--type-redline-line-height);white-space:nowrap}
.tag.big{font-size:calc(var(--type-code-size)*1px);padding:4px 10px}
.change,.explains{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-2)}
.arrow{color:var(--signal-bg);font-weight:700}
.value{display:inline-flex;align-items:center;gap:6px}
.swatch{width:18px;height:18px;border-radius:4px;border:var(--stroke-hairline) solid var(--border-default);flex:none}
.samples,.list,.slider{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--space-4)}
.page>*,.group>*,.story>*,.samples>*,.list>*{min-width:0}
.story{padding:var(--space-4);display:grid;grid-template-columns:minmax(0,1fr);gap:var(--space-4);background:var(--bg-canvas)}
.group .story{background:var(--bg-canvas)}
.story>header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:var(--space-2)}
.causes{display:flex;flex-wrap:wrap;gap:6px}
.thumbs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-2)}
.thumbs figure{margin:0;min-width:0}
.thumbs img{display:block;width:100%;height:120px;object-fit:cover;object-position:top left;border-radius:var(--radius-sm);border:var(--stroke-hairline) solid var(--border-default);background:var(--bg-surface)}
.thumbs .missing div{height:120px;display:grid;place-items:center;border-radius:var(--radius-sm);border:var(--stroke-hairline) dashed var(--border-default);color:var(--fg-subtle);font-size:calc(var(--type-body-sm-size)*1px)}
figcaption{margin-top:6px;font-family:var(--font-mono);font-size:calc(var(--type-redline-size)*1px);color:var(--fg-subtle)}
.slider{gap:var(--space-2)}
.stage{position:relative;overflow:hidden;border-radius:var(--radius-md);border:var(--stroke-hairline) solid var(--border-default);background:var(--bg-surface);--pos:50%}
.stage img{display:block;width:100%;height:auto}
.stage .over{position:absolute;inset:0;clip-path:inset(0 0 0 var(--pos))}
.stage .diff-layer{position:absolute;inset:0;opacity:0;pointer-events:none}
.slider.show-diff .diff-layer{opacity:1}
.stage .handle{position:absolute;top:0;bottom:0;left:var(--pos);width:0;border-left:var(--stroke-redline) solid var(--signal-bg)}
.marks{position:absolute;inset:0;pointer-events:none}
.mark{position:absolute;outline:var(--stroke-redline) solid var(--signal-bg);outline-offset:2px;border-radius:2px}
.mark.unexplained{outline-style:dashed}
.mark .tag{position:absolute;left:-2px;top:-22px}
.controls{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3)}
.controls input[type=range]{flex:1 1 200px;accent-color:var(--signal-bg);min-height:44px}
.toggle{display:inline-flex;align-items:center;gap:6px;font-size:calc(var(--type-body-sm-size)*1px)}
.sheet{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-2)}
.sheet a{display:grid;gap:4px;text-decoration:none;color:var(--fg-default);font-size:calc(var(--type-body-sm-size)*1px)}
.sheet img{width:100%;height:100px;object-fit:cover;object-position:top left;border-radius:var(--radius-sm);border:var(--stroke-hairline) solid var(--border-default);background:var(--bg-surface)}

details.all>summary{cursor:pointer;font-weight:var(--type-label-weight);min-height:44px;display:flex;align-items:center}
.table{overflow-x:auto;border:var(--stroke-hairline) solid var(--border-default);border-radius:var(--radius-md);background:var(--bg-surface)}
table{border-collapse:collapse;width:100%;font-size:calc(var(--type-body-sm-size)*1px)}
th,td{padding:10px 12px;text-align:left;border-bottom:var(--stroke-hairline) solid var(--border-default);vertical-align:middle}
th{font-family:var(--font-mono);font-weight:400;font-size:calc(var(--type-meta-size)*1px);color:var(--fg-subtle);text-transform:uppercase;letter-spacing:var(--type-meta-letter-spacing)}
tr:last-child td{border-bottom:0}
.empty{margin:0;color:var(--fg-subtle)}
footer{color:var(--fg-subtle);font-size:calc(var(--type-body-sm-size)*1px)}
@media (max-width:640px){.thumbs img,.thumbs .missing div{height:72px}}
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
  for (const slider of document.querySelectorAll('[data-slider]')) {
    const stage = slider.querySelector('.stage')
    const range = slider.querySelector('input[type=range]')
    range.addEventListener('input', () => stage.style.setProperty('--pos', range.value + '%'))
    const diff = slider.querySelector('[data-diff]')
    diff && diff.addEventListener('change', () => slider.classList.toggle('show-diff', diff.checked))
  }
})()
`

/** Sets the theme before first paint: the stored choice, else the system preference. */
const THEME_BOOT = `(() => { let t = null; try { t = localStorage.getItem('dta-diff-theme') } catch {} if (!t && matchMedia('(prefers-color-scheme: dark)').matches) t = 'graphite'; if (t) document.documentElement.dataset.brand = t })()`

const LOGO = `<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect x="11" y="3" width="18" height="18" rx="4" fill="var(--action-bg)"></rect><rect x="4" y="10" width="18" height="18" rx="4" fill="none" stroke="var(--fg-default)" stroke-width="2.5"></rect></svg>`

export function renderReportHtml(result: DiffResult): string {
  const review = result.review
  const verdict = VERDICT[result.verdict ?? review?.verdict ?? 'pass']
  const byRef = new Map(result.stories.map((s) => [ref(s), s]))
  const changed = result.stories.filter((s) => s.status === 'changed')
  const unexplained = changed.filter((s) => !s.attribution?.explained)
  const addedRemoved = result.stories.filter((s) => s.status === 'added' || s.status === 'removed')
  const counts = result.tokens.counts
  const tokenTotal = counts.changed + counts.added + counts.removed

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
      `<div class="list">${review.tokens.map((g) => group(g, byRef)).join('\n')}</div>`,
    )
  }
  if (unexplained.length > 0) {
    section(
      'unexplained',
      'Unexplained',
      `<p class="lede">No changed token accounts for these pixels: a component, content or layout change. The dashed box marks where.</p><div class="list">${unexplained.map(compare).join('\n')}</div>`,
    )
  }
  if (addedRemoved.length > 0) {
    section(
      'added',
      'Added and removed',
      `<div class="list">${addedRemoved.map(compare).join('\n')}</div>`,
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
        ? `<details class="all"><summary>Every explained story (${rest.length} more)</summary><div class="list">${rest.map(compare).join('\n')}</div></details>`
        : ''),
  )
  section('tokens', 'Token changes', tokenTable(result))

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
    <span class="meta">Base · ${escape(result.base)}</span>
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
