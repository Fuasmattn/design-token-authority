import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  diffResultJsonSchema,
  diffResultSchema,
  renderStoriesMarkdown,
  reviewStories,
  toDiffJson,
  type StoryResult,
  type TokenCause,
} from './index.js'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')

const result = (r: Partial<StoryResult> & Pick<StoryResult, 'id' | 'status'>): StoryResult => ({
  title: r.id,
  url: `/stories/${r.id}/`,
  viewport: 1280,
  ratio: 0,
  changedPixels: 0,
  images: {},
  ...r,
})
const cause: TokenCause = {
  id: 'action.bg (Theme · Light)',
  name: 'action.bg',
  collection: 'Theme',
  mode: 'Light',
  kind: 'changed',
  before: { raw: '{blueprint.600}', resolved: '#2f55d4' },
  after: { raw: '{blueprint.700}', resolved: '#2443ac' },
}
const explainedBy = (id: string, pixels = 10) => ({
  explained: true,
  tokens: [{ id, dependents: 1, pixels, elements: ['button.primary'] }],
  unexplainedPixels: 0,
})

const results: StoryResult[] = [
  result({
    id: 'button',
    status: 'changed',
    ratio: 0.01,
    changedPixels: 10,
    attribution: explainedBy(cause.id),
  }),
  result({
    id: 'card',
    status: 'changed',
    ratio: 0.002,
    changedPixels: 2,
    attribution: {
      explained: false,
      tokens: [{ id: cause.id, dependents: 1, pixels: 1, elements: ['a.link'] }],
      unexplainedPixels: 1,
      unexplainedRegion: { x: 4, y: 5, width: 1, height: 1 },
    },
  }),
  result({ id: 'text', status: 'unchanged' }),
]

describe('reviewStories', () => {
  it('groups explained stories by token and lists unexplained ones', () => {
    const review = reviewStories(results, [cause], { explained: 0, unexplained: 0 })
    expect(review).toMatchObject({
      verdict: 'fail',
      changed: 2,
      explained: 1,
      tokens: [{ id: cause.id, stories: ['button@1280'], needsReview: true }],
      unexplained: [
        {
          story: 'card@1280',
          pixels: 1,
          region: { x: 4, y: 5, width: 1, height: 1 },
          failing: true,
        },
      ],
      added: [],
      removed: [],
    })
  })

  it('applies thresholds by cause', () => {
    expect(reviewStories(results, [cause], { explained: 0, unexplained: 0.01 }).verdict).toBe(
      'review',
    )
    expect(reviewStories(results, [cause], { explained: 0.05, unexplained: 0.01 }).verdict).toBe(
      'pass',
    )
  })

  it('treats stories without attribution as unexplained and new stories as to review', () => {
    const review = reviewStories(
      [
        result({ id: 'x', status: 'changed', ratio: 0.5, changedPixels: 50 }),
        result({ id: 'new', status: 'added' }),
      ],
      [],
      { explained: 0, unexplained: 0.9 },
    )
    expect(review.unexplained).toEqual([
      { story: 'x@1280', ratio: 0.5, pixels: 50, failing: false },
    ])
    expect(review.verdict).toBe('review')
    expect(review.added).toEqual(['new@1280'])
  })

  it('passes when nothing changed', () => {
    expect(reviewStories([results[2]], [cause], { explained: 0, unexplained: 0 }).verdict).toBe(
      'pass',
    )
  })
})

describe('renderStoriesMarkdown with a review', () => {
  it('shows the verdict, changes by token, unexplained stories and the cause per story', () => {
    const review = reviewStories(results, [cause], { explained: 0, unexplained: 0 })
    const markdown = renderStoriesMarkdown(results, { review })
    expect(markdown).toContain(
      '**Fail: unexplained changes above the threshold** · 2 changed · 1 unchanged · 1 explained by token changes, 1 unexplained',
    )
    expect(markdown).toContain(
      '- `action.bg` (Theme · Light) `{blueprint.600}` → `#2f55d4` → `{blueprint.700}` → `#2443ac` explains 1 story: `button@1280`',
    )
    expect(markdown).toContain('| `card@1280` | 1 (0.20%) | 1×1 at 4,5 | yes |')
    expect(markdown).toContain('| `button` | 1280px | changed | 1.00% | `action.bg` |')
    expect(markdown).toContain(
      '| `card` | 1280px | changed | 0.20% | unexplained (partly `action.bg`) |',
    )
  })
})

describe('result.json', () => {
  const set = { changes: [], counts: { changed: 0, added: 0, removed: 0, affected: 0 } }

  it('matches the documented schema, with the verdict and review', () => {
    const review = reviewStories(results, [cause], { explained: 0, unexplained: 0 })
    const json = JSON.parse(toDiffJson(set, results, { base: 'main' }, review))
    expect(diffResultSchema.parse(json)).toBeTruthy()
    expect(json.verdict).toBe('fail')
    expect(json.stories[0].attribution.tokens[0].id).toBe(cause.id)
  })

  it('has an up-to-date JSON Schema in docs/diff (run `pnpm run schema:generate`)', () => {
    const committed = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'docs', 'diff', 'result.schema.json'), 'utf-8'),
    ) as unknown
    expect(committed).toEqual(JSON.parse(JSON.stringify(diffResultJsonSchema())))
  })
})
