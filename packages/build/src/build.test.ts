import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTokenFiles } from '@dta/core'
import type { TokenModel } from '@dta/core'
import { buildOutputs } from './index.js'

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

  it('reports aliases to tokens that do not exist as warnings', async () => {
    const model = modelFrom({
      'Base.Value.json': { Link: { $type: 'color', $value: '{Nowhere.Fast}' } },
    })
    const { diagnostics } = await buildOutputs(model, {})
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
    it(`writes variables.css and the JS palette for ${fixture} exactly as the v1 build did`, async () => {
      const { files } = await buildOutputs(fixtureModel(fixture), { brands: [] })
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

  it('warns once about an alias that no layer defines', async () => {
    const model = modelFrom({
      'Base.Value.json': { Color: { Red: { $type: 'color', $value: '#ff0000' } } },
      'Brand.A.json': { Accent: { $type: 'color', $value: '{Missing.Thing}' } },
      'Brand.B.json': { Accent: { $type: 'color', $value: '{Missing.Thing}' } },
    })
    const { diagnostics } = await buildOutputs(model, { brands: ['A'] })
    expect(diagnostics).toMatchObject([{ code: 'broken-reference', path: ['Accent'] }])
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
