/**
 * The landing page, the playground and the frame they share (site.css, SiteLayout) are styled
 * with the DTA Drafting Table tokens only (AGENTS.md, TICKET-096): no colour literals, borders
 * instead of shadows, and no literal px for spacing, radii or type.
 * Sizes of small decorative shapes (the logo mark, dots) and media queries are not checked.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const site = path.resolve(import.meta.dirname, '..', '..')
const landingDir = path.join(site, 'src', 'components', 'landing')

/** The CSS of a file: the whole file for .css, the <style> blocks for .astro. */
function cssOf(file: string): string {
  const source = fs.readFileSync(file, 'utf8')
  if (file.endsWith('.css')) return source
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
}

const files = [
  path.join(site, 'src', 'styles', 'site.css'),
  path.join(site, 'src', 'layouts', 'SiteLayout.astro'),
  path.join(site, 'src', 'styles', 'landing.css'),
  path.join(site, 'src', 'pages', 'index.astro'),
  path.join(site, 'src', 'styles', 'playground.css'),
  path.join(site, 'src', 'pages', 'playground.astro'),
  ...(fs.existsSync(landingDir) ? fs.readdirSync(landingDir) : [])
    .filter((name) => name.endsWith('.astro'))
    .map((name) => path.join(landingDir, name)),
].map((file) => [path.relative(site, file), cssOf(file)] as const)

/** Properties whose values come from the spacing, radius and type tokens. */
const TOKEN_PROPERTIES =
  /^(font|font-size|line-height|gap|row-gap|column-gap|border-radius|max-width|(padding|margin)(-[a-z-]+)?)$/

function declarations(css: string): Array<[string, string]> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...withoutComments.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)].map((m) => [m[1], m[2]])
}

describe('landing page and playground styles', () => {
  it('found the files', () => {
    expect(files.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        'src/styles/landing.css',
        'src/styles/site.css',
        'src/styles/playground.css',
      ]),
    )
  })

  it.each(files)('%s has no colour literals', (_name, css) => {
    const literals = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)
    expect(literals ?? []).toEqual([])
  })

  it.each(files)('%s uses borders, not shadows (except the focus ring)', (_name, css) => {
    const shadows = declarations(css)
      .filter(([property]) => property === 'box-shadow')
      .map(([, value]) => value.trim())
      .filter((value) => value !== 'none')
      .filter((value) => !/^0 0 0 (var\(--[\w-]+\)|\d+px) var\(--[\w-]+\)$/.test(value))
    expect(shadows).toEqual([])
  })

  it.each(files)('%s takes spacing, radii and type from the tokens', (_name, css) => {
    const literals = declarations(css)
      .filter(([property]) => TOKEN_PROPERTIES.test(property))
      .map(
        ([property, value]) =>
          // env() fallbacks and the px unit of unitless type tokens (`var(--type-…) * 1px`) are fine.
          [property, value.replace(/env\([^)]*\)/g, '').replace(/\*\s*1px/g, '')] as const,
      )
      .filter(([, value]) => /(^|[^\w-])\d*\.?\d+px\b/.test(value))
      .map(([property, value]) => `${property}: ${value.trim()}`)
    expect(literals).toEqual([])
  })
})
