import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { STORIES, STORIES_SCHEMA, storiesManifest, storyId } from './stories.js'

const here = import.meta.dirname
const docs = path.join(here, '..', 'content', 'docs', 'design-system', 'components')
/**
 * Every component in src/components/ds, as a slug: CommandButton.astro → command-button, and the
 * Preact ones: TokenInput.tsx → token-input.
 */
const COMPONENTS = fs
  .readdirSync(path.join(here, '..', 'components', 'ds'))
  .filter((name) => /\.(astro|tsx)$/.test(name) && !name.endsWith('.test.tsx'))
  .map((name) =>
    name
      .replace(/\.(astro|tsx)$/, '')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase(),
  )

describe('design system stories', () => {
  it('cover every component in src/components/ds (a new component needs a story)', () => {
    expect([...new Set(STORIES.map((s) => s.component))].sort()).toEqual([...COMPONENTS].sort())
  })

  it('have unique ids, an example file and a docs page each', () => {
    const ids = STORIES.map(storyId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const story of STORIES) {
      expect(fs.existsSync(path.join(here, `${story.example}.astro`)), story.example).toBe(true)
      expect(fs.existsSync(path.join(docs, `${story.component}.mdx`)), story.component).toBe(true)
    }
  })

  it('build a versioned manifest with stable URLs', () => {
    const manifest = storiesManifest()
    expect(manifest.schema).toBe(STORIES_SCHEMA)
    expect(manifest.themes).toEqual(['light', 'graphite'])
    expect(manifest.stories[0]).toEqual({
      id: 'button--variants',
      component: 'button',
      variant: 'variants',
      title: 'Primary, outline, quiet, link',
      url: '/stories/button/variants/',
      viewports: [1280, 390],
    })
    for (const story of manifest.stories) {
      expect(story.url).toMatch(/^\/stories\/[a-z-]+\/[a-z-]+\/$/)
      expect(story.viewports.length).toBeGreaterThan(0)
    }
  })
})
