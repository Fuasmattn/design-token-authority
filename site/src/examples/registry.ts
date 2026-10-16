/** Maps each story (stories.ts) to the Astro component that renders it. */
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import { STORIES, type Story } from './stories'

const components = import.meta.glob('./*.astro', { import: 'default', eager: true }) as Record<
  string,
  AstroComponentFactory
>

export interface Example extends Story {
  /** Rendered once per theme; gets an `idPrefix` so ids stay unique on a page. */
  render: AstroComponentFactory
}

export const EXAMPLES: readonly Example[] = STORIES.map((story) => {
  const render = components[`./${story.example}.astro`]
  if (!render) throw new Error(`No example component ${story.example}.astro`)
  return { ...story, render }
})

export { storiesManifest, storyId, storyPath, STORIES_SCHEMA } from './stories'
