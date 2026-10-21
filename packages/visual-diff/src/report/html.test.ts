import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { diffResultSchema, renderReportHtml, type DiffResult } from '../index.js'

const region = { x: 10, y: 20, width: 100, height: 40 }
const result: DiffResult = diffResultSchema.parse({
  schema: 'dta.diff/1',
  base: 'merge base with origin/main (1a2b3c4)',
  verdict: 'fail',
  review: {
    verdict: 'fail',
    changed: 4,
    explained: 3,
    tokens: [
      {
        id: 'action.bg (Theme · Light)',
        before: { raw: '{blueprint.600}', resolved: '#2f55d4' },
        after: { raw: '{blueprint.700}', resolved: '#2443ac' },
        stories: ['button@1280', 'card@1280', 'rail@1280'],
        needsReview: true,
      },
    ],
    unexplained: [{ story: 'chip<x>@1280', ratio: 0.01, pixels: 9, region, failing: true }],
    added: ['new@1280'],
    removed: [],
  },
  tokens: {
    counts: { changed: 1, added: 0, removed: 0, affected: 0 },
    changes: [
      {
        kind: 'changed',
        collection: 'Theme',
        mode: 'Light',
        name: 'action.bg',
        type: 'color',
        before: { raw: '{blueprint.600}', resolved: '#2f55d4' },
        after: { raw: '{blueprint.700}', resolved: '#2443ac' },
      },
    ],
  },
  stories: [
    ...['button', 'card', 'rail'].map((id) => ({
      id,
      title: id,
      url: `/stories/${id}/`,
      viewport: 1280,
      status: 'changed',
      ratio: 0.02,
      changedPixels: 200,
      images: {
        base: `base/${id}@1280.png`,
        head: `head/${id}@1280.png`,
        diff: `diff/${id}@1280.png`,
      },
      attribution: {
        explained: true,
        tokens: [
          {
            id: 'action.bg (Theme · Light)',
            dependents: 1,
            pixels: 200,
            elements: ['button.primary'],
            regions: [region],
          },
        ],
        unexplainedPixels: 0,
        canvas: { width: 400, height: 200 },
      },
    })),
    {
      id: 'chip<x>',
      title: 'chip',
      url: '/stories/chip/',
      viewport: 1280,
      status: 'changed',
      ratio: 0.01,
      changedPixels: 9,
      images: { base: 'base/chip.png', head: 'head/chip.png', diff: 'diff/chip.png' },
      attribution: {
        explained: false,
        tokens: [],
        unexplainedPixels: 9,
        unexplainedRegion: region,
        canvas: { width: 400, height: 200 },
      },
    },
    {
      id: 'new',
      title: 'new',
      url: '/stories/new/',
      viewport: 1280,
      status: 'added',
      ratio: 1,
      changedPixels: 0,
      images: { head: 'head/new@1280.png' },
    },
    {
      id: 'text',
      title: 'text',
      url: '/stories/text/',
      viewport: 1280,
      status: 'unchanged',
      ratio: 0,
      changedPixels: 0,
      images: { base: 'base/text@1280.png', head: 'head/text@1280.png' },
    },
  ],
})

const html = renderReportHtml(result)

describe('renderReportHtml', () => {
  it('is one static page styled with the Drafting Table tokens, light and Graphite', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="en" data-brand="light">')
    expect(html).toContain('[data-brand="light"]')
    expect(html).toContain('[data-brand="graphite"]')
    expect(html).toContain('--action-bg:')
    expect(html).toContain('data-theme-toggle')
    expect(html).toContain('<title>dta diff · Unexplained changes</title>')
  })

  it('uses relative links only (works from disk and on any static host)', () => {
    const urls = [...html.matchAll(/(?:src|href)="([^"]*)"/g)].map((m) => m[1])
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) expect(url).not.toMatch(/^(\/|[a-z]+:)/i)
    expect(html).not.toMatch(/@import|url\(\s*["']?(https?:|\/)/)
  })

  it('groups explained stories by token change with samples and a contact sheet', () => {
    const group = html.slice(html.indexOf('id="by-token"'), html.indexOf('id="unexplained"'))
    expect(group).toContain(
      '<span class="tag big" data-contrast-exception="redline label">action.bg</span>',
    )
    expect(group).toContain('Theme · Light')
    expect(group).toContain('style="background:#2f55d4"')
    expect(group).toContain('Explains <strong>3</strong> stories')
    expect(group.match(/class="story"/g)).toHaveLength(2) // samples
    expect(group).toContain('Contact sheet · 3 stories')
    expect(group).toContain('href="#story-rail-1280"')
  })

  /** One story row (`<article class="story" id="…">…</article>`) of a page. */
  const rowOf = (page: string, id: string) => {
    const from = page.indexOf(`<article class="story" id="${id}">`)
    expect(from, id).toBeGreaterThan(-1)
    return page.slice(from, page.indexOf('</article>', from))
  }

  // TICKET-109: only "after" with the change outlined and named, "Show before" swaps in place.
  it('shows a changed story as "after" with outlines, notes, a token table and the whole images', () => {
    const row = rowOf(html, 'story-button-1280')
    expect(row).toContain(
      '<h4 id="story-button-1280-title"><code>button</code> <span class="dim">1280 px · 2.00% changed</span></h4>',
    )
    expect(row).toContain(
      '<span class="chip changed">changed</span><span class="chip explained">explained</span>',
    )
    // "With this change" shown; "Before this change" with the base ref and sha in the same cell.
    expect(row).toContain(
      '<p class="side" aria-live="polite"><span class="swap"><span class="when-after"><strong>With this change</strong> <span class="side-meta">working tree</span></span><span class="when-before"><strong>Before this change</strong> <span class="side-meta">main · 1a2b3c4</span></span></span></p>',
    )
    // Both images in one place: after shown, before hidden until asked for; no diff overlay.
    expect(row).toContain(
      '<img class="shot after" src="head/button@1280.png" alt="button@1280 with this change" loading="lazy">',
    )
    expect(row).toContain(
      '<img class="shot before" src="base/button@1280.png" alt="button@1280 before this change" loading="lazy">',
    )
    expect(row).not.toContain('class="shot overlay"')
    // Cropped 48 px below the lowest changed box (20 + 40 + 48 = 108 of 200), marks in % of it.
    expect(row).toContain(
      'style="aspect-ratio:400 / 108;max-width:400px" data-w="400" data-h="108"',
    )
    expect(row).toContain(
      '<span class="mark" data-i="0" style="left:calc(2.500% - 3px);top:calc(18.519% - 3px);width:calc(25.000% + 6px);height:calc(37.037% + 6px)"></span><span class="key" data-i="0" data-contrast-exception="redline label"></span>',
    )
    // The note: token and its change (colours as the alias step), joined to its box by a leader.
    expect(row).toContain(
      '<span class="cluster" data-i="0" data-set="action.bg (Theme · Light)" data-box="10,20,100,40"><span class="leader" aria-hidden="true"></span><span class="key" aria-hidden="true" data-contrast-exception="redline label"></span><span class="stack"><span class="note" data-contrast-exception="redline label"><span class="note-token">action.bg</span><span class="note-sep"> · </span><span class="note-change">blueprint 600 → 700</span></span></span></span>',
    )
    // The table: token, before, with this change (each with its ref), what it outlines.
    expect(row).toContain('<caption class="meta">Explained by 1 token</caption>')
    expect(row).toContain(
      '<th scope="col">Explained by</th><th scope="col"><span class="col-word">Before</span><span class="col-ref">main · 1a2b3c4</span></th><th scope="col"><span class="col-word">With this change</span><span class="col-ref">working tree</span></th><th scope="col">Outlined</th>',
    )
    expect(row).toContain('<td data-label="Before"><span class="value">')
    expect(row).toContain('<td data-label="With this change"><span class="value">')
    expect(row).toContain('<td data-label="Outlined"><span><code>button.primary</code></span></td>')
    expect(row).toContain('style="background:#2443ac"')
    expect(row).toContain(
      '<p class="whole">Whole images: <a href="base/button@1280.png">before</a> <a href="head/button@1280.png">after</a> <a href="diff/button@1280.png">diff</a></p>',
    )
  })

  // TICKET-123 item 4: notes on the image only where it is flat, else a numbered marker and a list.
  it('gives the script a flat map of the shown image when it can read it, else none', () => {
    const paper = new PNG({ width: 400, height: 200 })
    for (let i = 0; i < paper.data.length; i += 4) paper.data.set([245, 241, 232, 255], i)
    const read: string[] = []
    const page = renderReportHtml(result, {
      image: (path) => {
        read.push(path)
        return new Uint8Array(PNG.sync.write(paper))
      },
    })
    // The "after" image, cropped like the canvas (108 of 200 rows: 27 cells of 4 px).
    expect(read).toContain('head/button@1280.png')
    expect(rowOf(page, 'story-button-1280')).toContain('data-h="108" data-flat="4;100;27;A2700"')
    // No image (or one that cannot be read): no map, so the script lists every note.
    expect(html).not.toContain('data-flat=')
    expect(renderReportHtml(result, { image: () => new Uint8Array([1, 2, 3]) })).not.toContain(
      'data-flat=',
    )
    // The script: notes only where the cells under them are one flat colour, else marker + list.
    expect(html).toContain('const keyed = new Set(flat ? [] : items)')
    expect(html).toContain('rle.matchAll(/([A-Za-z.])(\\d+)/g)')
    // Markers and list keys: hidden until the script keys a box; "Show before" hides the marks
    // and notes layer (and so the markers and the list) without removing them.
    expect(html).toContain(
      '.marks>.key.keyed,html.js .cluster.keyed:not(.merged)>.key{display:block}',
    )
    // Marker placement and list grouping: the tested functions (placement.test.ts), verbatim.
    expect(html).toContain('function markerSpot(ring, size, W, H, ok)')
    expect(html).toContain('function groupKeys(items)')
    expect(html).toContain('.view[data-before] .marks,.view[data-before] .notes{visibility:hidden}')
  })

  it('has no thumbnails and no slider any more', () => {
    expect(html).not.toContain('type="range"')
    expect(html).not.toMatch(/class="(thumbs|slider|stage-handle|handle)"/)
    expect(html).not.toMatch(/data-slider|\.thumbs|\.slider|--pos/)
    expect(html).not.toContain('<figure')
  })

  it('"Show before" is a real toggle button: box, tick and on/off word, aria-pressed', () => {
    const row = rowOf(html, 'story-button-1280')
    expect(row.match(/<button /g)).toHaveLength(1) // explained: no overlay toggle
    expect(row).toContain(
      '<button type="button" class="toggle" data-toggle="before" aria-pressed="false" aria-label="Show before" aria-describedby="story-button-1280-title"><span class="box" aria-hidden="true"><svg',
    )
    expect(row).toContain(
      '<span class="word">Show before</span><span class="state">off</span></button>',
    )
    // Hidden but in place (visibility, not display): no layout shift when toggling.
    expect(html).toContain('.view[data-before] .shot.before{visibility:visible}')
    expect(html).toContain(
      '.view[data-before] .shot.after,.view[data-before] .shot.overlay,.view[data-before] .marks,.view[data-before] .notes{visibility:hidden}',
    )
    expect(html).not.toMatch(/\[data-before\][^{]*\{[^}]*display:none/)
    // The script flips aria-pressed, the word and data-before; the label follows in CSS.
    expect(html).toContain("toggle.setAttribute('aria-pressed', String(on))")
    expect(html).toContain("view.toggleAttribute('data-before', on)")
    expect(html).toContain('.when-before,.view[data-before] .when-after{visibility:hidden}')
  })

  it('works without JavaScript: "after" and the links stay, the toggles are left out', () => {
    expect(html).toContain("root.classList.add('js')")
    expect(html).toContain('html:not(.js) .toggles{display:none}')
    // Notes line up under the image without the script; with it they sit under their boxes.
    expect(html).toContain('.notes{display:flex;flex-wrap:wrap;')
    expect(html).toContain('html.js .notes{position:absolute;')
    expect(html).not.toMatch(/https?:\/\//)
  })

  it('marks outlines, leaders and notes with a 1 px ink line around the signal', () => {
    expect(html).toContain(
      '.mark{position:absolute;border:var(--stroke-hairline) solid var(--ink-900);outline:var(--stroke-ink) solid var(--signal-bg);border-radius:2px}\n.mark:not(.unexplained){box-shadow:0 0 0 3px var(--ink-900)}',
    )
    expect(html).toMatch(
      /html\.js \.leader\{[^}]*background:var\(--signal-bg\);border-left:var\(--stroke-hairline\) solid var\(--ink-900\)/,
    )
    expect(html).toMatch(/\n\.note\{[^}]*border:var\(--stroke-hairline\) solid var\(--ink-900\)/)
  })

  it('stacks the notes of tokens that change the same box; sizes show the resolved numbers', () => {
    const story = result.stories[0]
    const token = (id: string, regions = [region]) => ({
      id,
      dependents: 1,
      pixels: 200,
      elements: ['span.button'],
      regions,
    })
    const page = renderReportHtml({
      ...result,
      review: {
        ...result.review!,
        tokens: [
          {
            id: 'Colors.Brand.Primary (Brand · OrbitBurger)',
            before: { raw: '{Nova.500}', resolved: '#5aa2ff' },
            after: { raw: '{Nova.600}', resolved: '#3d87e8' },
            stories: [],
            needsReview: true,
          },
          {
            id: 'Radius.Card (Brand · OrbitBurger)',
            before: { raw: '{Orbit.radius-sm}', resolved: 8 },
            after: { raw: '{Orbit.radius-lg}', resolved: 24 },
            stories: [],
            needsReview: true,
          },
        ],
      },
      stories: [
        {
          ...story,
          attribution: {
            explained: true,
            tokens: [
              token('Colors.Brand.Primary (Brand · OrbitBurger)'),
              token('Radius.Card (Brand · OrbitBurger)', [
                { x: 0, y: 0, width: 200, height: 120 },
                region,
              ]),
            ],
            unexplainedPixels: 0,
            canvas: { width: 400, height: 200 },
          },
        },
      ],
    })
    const note = (name: string, change: string) =>
      `<span class="note" data-contrast-exception="redline label"><span class="note-token">${name}</span><span class="note-sep"> · </span><span class="note-change">${change}</span></span>`
    // One cluster per box: the button has both notes, the card only the radius.
    expect(page).toContain(
      `<span class="cluster" data-i="0" data-set="Colors.Brand.Primary (Brand · OrbitBurger)|Radius.Card (Brand · OrbitBurger)" data-box="10,20,100,40"><span class="leader" aria-hidden="true"></span><span class="key" aria-hidden="true" data-contrast-exception="redline label"></span><span class="stack">${note('Colors.Brand.Primary', 'Nova 500 → 600')}${note('Radius.Card', '8 → 24')}</span></span>`,
    )
    expect(page).toContain(
      `<span class="cluster" data-i="1" data-set="Radius.Card (Brand · OrbitBurger)" data-box="0,0,200,120"><span class="leader" aria-hidden="true"></span><span class="key" aria-hidden="true" data-contrast-exception="redline label"></span><span class="stack">${note('Radius.Card', '8 → 24')}</span></span>`,
    )
    expect((page.match(/<span class="mark"/g) ?? []).length).toBe(2)
    // A palette change keeps both names: navy to sky.
    const other = renderReportHtml({
      ...result,
      review: {
        ...result.review!,
        tokens: [
          {
            ...result.review!.tokens[0],
            before: { raw: '{Colors.Foundation.Navy.700}', resolved: '#2c4466' },
            after: { raw: '{Colors.Foundation.Sky.500}', resolved: '#3b8fd9' },
          },
        ],
      },
    })
    expect(other).toContain('<span class="note-change">Navy 700 → Sky 500</span>')
  })

  it('unexplained rows: diff overlay on, dashed outline, "unexplained · no token", "Show before" beside', () => {
    const section = html.slice(html.indexOf('id="unexplained"'), html.indexOf('id="added"'))
    expect(section).toContain('<code>chip&lt;x&gt;</code>')
    expect(html).not.toContain('chip<x>')
    const row = rowOf(html, 'story-chip-x-1280')
    expect(row).toContain('<div class="view" data-overlay>')
    expect(row).toContain('<img class="shot overlay" src="diff/chip.png" alt="">')
    expect(row).toContain(
      '<span class="chip changed">changed</span><span class="chip fail">unexplained</span>',
    )
    const buttons = [...row.matchAll(/<button [^>]*data-toggle="(\w+)" aria-pressed="(\w+)"/g)]
    expect(buttons.map(([, kind, pressed]) => [kind, pressed])).toEqual([
      ['overlay', 'true'],
      ['before', 'false'],
    ])
    expect(row).toContain('<span class="word">Diff overlay</span><span class="state">on</span>')
    expect(row).toContain('<span class="mark unexplained"')
    expect(row).toContain(
      '<span class="note unexplained"><span class="note-token">unexplained</span><span class="note-sep"> · </span><span class="note-change">no token</span></span>',
    )
    expect(html).toContain('.mark.unexplained{border-style:dashed;outline-style:dashed}')
    expect(html).toContain('.view[data-overlay] .shot.overlay{visibility:visible}')
    expect(row).toContain('<p class="why">No changed token accounts for these pixels')
    expect(row).not.toContain('class="tokens-explained"')
  })

  it('shows added stories on their one side without toggles, and lists every story with its cause', () => {
    const added = rowOf(html, 'story-new-1280')
    expect(added).toContain(
      '<span><strong>With this change</strong> <span class="side-meta">new story</span></span>',
    )
    expect(added).toContain('src="head/new@1280.png"')
    expect(added).not.toContain('<button')
    expect(added).toContain(
      '<p class="whole">Whole images: <a href="head/new@1280.png">after</a></p>',
    )
    const table = html.slice(html.indexOf('id="stories"'), html.indexOf('id="tokens"'))
    expect(table).toContain('<code>text</code>')
    expect(table).toContain('Every explained story (1 more)')
  })

  it('names the base in words: ref and short sha, only the sha, or the directory', () => {
    const meta = (base: string) => {
      const page = renderReportHtml({ ...result, base })
      return /<span class="when-before"><strong>Before this change<\/strong> <span class="side-meta">([^<]*)<\/span>/.exec(
        page,
      )?.[1]
    }
    expect(meta('merge base with origin/main (1a2b3c4)')).toBe('main · 1a2b3c4')
    expect(meta('release/2.0 (9f8e7d6)')).toBe('release/2.0 · 9f8e7d6')
    expect(meta('617cea0b23ea7f17a023113c641dd16ab7e231f6 (617cea0)')).toBe('617cea0')
    expect(meta('tokens-base')).toBe('tokens-base')
    // No "After · head" / "Before · base" (git words) anywhere.
    expect(html).not.toMatch(/After · head|Before · base|After only|Before only/)
  })

  // TICKET-123: the head from result.json, the same strings in every place that names a side.
  const head = {
    ref: 'feature/x',
    sha: '9f3c1a2b4d5e6f708192a3b4c5d6e7f8091a2b3c',
    uncommitted: false,
  }
  it('names the head by branch and short hash in the heading, the table and the intro', () => {
    const page = renderReportHtml({ ...result, head })
    const row = rowOf(page, 'story-button-1280')
    expect(row).toContain(
      '<span class="when-after"><strong>With this change</strong> <span class="side-meta">feature/x · 9f3c1a2</span></span>',
    )
    expect(row).toContain(
      '<span class="col-word">With this change</span><span class="col-ref">feature/x · 9f3c1a2</span>',
    )
    expect(page).toContain(
      '<p class="meta refs"><span>Before: main · 1a2b3c4</span><span>With this change: feature/x · 9f3c1a2</span></p>',
    )
    const dirty = renderReportHtml({ ...result, head: { ...head, uncommitted: true } })
    expect(rowOf(dirty, 'story-button-1280')).toContain(
      '<span class="side-meta">feature/x · 9f3c1a2 + uncommitted changes</span>',
    )
    const detached = renderReportHtml({ ...result, head: { sha: head.sha, uncommitted: false } })
    expect(rowOf(detached, 'story-button-1280')).toContain('<span class="col-ref">9f3c1a2</span>')
    // Without head (older results, outside git) it still renders: "working tree".
    expect(html).toContain('<span>With this change: working tree</span>')
  })

  it('shows no base/head words: text, alt texts and labels say "Before" and "With this change"', () => {
    for (const page of [html, renderReportHtml({ ...result, head })]) {
      // What a reader sees or hears: text outside style and script, alt and aria labels, and
      // the phone list's labels (data-label, shown through CSS). Class names, ids and image
      // paths (base/…, head/…) are not words on the page.
      const body = page.slice(page.indexOf('<body>')).replace(/<script>[\s\S]*?<\/script>/g, '')
      const attributes = [...body.matchAll(/\b(?:alt|aria-label|title|data-label)="([^"]*)"/g)].map(
        (m) => m[1],
      )
      const text = body.replace(/<[^>]*>/g, ' ')
      const title = /<title>([^<]*)<\/title>/.exec(page)?.[1] ?? ''
      const words = [title, text, ...attributes].join(' ')
      expect(words).not.toMatch(/\b(base|head|baseline|candidate)\b/i)
      expect(attributes).toEqual(expect.arrayContaining(['Before', 'With this change']))
    }
  })

  // TICKET-120: verdicts in the status colours, never signal for a failure.
  it('shows the verdicts in the status colours: pass success, fail error, with their markers', () => {
    expect(html).toContain('<span class="chip fail">Unexplained changes</span>')
    const rule = (selector: string) => html.match(new RegExp(`\\n${selector}\\{([^}]*)\\}`))?.[1]
    expect(rule('\\.chip\\.fail')).toBe(
      'background:var(--status-error-subtle);color:var(--status-error-text)',
    )
    expect(rule('\\.chip\\.pass,\\.chip\\.unchanged')).toBe(
      'background:var(--status-success-subtle);color:var(--status-success-text)',
    )
    expect(html).toMatch(/\.chip\.fail::before\{[^}]*background:var\(--status-error-marker\)/)
    expect(html).toContain('--status-error-text: var(--crimson-700);')
    expect(html).toContain('--status-error-text: var(--crimson-300);')
    expect(html).not.toMatch(/\.chip\.fail[^{]*\{[^}]*--signal-/)
  })

  // TICKET-121: "changes to review" is a change, not a status: signal like Checks, never action.
  it('shows the review verdict in signal with its dot, like Checks\' "changes to review"', () => {
    const review = renderReportHtml({ ...result, verdict: 'review' })
    expect(review).toContain('<title>dta diff · Changes to review</title>')
    expect(review).toContain('<p><span class="chip review">Changes to review</span></p>')
    expect(review).toContain('<span class="chip review">to review</span>')
    const rule = (selector: string) => review.match(new RegExp(`\\n${selector}\\{([^}]*)\\}`))?.[1]
    expect(rule('\\.chip\\.review')).toBe(
      'background:var(--signal-subtle);color:var(--signal-text)',
    )
    // The dot: a 6 px circle in the word's colour (signal-bg is under 3:1 on signal-subtle).
    expect(review).toMatch(/\.chip\.review::before[,{][^}]*width:6px;height:6px/)
    expect(rule('\\.chip\\.review::before')).toBe('background:currentColor')
    // The action tint stays for actions; a review chip never takes it, nor a status colour.
    expect(review).not.toMatch(/\.chip\.review[^:{]*\{[^}]*--(action|status)-/)
    expect(review).toContain('--signal-text: var(--redline-900);')
    expect(review).toContain('--signal-text: var(--redline-200);')
  })
})
