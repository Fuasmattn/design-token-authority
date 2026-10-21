import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTokenFiles } from '@dta/core'
import type { TokenModel } from '@dta/core'
import { buildOutputs, OUTPUT_FORMATS } from './index.js'
import { fixtureOptions } from './test-helpers.js'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')

function fixtureModel(fixture: string): TokenModel {
  const dir = path.join(repoRoot, 'test', 'fixtures', fixture, 'tokens')
  const files = fs.readdirSync(dir).map((fileName) => ({
    fileName,
    content: fs.readFileSync(path.join(dir, fileName), 'utf-8'),
  }))
  return parseTokenFiles(files).model
}

function snapshot(fixture: string, file: string): string {
  return fs.readFileSync(
    path.join(repoRoot, 'test', 'snapshots', fixture, 'build', 'files', file),
    'utf-8',
  )
}

function modelFrom(files: Record<string, unknown>): TokenModel {
  const { model } = parseTokenFiles(
    Object.entries(files).map(([fileName, content]) => ({
      fileName,
      content: JSON.stringify(content),
    })),
  )
  return model
}

const find = (files: { path: string; content: string }[], file: string) =>
  files.find((f) => f.path === file)?.content

const figma = (scopes: string[]) => ({ 'com.figma': { scopes } })

describe('buildOutputs: base layer', () => {
  for (const fixture of ['brand-ab', 'daisyui']) {
    it(`writes output/css/base.css for ${fixture} exactly as the v1 build did`, async () => {
      const { files } = await buildOutputs(fixtureModel(fixture), { brands: [] })
      expect(find(files, 'output/css/base.css')).toBe(snapshot(fixture, 'output/css/base.css'))
    })
  }

  it('turns number tokens with pixel scopes into px values and opacity into decimals', async () => {
    const model = modelFrom({
      'Base.Value.json': {
        Spacing: {
          Small: { $type: 'number', $value: 4, $extensions: figma(['GAP']) },
          Plain: { $type: 'number', $value: 7, $extensions: figma(['ALL_SCOPES']) },
        },
        Opacity: { Half: { $type: 'number', $value: 50, $extensions: figma(['OPACITY']) } },
      },
    })
    const { files } = await buildOutputs(model, {})
    const css = find(files, 'output/css/base.css') ?? ''
    expect(css).toContain('--spacing-small: 4px;')
    expect(css).toContain('--spacing-plain: 7;')
    expect(css).toContain('--opacity-half: 0.5;')
  })

  it('collapses repeated name segments', async () => {
    const model = modelFrom({
      'Base.Value.json': { Blur: { Blur: { Md: { $type: 'number', $value: 8 } } } },
    })
    const { files } = await buildOutputs(model, {})
    expect(find(files, 'output/css/base.css')).toContain('--blur-md: 8;')
  })

  it('keeps multi-mode collections out of the base layer but resolves aliases to them', async () => {
    const model = modelFrom({
      'Base.Value.json': { Link: { $type: 'color', $value: '{Brand.Primary}' } },
      'Brand.A.json': { Brand: { Primary: { $type: 'color', $value: '#ff0000' } } },
      'Brand.B.json': { Brand: { Primary: { $type: 'color', $value: '#00ff00' } } },
    })
    const { files, diagnostics } = await buildOutputs(model, {})
    const css = find(files, 'output/css/base.css') ?? ''
    expect(css).toContain('--link: #ff0000;')
    expect(css).not.toContain('--brand-primary')
    expect(diagnostics).toEqual([])
  })

  it('drops a token that aliases its own path instead of failing', async () => {
    const model = modelFrom({
      'Base.Value.json': {
        Color: { Red: { $type: 'color', $value: '#ff0000' } },
        Other: { $type: 'color', $value: '#0000ff' },
      },
      'Brand.A.json': { Color: { Red: { $type: 'color', $value: '{Color.Red}' } } },
      'Brand.B.json': { Color: { Red: { $type: 'color', $value: '{Color.Red}' } } },
    })
    const { files } = await buildOutputs(model, {})
    const css = find(files, 'output/css/base.css')
    expect(css).toContain('--other: #0000ff;')
    expect(css).not.toContain('--color-red')
  })

  it('reports an alias to a token that does not exist as an error and leaves the token out', async () => {
    const model = modelFrom({
      'Base.Value.json': {
        Link: { $type: 'color', $value: '{Nowhere.Fast}' },
        Red: { $type: 'color', $value: '#ff0000' },
      },
    })
    const { files, diagnostics } = await buildOutputs(model, {})
    expect(diagnostics).toEqual([
      {
        severity: 'error',
        code: 'dangling-alias',
        message: 'Alias {Nowhere.Fast} references non-existent token "Nowhere.Fast"',
        file: 'Base.Value.json',
        path: ['Link'],
        docs: 'lint-rules',
      },
    ])
    for (const file of files) {
      expect(file.content, file.path).not.toMatch(/link|Link|Nowhere/)
      expect(file.content, file.path).toMatch(/red|Red/)
    }
  })

  it('still only warns about an alias into a collection the build leaves out', async () => {
    const model = modelFrom({
      'Base.Value.json': { Red: { $type: 'color', $value: '#ff0000' } },
      'Other.Value.json': { Link: { $type: 'color', $value: '{Red}' } },
    })
    const { diagnostics } = await buildOutputs(model, { collections: ['Other'] })
    expect(diagnostics).toMatchObject([
      { severity: 'warning', code: 'broken-reference', path: ['Link'] },
    ])
  })

  it('returns no files and no error for an empty model', async () => {
    expect(await buildOutputs({ collections: [] }, {})).toEqual({ files: [], diagnostics: [] })
  })
})

describe('buildOutputs: shared outputs', () => {
  for (const fixture of ['brand-ab', 'daisyui']) {
    it(`writes variables.css and the JS palette for ${fixture} as the snapshot`, async () => {
      const { files } = await buildOutputs(fixtureModel(fixture), {
        ...fixtureOptions(fixture),
        brands: [],
      })
      for (const file of ['output/css/variables.css', 'output/js/colorpalette.js']) {
        expect(find(files, file), file).toBe(snapshot(fixture, file))
      }
    })
  }

  const aliased = modelFrom({
    'Base.Value.json': {
      Color: { Red: { $type: 'color', $value: '#ff0000', $description: 'Signal red' } },
      Link: { $type: 'color', $value: '{Color.Red}' },
    },
  })

  it('keeps references as var() in variables.css but not in base.css', async () => {
    const { files } = await buildOutputs(aliased, {})
    expect(find(files, 'output/css/variables.css')).toContain('--link: var(--color-red);')
    expect(find(files, 'output/css/base.css')).toContain('--link: #ff0000;')
  })

  it('resolves references and keeps descriptions as comments in the JS palette', async () => {
    const { files } = await buildOutputs(aliased, {})
    const js = find(files, 'output/js/colorpalette.js')
    expect(js).toContain('export const ColorRed = "#ff0000"; // Signal red')
    expect(js).toContain('export const Link = "#ff0000";')
  })

  it('lists the files in path order', async () => {
    const { files } = await buildOutputs(aliased, {})
    expect(files.map((f) => f.path)).toEqual([
      'output/css/base.css',
      'output/css/variables.css',
      'output/js/colorpalette.js',
      'output/tailwind/tailwind.css',
      'output/tailwind/tailwind.tokens.ts',
    ])
  })
})

describe('buildOutputs: brand themes', () => {
  it('writes one theme per brand exactly as the v1 build did', async () => {
    const { files, diagnostics } = await buildOutputs(fixtureModel('brand-ab'), {
      brands: ['BrandA', 'BrandB'],
    })
    for (const file of ['output/css/themes/branda.css', 'output/css/themes/brandb.css']) {
      expect(find(files, file), file).toBe(snapshot('brand-ab', file))
    }
    expect(diagnostics).toEqual([])
  })

  it('builds no theme when no brands are given, as for the daisyui fixture', async () => {
    const { files } = await buildOutputs(fixtureModel('daisyui'), {})
    expect(files.filter((f) => f.path.includes('themes/'))).toEqual([])
  })

  const themed = modelFrom({
    'Base.Value.json': { Color: { Red: { $type: 'color', $value: '#ff0000' } } },
    'Brand.Sunrise.json': { Accent: { $type: 'color', $value: '{Color.Red}' } },
    'Brand.Moonlight.json': { Accent: { $type: 'color', $value: '#112233' } },
  })

  it('uses the lower-cased brand as selector and file name, and references the base layer', async () => {
    const { files } = await buildOutputs(themed, { brands: ['Sunrise'] })
    expect(find(files, 'output/css/themes/sunrise.css')).toContain(
      '[data-brand="sunrise"] {\n  --accent: var(--color-red);\n}',
    )
  })

  it('warns about a brand that is not a mode of any multi-mode collection', async () => {
    const { files, diagnostics } = await buildOutputs(themed, { brands: ['Nightfall'] })
    expect(files.some((f) => f.path.includes('themes/'))).toBe(false)
    expect(diagnostics).toMatchObject([{ severity: 'warning', code: 'unknown-brand' }])
  })

  it('does not fail for tokens that only some brands define', async () => {
    const model = modelFrom({
      'Base.Value.json': { Color: { Red: { $type: 'color', $value: '#ff0000' } } },
      'Brand.Sunrise.json': { Accent: { $type: 'color', $value: '{Color.Red}' } },
      'Brand.Moonlight.json': { Other: { $type: 'color', $value: '#112233' } },
    })
    const { files, diagnostics } = await buildOutputs(model, { brands: ['Sunrise', 'Moonlight'] })
    expect(find(files, 'output/css/themes/moonlight.css')).not.toContain('--accent')
    expect(diagnostics).toEqual([])
  })

  it('reports an alias that no layer defines once per file, as dta lint does', async () => {
    const model = modelFrom({
      'Base.Value.json': { Color: { Red: { $type: 'color', $value: '#ff0000' } } },
      'Brand.A.json': { Accent: { $type: 'color', $value: '{Missing.Thing}' } },
      'Brand.B.json': { Accent: { $type: 'color', $value: '{Missing.Thing}' } },
    })
    const { diagnostics } = await buildOutputs(model, { brands: ['A'] })
    expect(diagnostics).toMatchObject([
      { severity: 'error', code: 'dangling-alias', path: ['Accent'], file: 'Brand.A.json' },
      { severity: 'error', code: 'dangling-alias', path: ['Accent'], file: 'Brand.B.json' },
    ])
  })

  it('reports a cycle as an error and leaves out its tokens and the aliases that run into it', async () => {
    const model = modelFrom({
      'Base.Value.json': { Color: { Red: { $type: 'color', $value: '#ff0000' } } },
      'Brand.A.json': {
        Ping: { $type: 'color', $value: '{Pong}' },
        Pong: { $type: 'color', $value: '{Ping}' },
        Echo: { $type: 'color', $value: '{Ping}' },
        Fine: { $type: 'color', $value: '{Color.Red}' },
      },
      'Brand.B.json': { Fine: { $type: 'color', $value: '#00ff00' } },
    })
    const { files, diagnostics } = await buildOutputs(model, { brands: ['A', 'B'] })
    expect(diagnostics).toEqual([
      {
        severity: 'error',
        code: 'circular-alias',
        message: 'Circular alias chain: Brand.A/Ping → Brand.A/Pong → Brand.A/Ping',
        file: 'Brand.A.json',
        path: ['Ping'],
        docs: 'lint-rules',
      },
    ])
    expect(find(files, 'output/css/themes/a.css')).toBe(
      '/**\n * Do not edit directly, this file was auto-generated.\n */\n\n[data-brand="a"] {\n  --fine: var(--color-red);\n}\n',
    )
    for (const file of files) expect(file.content, file.path).not.toMatch(/ping|pong|echo/i)
  })

  describe('single-mode tokens that alias brand tokens (TICKET-093)', () => {
    const tiered = modelFrom({
      'Primitives.Value.json': {
        Blue: { $type: 'color', $value: '#1f5fd1' },
        Green: { $type: 'color', $value: '#1d7a4c' },
      },
      'Brand.BrandA.json': { Action: { $type: 'color', $value: '{Blue}' } },
      'Brand.BrandB.json': { Action: { $type: 'color', $value: '{Green}' } },
      'Component.Value.json': {
        Button: { $type: 'color', $value: '{Action}' },
        Card: { $type: 'color', $value: '{Button}' },
        Border: { $type: 'color', $value: '{Blue}' },
        Outline: { $type: 'color', $value: '{Border}' },
      },
    })
    const brands = ['BrandA', 'BrandB']

    it('repeats them, and the tokens that alias them, in every theme with the same reference', async () => {
      const { files, diagnostics } = await buildOutputs(tiered, { brands })
      expect(diagnostics).toEqual([])
      for (const brand of ['branda', 'brandb']) {
        expect(find(files, `output/css/themes/${brand}.css`)).toContain(
          `[data-brand="${brand}"] {\n  --action: var(--${brand === 'branda' ? 'blue' : 'green'});\n` +
            '  --button: var(--action);\n  --card: var(--button);\n}',
        )
      }
    })

    it('leaves tokens that only alias single-mode tokens on :root', async () => {
      const { files } = await buildOutputs(tiered, { brands })
      for (const file of files.filter((f) => f.path.includes('themes/'))) {
        expect(file.content, file.path).not.toMatch(/--border|--outline/)
      }
    })

    it('keeps variables.css, base.css and the brand Tailwind files as without a dependent tier', async () => {
      const without = modelFrom({
        'Primitives.Value.json': {
          Blue: { $type: 'color', $value: '#1f5fd1' },
          Green: { $type: 'color', $value: '#1d7a4c' },
        },
        'Brand.BrandA.json': { Action: { $type: 'color', $value: '{Blue}' } },
        'Brand.BrandB.json': { Action: { $type: 'color', $value: '{Green}' } },
      })
      const [withTier, withoutTier] = await Promise.all([
        buildOutputs(tiered, { brands }),
        buildOutputs(without, { brands }),
      ])
      const variables = find(withTier.files, 'output/css/variables.css') ?? ''
      for (const declaration of [
        '--button: var(--action);',
        '--card: var(--button);',
        '--border: var(--blue);',
        '--outline: var(--border);',
      ]) {
        expect(variables).toContain(`  ${declaration}\n`)
      }
      expect(variables).not.toContain('--action:')
      expect(find(withTier.files, 'output/css/base.css')).toContain('--button: #1f5fd1;')
      for (const file of withoutTier.files.filter((f) => f.path.startsWith('output/tailwind/b'))) {
        expect(find(withTier.files, file.path), file.path).toBe(file.content)
      }
    })

    it('repeats nothing when the build leaves the brand collection out', async () => {
      const { files } = await buildOutputs(tiered, {
        brands,
        collections: ['Primitives', 'Component'],
      })
      expect(files.some((f) => f.path.includes('themes/'))).toBe(false)
    })
  })

  describe('breakpoint modes (TICKET-091)', () => {
    const px = (value: number | string) => ({
      $type: 'number',
      $value: value,
      $extensions: figma(['GAP']),
    })
    const responsive = modelFrom({
      'Primitives.Value.json': {
        Blue: { $type: 'color', $value: '#1f5fd1' },
        Green: { $type: 'color', $value: '#1d7a4c' },
        Space: { S: px(8), M: px(16), L: px(32) },
      },
      'Brand.BrandA.json': { Action: { $type: 'color', $value: '{Blue}' } },
      'Brand.BrandB.json': { Action: { $type: 'color', $value: '{Green}' } },
      'Screen.Mobile.json': {
        Gap: px('{Space.S}'),
        Accent: { $type: 'color', $value: '{Blue}' },
      },
      'Screen.Desktop.json': {
        Gap: px('{Space.L}'),
        Accent: { $type: 'color', $value: '{Action}' },
      },
      'Screen.Tablet.json': {
        Gap: px('{Space.M}'),
        Accent: { $type: 'color', $value: '{Blue}' },
      },
      'Component.Value.json': { Card: { Gap: px('{Gap}') } },
    })
    const brands = ['BrandA', 'BrandB']
    const mobileFirst = {
      collection: 'Screen',
      default: 'Mobile',
      media: [
        { mode: 'Tablet', query: '(min-width: 768px)' },
        { mode: 'Desktop', query: '(min-width: 1024px)' },
      ],
    }

    it('writes the default mode on :root and every other mode in its media query, in order', async () => {
      const { files, diagnostics } = await buildOutputs(responsive, {
        brands,
        breakpoints: mobileFirst,
      })
      expect(diagnostics).toEqual([])
      const css = find(files, 'output/css/variables.css') ?? ''
      expect(css.slice(css.indexOf('/* Screen'))).toBe(
        [
          '/* Screen · Mobile (default) */',
          ':root {',
          '  --gap: var(--space-s);',
          '  --accent: var(--blue);',
          '}',
          '',
          '/* Screen · Tablet */',
          '@media (min-width: 768px) {',
          '  :root {',
          '    --gap: var(--space-m);',
          '    --accent: var(--blue);',
          '  }',
          '}',
          '',
          '/* Screen · Desktop */',
          '@media (min-width: 1024px) {',
          '  :root {',
          '    --gap: var(--space-l);',
          '    --accent: var(--action);',
          '  }',
          '}',
          '',
        ].join('\n'),
      )
      // The single-mode tokens come first, unchanged; a component token aliases the breakpoint
      // token and stays a reference, so it switches with it.
      expect(css.indexOf('--card-gap: var(--gap);')).toBeLessThan(css.indexOf('/* Screen'))
    })

    it('takes the order and the default from the options (desktop-first)', async () => {
      const { files } = await buildOutputs(responsive, {
        breakpoints: {
          collection: 'Screen',
          default: 'Desktop',
          media: [
            { mode: 'Tablet', query: '(max-width: 1023px)' },
            { mode: 'Mobile', query: '(max-width: 767px)' },
          ],
        },
      })
      const css = find(files, 'output/css/variables.css') ?? ''
      const order = [...css.matchAll(/\/\* Screen · (\w+)/g)].map((m) => m[1])
      expect(order).toEqual(['Desktop', 'Tablet', 'Mobile'])
      expect(css).toContain('/* Screen · Desktop (default) */\n:root {\n  --gap: var(--space-l);')
      expect(css).toContain('@media (max-width: 767px) {\n  :root {\n    --gap: var(--space-s);')
    })

    it('repeats a breakpoint token that reaches a brand token in each theme, per breakpoint', async () => {
      const { files } = await buildOutputs(responsive, { brands, breakpoints: mobileFirst })
      for (const brand of ['branda', 'brandb']) {
        const theme = find(files, `output/css/themes/${brand}.css`) ?? ''
        const body = theme.slice(theme.indexOf('/* Screen'))
        // Every mode of the token, so a nested [data-brand] holds the right value at every
        // width; the gap only reaches primitives and is not repeated.
        expect(body).toBe(
          [
            '/* Screen · Mobile (default) */',
            `[data-brand="${brand}"] {`,
            '  --accent: var(--blue);',
            '}',
            '',
            '/* Screen · Tablet */',
            '@media (min-width: 768px) {',
            `  [data-brand="${brand}"] {`,
            '    --accent: var(--blue);',
            '  }',
            '}',
            '',
            '/* Screen · Desktop */',
            '@media (min-width: 1024px) {',
            `  [data-brand="${brand}"] {`,
            '    --accent: var(--action);',
            '  }',
            '}',
            '',
          ].join('\n'),
        )
        expect(theme).not.toContain('--gap')
      }
    })

    it('adds an @theme inline block with the default mode names to the Tailwind v4 file only', async () => {
      const [withBreakpoints, without] = await Promise.all([
        buildOutputs(responsive, { brands, breakpoints: mobileFirst }),
        buildOutputs(responsive, { brands }),
      ])
      const tailwind = find(withBreakpoints.files, 'output/tailwind/tailwind.css') ?? ''
      // The component token that aliases a breakpoint token moves to the inline block as a
      // reference: in @theme it would be one resolved size at every width.
      expect(tailwind).toBe(
        `${find(without.files, 'output/tailwind/tailwind.css')?.replace('  --spacing-card-gap: 32px;\n', '')}\n` +
          '/* Screen: theme variables that switch with the media queries of variables.css */\n' +
          '@theme inline {\n  --spacing-card-gap: var(--card-gap);\n  --spacing-gap: var(--gap);\n' +
          '  --color-accent: var(--accent);\n}\n',
      )
      // The brand Tailwind files are as before (base.css, the JS palette and Tailwind v3
      // resolve through the default mode: see below).
      for (const file of without.files) {
        if (!/^output\/tailwind\/brand/.test(file.path)) continue
        expect(find(withBreakpoints.files, file.path), file.path).toBe(file.content)
      }
    })

    it('resolves base.css and Tailwind v3 through the default mode, not the first alphabetically', async () => {
      const [withBreakpoints, without] = await Promise.all([
        buildOutputs(responsive, { breakpoints: mobileFirst }),
        buildOutputs(responsive, {}),
      ])
      expect(find(without.files, 'output/css/base.css')).toContain('--card-gap: 32px;') // Desktop
      expect(find(withBreakpoints.files, 'output/css/base.css')).toContain('--card-gap: 8px;')
      // The JS palette and Tailwind v3 hold resolved values too: the default mode's.
      expect(find(withBreakpoints.files, 'output/tailwind/tailwind.tokens.ts')).toContain(
        "'card-gap': '8px'",
      )
    })

    it('writes nothing for breakpoints with the css format left out, and no theme blocks', async () => {
      const { files } = await buildOutputs(responsive, {
        brands,
        breakpoints: mobileFirst,
        formats: ['tailwind-v4'],
      })
      expect(files.map((f) => f.path)).toEqual([
        'output/tailwind/branda/tailwind.css',
        'output/tailwind/brandb/tailwind.css',
        'output/tailwind/tailwind.css',
      ])
    })

    it('does not build a theme for a breakpoint mode named in brands', async () => {
      const { files, diagnostics } = await buildOutputs(responsive, {
        brands: ['Desktop'],
        breakpoints: mobileFirst,
      })
      expect(files.some((f) => f.path.includes('themes/'))).toBe(false)
      expect(diagnostics.map((d) => d.code)).toEqual(['unknown-brand'])
    })

    it('warns and builds no breakpoint CSS when the configuration does not fit the tokens', async () => {
      const codes = async (breakpoints: Parameters<typeof buildOutputs>[1]['breakpoints']) => {
        const { files, diagnostics } = await buildOutputs(responsive, { breakpoints })
        return {
          blocks: (find(files, 'output/css/variables.css') ?? '').includes('/* Screen'),
          diagnostics: diagnostics.map((d) => `${d.code}: ${d.message}`),
        }
      }
      expect(await codes({ ...mobileFirst, collection: 'Nope' })).toEqual({
        blocks: false,
        diagnostics: [
          'unknown-breakpoint-collection: The breakpoint collection "Nope" is not in the built tokens, so no breakpoint CSS was built.',
        ],
      })
      expect(await codes({ ...mobileFirst, collection: 'Component' })).toEqual({
        blocks: false,
        diagnostics: [
          'unknown-breakpoint-collection: The breakpoint collection "Component" has one mode only, so no breakpoint CSS was built.',
        ],
      })
      expect(await codes({ ...mobileFirst, default: 'Watch' })).toEqual({
        blocks: false,
        diagnostics: [
          'unknown-breakpoint-mode: "Watch" (breakpoints.default) is not a mode of "Screen", so no breakpoint CSS was built.',
        ],
      })
      expect(
        await codes({
          ...mobileFirst,
          media: [
            { mode: 'Desktop', query: '(min-width: 1024px)' },
            { mode: 'Watch', query: '(max-width: 200px)' },
          ],
        }),
      ).toEqual({
        blocks: true,
        diagnostics: [
          'unknown-breakpoint-mode: "Watch" (breakpoints.modes) is not a mode of "Screen"; its media query is not used.',
          'breakpoint-mode-without-query: The mode "Tablet" of "Screen" has no media query in breakpoints.modes, so its tokens are not written.',
        ],
      })
    })
  })

  it('handles a brand token that shadows a primitive by aliasing its own path', async () => {
    const model = modelFrom({
      'Base.Value.json': { Color: { Red: { $type: 'color', $value: '#ff0000' } } },
      'Brand.A.json': { Color: { Red: { $type: 'color', $value: '{Color.Red}' } } },
      'Brand.B.json': { Color: { Red: { $type: 'color', $value: '#00ff00' } } },
    })
    const { files } = await buildOutputs(model, { brands: ['A', 'B'] })
    expect(find(files, 'output/css/themes/b.css')).toContain('--color-red: #00ff00;')
    // nothing is left to emit for A (Style Dictionary writes no empty files)
    expect(find(files, 'output/css/themes/a.css')).toBeUndefined()
  })
})

describe('buildOutputs: options', () => {
  const model = fixtureModel('brand-ab')

  it('only builds from the listed collections', async () => {
    const { files } = await buildOutputs(model, { collections: ['Primitives'], brands: ['BrandA'] })
    const base = find(files, 'output/css/base.css') ?? ''
    expect(base).toContain('--colors-foundation-blue-500')
    expect(base).not.toContain('--colors-brand-primary')
  })

  it('warns about a listed collection that does not exist', async () => {
    const { diagnostics } = await buildOutputs(model, { collections: ['Primitives', 'Nope'] })
    expect(diagnostics).toMatchObject([{ severity: 'warning', code: 'unknown-collection' }])
  })

  it('writes CSS and Tailwind files below the configured directories', async () => {
    const { files } = await buildOutputs(model, {
      brands: ['BrandA'],
      css: { outDir: 'dist/styles/' },
      tailwind: { outDir: 'dist/tw' },
    })
    expect(files.map((f) => f.path)).toEqual([
      'dist/styles/base.css',
      'dist/styles/themes/branda.css',
      'dist/styles/variables.css',
      'dist/tw/branda/tailwind.css',
      'dist/tw/branda/tailwind.tokens.ts',
      'dist/tw/tailwind.css',
      'dist/tw/tailwind.tokens.ts',
      'output/js/colorpalette.js',
    ])
  })

  it('uses the default directory and warns when one is blank', async () => {
    const { files, diagnostics } = await buildOutputs(model, { css: { outDir: '  ' } })
    expect(files.some((f) => f.path === 'output/css/base.css')).toBe(true)
    expect(diagnostics).toMatchObject([{ severity: 'warning', code: 'invalid-option' }])
  })
})

describe('buildOutputs: formats', () => {
  const brands = ['BrandA', 'BrandB']
  const paths = async (formats?: (typeof OUTPUT_FORMATS)[number][]) =>
    (await buildOutputs(fixtureModel('brand-ab'), { brands, formats })).files.map((f) => f.path)

  it('writes every output without formats, the same as with all of them', async () => {
    const all = await paths()
    expect(all).toHaveLength(11)
    expect(await paths([...OUTPUT_FORMATS])).toEqual(all)
  })

  it.each([
    [
      'css',
      [
        'output/css/base.css',
        'output/css/themes/branda.css',
        'output/css/themes/brandb.css',
        'output/css/variables.css',
      ],
    ],
    [
      'tailwind-v4',
      [
        'output/tailwind/branda/tailwind.css',
        'output/tailwind/brandb/tailwind.css',
        'output/tailwind/tailwind.css',
      ],
    ],
    [
      'tailwind-v3',
      [
        'output/tailwind/branda/tailwind.tokens.ts',
        'output/tailwind/brandb/tailwind.tokens.ts',
        'output/tailwind/tailwind.tokens.ts',
      ],
    ],
    ['js', ['output/js/colorpalette.js']],
  ] as const)('writes only the %s files when asked for that output', async (format, expected) => {
    expect(await paths([format])).toEqual(expected)
  })

  it('says which output each file belongs to', async () => {
    const { files } = await buildOutputs(fixtureModel('brand-ab'), { brands })
    for (const format of OUTPUT_FORMATS) {
      const alone = await paths([format])
      expect(
        files.filter((file) => file.format === format).map((file) => file.path),
        format,
      ).toEqual(alone)
    }
    expect(files.every((file) => file.format !== undefined)).toBe(true)
  })

  it('gives each file the same content as a build of every output', async () => {
    const all = await buildOutputs(fixtureModel('brand-ab'), { brands })
    const some = await buildOutputs(fixtureModel('brand-ab'), { brands, formats: ['js', 'css'] })
    for (const file of some.files) expect(file.content).toBe(find(all.files, file.path))
    expect(some.diagnostics).toEqual(all.diagnostics)
  })

  it('writes nothing for an empty list', async () => {
    expect(await paths([])).toEqual([])
  })
})

describe('buildOutputs: parity with the v1 build', () => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      return entry.isDirectory() ? walk(full) : [full]
    })

  for (const [fixture, brands] of [
    ['brand-ab', ['BrandA', 'BrandB']],
    ['daisyui', []],
  ] as const) {
    it(`produces exactly the CSS, JS and Tailwind files of the ${fixture} snapshot`, async () => {
      const root = path.join(repoRoot, 'test', 'snapshots', fixture, 'build', 'files')
      const expected = walk(root)
        .map((file) => path.relative(root, file).split(path.sep).join('/'))
        .sort()

      const { files, diagnostics } = await buildOutputs(fixtureModel(fixture), {
        ...fixtureOptions(fixture),
        brands: [...brands],
      })

      expect(files.map((f) => f.path)).toEqual(expected)
      for (const file of files) expect(file.content, file.path).toBe(snapshot(fixture, file.path))
      expect(diagnostics).toEqual([])
    })

    it(`gives identical files in identical order on a second run (${fixture})`, async () => {
      const first = await buildOutputs(fixtureModel(fixture), { brands: [...brands] })
      const second = await buildOutputs(fixtureModel(fixture), { brands: [...brands] })
      expect(second).toEqual(first)
    })
  }
})

describe('buildOutputs: purity', () => {
  it('does not mutate the model', async () => {
    const model = fixtureModel('brand-ab')
    const before = structuredClone(model)
    await buildOutputs(model, { brands: ['BrandA', 'BrandB'] })
    expect(model).toEqual(before)
  })

  it('does not write any file', async () => {
    const cwd = process.cwd()
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-build-'))
    process.chdir(dir)
    try {
      await buildOutputs(fixtureModel('brand-ab'), {})
      expect(fs.readdirSync(dir)).toEqual([])
    } finally {
      process.chdir(cwd)
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('buildOutputs: broken aliases (TICKET-119, the brand-ab-problems fixture)', () => {
  const brands = ['BrandA', 'BrandB']

  it('reports the dangling and the circular alias as errors, worded as dta lint words them', async () => {
    const { diagnostics } = await buildOutputs(fixtureModel('brand-ab-problems'), { brands })
    expect(diagnostics.map((d) => [d.severity, d.code, d.message, d.file])).toEqual([
      [
        'error',
        'dangling-alias',
        'Alias {Colors.Foundation.Sky.550} references non-existent token "Colors.Foundation.Sky.550"',
        'Brand(Alias).BrandB.json',
      ],
      [
        'error',
        'circular-alias',
        'Circular alias chain: Brand(Alias).BrandA/Colors/Surface/Muted → Brand(Alias).BrandA/Colors/Text/Muted → Brand(Alias).BrandA/Colors/Surface/Muted',
        'Brand(Alias).BrandA.json',
      ],
    ])
  })

  it('writes no broken declaration into any output', async () => {
    const { files } = await buildOutputs(fixtureModel('brand-ab-problems'), { brands })
    expect(new Set(files.map((file) => file.format))).toEqual(new Set(OUTPUT_FORMATS))
    for (const file of files) {
      // No unresolved alias, in CSS, Tailwind v4/v3 or JS
      expect(file.content, file.path).not.toMatch(/\{[A-Z][^{}]*\.[^{}]*\}/)
      // No custom property that refers to itself
      for (const [, name, value] of file.content.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
        expect(value, `${file.path} ${name}`).not.toContain(`var(${name})`)
      }
    }
    const branda = find(files, 'output/css/themes/branda.css') ?? ''
    const brandb = find(files, 'output/css/themes/brandb.css') ?? ''
    expect(branda).not.toMatch(/muted/i)
    expect(brandb).not.toMatch(/accent/i)
    // The tokens that resolve are still there: the files are not what dta build writes (it
    // writes nothing while there are errors), but what dta diff reads.
    expect(brandb).toContain('--colors-surface-muted: var(--colors-foundation-gray-100);')
    expect(branda).toContain('--colors-brand-accent:')
  })
})
