import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { STORIES, STORIES_SCHEMA, storiesManifest, storyId } from './stories.js'

const here = import.meta.dirname
const docs = path.join(here, '..', 'content', 'docs', 'design-system', 'components')
const COMPONENTS = [
  'button',
  'command-button',
  'chip',
  'text-field',
  'terminal',
  'redline',
  'diff-card',
  'workflow-rail',
]

describe('design system stories', () => {
  it('cover every component of the design system', () => {
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
      title: 'Primary, outline, link',
      url: '/stories/button/variants/',
      viewports: [1280, 390],
    })
    for (const story of manifest.stories) {
      expect(story.url).toMatch(/^\/stories\/[a-z-]+\/[a-z-]+\/$/)
      expect(story.viewports.length).toBeGreaterThan(0)
    }
  })
})
