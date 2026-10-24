import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { diffConfigSchema, readStorybookIndex, STORYBOOK_READY } from './index.js'

const recorded = JSON.parse(
  fs.readFileSync(
    path.resolve(import.meta.dirname, '../../../test/storybook/storybook-static/index.json'),
    'utf8',
  ),
) as unknown

describe('readStorybookIndex (recorded Storybook 10 build)', () => {
  it('renders stories through the iframe, skipping docs and excluded tags', () => {
    const { stories, diagnostics } = readStorybookIndex(recorded, {
      viewports: [1280],
      excludeTags: ['skip-dta-diff'],
    })
    expect(diagnostics).toEqual([])
    expect(stories.map((s) => s.id)).toEqual([
      'components-button--primary',
      'components-button--outline',
      'components-card--default',
    ])
    expect(stories[0]).toEqual({
      id: 'components-button--primary',
      title: 'Components/Button / Primary',
      url: '/iframe.html?id=components-button--primary&viewMode=story',
      viewports: [1280],
      ready: STORYBOOK_READY,
    })
  })

  it('excludes stories by id pattern', () => {
    const { stories } = readStorybookIndex(recorded, {
      viewports: [390],
      exclude: ['^components-button--'],
    })
    expect(stories.map((s) => s.id)).toEqual(['components-card--default'])
  })

  it('accepts a v4 index and explains older or foreign files', () => {
    const v4 = {
      v: 4,
      entries: { 'a--b': { type: 'story', id: 'a--b', title: 'A', name: 'B', importPath: './a' } },
    }
    expect(readStorybookIndex(v4, { viewports: [1] }).stories.map((s) => s.id)).toEqual(['a--b'])
    expect(
      readStorybookIndex({ v: 3, stories: {} }, { viewports: [1] }).diagnostics[0].message,
    ).toContain('Storybook 6 or older')
    const bad = readStorybookIndex({ hello: 1 }, { viewports: [1] })
    expect(bad.stories).toEqual([])
    expect(bad.diagnostics[0].code).toBe('invalid-storybook-index')
  })
})

describe('diff.stories config', () => {
  it('defaults to the static-site adapter, with or without a type', () => {
    expect(diffConfigSchema.parse({ outDir: 'dist' }).stories).toEqual({
      type: 'static-site',
      manifest: 'stories/manifest.json',
    })
    expect(
      diffConfigSchema.parse({ outDir: 'dist', stories: { manifest: 'm.json' } }).stories,
    ).toEqual({ type: 'static-site', manifest: 'm.json' })
  })

  it('takes a storybook source with defaults', () => {
    expect(
      diffConfigSchema.parse({ outDir: 'storybook-static', stories: { type: 'storybook' } })
        .stories,
    ).toEqual({
      type: 'storybook',
      index: 'index.json',
      excludeTags: ['skip-dta-diff'],
      exclude: [],
    })
  })

  it('rejects bad patterns and options of the other adapter', () => {
    const parse = (stories: unknown) => diffConfigSchema.safeParse({ outDir: 'x', stories }).success
    expect(parse({ type: 'storybook', exclude: ['('] })).toBe(false)
    expect(parse({ type: 'storybook', manifest: 'm.json' })).toBe(false)
    expect(parse({ type: 'static-site', index: 'index.json' })).toBe(false)
  })
})
