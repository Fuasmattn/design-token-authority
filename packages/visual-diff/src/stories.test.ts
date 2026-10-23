import { describe, expect, it } from 'vitest'
import { diffConfigSchema, pageStories, readStoriesManifest, STORIES_SCHEMA } from './index.js'

const manifest = {
  schema: STORIES_SCHEMA,
  themes: ['light', 'graphite'],
  stories: [
    {
      id: 'button--variants',
      component: 'button',
      variant: 'variants',
      title: 'Primary, outline, link',
      url: '/stories/button/variants/',
      viewports: [1280, 390],
    },
    { id: 'chip--states', title: 'Info, changed, pass', url: '/stories/chip/states/' },
  ],
}

describe('diffConfigSchema', () => {
  it('applies defaults to a minimal static-site config', () => {
    expect(diffConfigSchema.parse({ outDir: 'dist' })).toEqual({
      outDir: 'dist',
      stories: { type: 'static-site', manifest: 'stories/manifest.json' },
      viewports: [1280],
      threshold: 0,
      colorThreshold: 0,
      thresholds: { explained: 0, unexplained: 0 },
    })
  })

  it('accepts the full section', () => {
    const config = {
      build: 'pnpm build',
      outDir: 'site/dist',
      stories: { type: 'static-site', manifest: 'stories/index.json' },
      viewports: [1440, 390],
      threshold: 0.001,
      colorThreshold: 0.05,
      thresholds: { explained: 0.01, unexplained: 0 },
      base: 'origin/main',
    }
    expect(diffConfigSchema.parse(config)).toEqual(config)
  })

  it('rejects unknown keys, unknown adapters and bad numbers', () => {
    expect(diffConfigSchema.safeParse({ outDir: 'dist', outdir: 'x' }).success).toBe(false)
    expect(diffConfigSchema.safeParse({ outDir: 'dist', stories: { type: 'ladle' } }).success).toBe(
      false,
    )
    expect(diffConfigSchema.safeParse({ outDir: 'dist', viewports: [0] }).success).toBe(false)
    expect(diffConfigSchema.safeParse({ outDir: 'dist', threshold: 2 }).success).toBe(false)
    expect(
      diffConfigSchema.safeParse({ outDir: 'dist', thresholds: { explained: -1 } }).success,
    ).toBe(false)
    expect(diffConfigSchema.safeParse({ outDir: 'dist', thresholds: { changed: 0 } }).success).toBe(
      false,
    )
    expect(diffConfigSchema.safeParse({}).success).toBe(false)
  })
})

describe('readStoriesManifest', () => {
  it('lists stories with their viewports, falling back to the configured ones', () => {
    const result = readStoriesManifest(manifest, { viewports: [1440] })
    expect(result.diagnostics).toEqual([])
    expect(result.stories).toEqual([
      {
        id: 'button--variants',
        title: 'Primary, outline, link',
        url: '/stories/button/variants/',
        viewports: [1280, 390],
      },
      {
        id: 'chip--states',
        title: 'Info, changed, pass',
        url: '/stories/chip/states/',
        viewports: [1440],
      },
    ])
  })

  it('reports a manifest of another schema or shape instead of throwing', () => {
    const other = readStoriesManifest({ schema: 'something/2', stories: [] }, { viewports: [1280] })
    expect(other.stories).toEqual([])
    expect(other.diagnostics[0]).toMatchObject({ severity: 'error', code: 'invalid-manifest' })
    expect(other.diagnostics[0].message).toContain(STORIES_SCHEMA)

    const broken = readStoriesManifest(
      { schema: STORIES_SCHEMA, stories: [{ id: 'x' }] },
      {
        viewports: [1280],
      },
    )
    expect(broken.diagnostics[0].message).toContain('stories.0.url')
  })

  it('reports duplicate story ids', () => {
    const story = { id: 'a', title: 'A', url: '/a/' }
    const result = readStoriesManifest(
      { schema: STORIES_SCHEMA, stories: [story, story] },
      { viewports: [1280] },
    )
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'duplicate-story', message: expect.stringContaining('"a"') }),
    ])
  })
})

describe('pageStories (TICKET-128)', () => {
  it('makes a story per page, with a file-safe id and the path as title', () => {
    const { stories, diagnostics } = pageStories(['/', '/pricing', '/docs/intro/', '/a.html'], {
      viewports: [1280, 390],
    })
    expect(diagnostics).toEqual([])
    expect(stories.map((s) => [s.id, s.title, s.url])).toEqual([
      ['home', '/', '/'],
      ['pricing', '/pricing', '/pricing'],
      ['docs-intro', '/docs/intro/', '/docs/intro/'],
      ['a', '/a.html', '/a.html'],
    ])
    expect(stories[0].viewports).toEqual([1280, 390])
  })

  it('reports two pages that would share an id', () => {
    const { diagnostics } = pageStories(['/about', '/about/'], { viewports: [1280] })
    expect(diagnostics.map((d) => d.code)).toEqual(['duplicate-story'])
  })

  it('is accepted by the config schema only with paths that start with "/"', () => {
    expect(diffConfigSchema.safeParse({ outDir: 'dist', stories: ['/'] }).success).toBe(true)
    expect(diffConfigSchema.safeParse({ outDir: 'dist', stories: ['about'] }).success).toBe(false)
    expect(diffConfigSchema.safeParse({ outDir: 'dist', stories: [] }).success).toBe(false)
  })
})
