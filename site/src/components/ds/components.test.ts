import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = import.meta.dirname
const sources = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith('.astro'))
  .map((name) => [name, fs.readFileSync(path.join(dir, name), 'utf8')] as const)

describe('design system components', () => {
  it.each(sources)('%s uses token variables, no colour literals', (_name, source) => {
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
    expect(source).toMatch(/var\(--/)
  })

  // One surface: grid paper only where something is inspected (the redline stage, the card's
  // stage variant), never as a page, panel or section background.
  const GRID_ALLOWED = new Set(['Redline.astro', 'Card.astro'])
  it.each(sources)('%s uses no grid paper outside an inspection stage', (name, source) => {
    if (GRID_ALLOWED.has(name)) return
    expect(source).not.toMatch(/--bg-grid/)
  })

  it.each(sources)('%s uses borders, not drop shadows', (_name, source) => {
    // box-shadow is only allowed as a focus ring or halo: `0 0 0 <width> <token>`.
    for (const [, value] of source.matchAll(/box-shadow:\s*([^;]+);/g)) {
      expect(value).toMatch(/^0 0 0 (var\(--[\w-]+\)|\d+px) var\(--[\w-]+\)$/)
    }
  })
})
