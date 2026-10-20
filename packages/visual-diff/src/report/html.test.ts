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
const count = (pattern: RegExp) => (html.match(pattern) ?? []).length

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

  it('shows each changed story with baseline, candidate, diff and a keyboard slider', () => {
    expect(html).toContain('src="base/button@1280.png"')
    expect(html).toContain('src="head/button@1280.png"')
    expect(html).toContain('src="diff/button@1280.png"')
    expect(count(/<input type="range"/g)).toBe(4) // 2 samples, 1 more explained, 1 unexplained
    expect(html).toContain('aria-label="Divider between baseline (left) and candidate (right)')
    // Redline label on the token's dependent, in % of the canvas.
    expect(html).toContain(
      '<span class="mark" style="left:2.500%;top:10.000%;width:25.000%;height:20.000%"><span class="tag" data-contrast-exception="redline label">action.bg</span></span>',
    )
  })

  it('lists unexplained stories one by one with the region, and escapes text', () => {
    const section = html.slice(html.indexOf('id="unexplained"'), html.indexOf('id="added"'))
    expect(section).toContain('<code>chip&lt;x&gt;</code>')
    expect(section).toContain('class="mark unexplained"')
    expect(html).not.toContain('chip<x>')
  })

  it('shows added stories without a slider and lists every story with its cause', () => {
    const added = html.slice(html.indexOf('id="added"'), html.indexOf('id="stories"'))
    expect(added).toContain('src="head/new@1280.png"')
    expect(added).toContain('not rendered')
    expect(added).not.toContain('type="range"')
    const table = html.slice(html.indexOf('id="stories"'), html.indexOf('id="tokens"'))
    expect(table).toContain('<code>text</code>')
    expect(table).toContain('Every explained story (1 more)')
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
