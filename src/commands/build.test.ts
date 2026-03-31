import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { discoverCollections, runBuild } from './build.js'
import { Config } from '../config/index.js'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TEST_DIR = '__test_build__'
const TOKENS_DIR = `${TEST_DIR}/tokens`
const OUTPUT_DIR = `${TEST_DIR}/output`

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    figma: {},
    tokens: { dir: TOKENS_DIR },
    outputs: {
      css: { outDir: `${OUTPUT_DIR}/css` },
      tailwind: { outDir: `${OUTPUT_DIR}/tailwind` },
      docs: { outDir: `${OUTPUT_DIR}/docs` },
    },
    ...overrides,
  }
}

function writeToken(filename: string, data: Record<string, unknown>): void {
  fs.writeFileSync(path.join(TOKENS_DIR, filename), JSON.stringify(data, null, 2))
}

/** Minimal Primitives collection — single mode, raw color + number values. */
const PRIMITIVES_TOKEN = {
  Colors: {
    Blue: {
      500: {
        $type: 'color',
        $value: '#003f8a',
        $extensions: {
          'com.figma': { hiddenFromPublishing: false, scopes: ['ALL_SCOPES'], codeSyntax: {} },
        },
      },
      700: {
        $type: 'color',
        $value: '#002b5c',
        $extensions: {
          'com.figma': { hiddenFromPublishing: false, scopes: ['ALL_SCOPES'], codeSyntax: {} },
        },
      },
    },
  },
  Dimensions: {
    spacing: {
      4: {
        $type: 'number',
        $value: 16,
        $extensions: {
          'com.figma': {
            hiddenFromPublishing: false,
            scopes: ['GAP', 'WIDTH_HEIGHT'],
            codeSyntax: {},
          },
        },
      },
    },
  },
  Effects: {
    opacity: {
      50: {
        $type: 'number',
        $value: 50,
        $extensions: {
          'com.figma': { hiddenFromPublishing: false, scopes: ['OPACITY'], codeSyntax: {} },
        },
      },
    },
  },
}

/** Brand collection — multi-mode, aliases into Primitives. */
const BRAND_A_TOKEN = {
  Colors: {
    Brand: {
      Primary: {
        $type: 'color',
        $value: '{Colors.Blue.500}',
      },
    },
  },
}

const BRAND_B_TOKEN = {
  Colors: {
    Brand: {
      Primary: {
        $type: 'color',
        $value: '{Colors.Blue.700}',
      },
    },
  },
}

// ---------------------------------------------------------------------------
// discoverCollections — unit tests
// ---------------------------------------------------------------------------

describe('discoverCollections', () => {
  beforeEach(() => {
    fs.mkdirSync(TOKENS_DIR, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('discovers collections and modes from token filenames', () => {
    writeToken('Primitives(Global).Value.json', {})
    writeToken('Brand(Alias).BrandA.json', {})
    writeToken('Brand(Alias).BrandB.json', {})
    writeToken('ScreenType.Desktop.json', {})
    writeToken('ScreenType.Mobile.json', {})

    const result = discoverCollections(TOKENS_DIR)

    expect(result.get('Primitives(Global)')).toEqual(['Value'])
    expect(result.get('Brand(Alias)')?.sort()).toEqual(['BrandA', 'BrandB'])
    expect(result.get('ScreenType')?.sort()).toEqual(['Desktop', 'Mobile'])
    expect(result.size).toBe(3)
  })

  it('returns empty map for nonexistent directory', () => {
    const result = discoverCollections('__nonexistent__')
    expect(result.size).toBe(0)
  })

  it('ignores non-JSON files', () => {
    writeToken('Primitives.Value.json', {})
    fs.writeFileSync(path.join(TOKENS_DIR, 'README.md'), '# readme')
    fs.writeFileSync(path.join(TOKENS_DIR, '.DS_Store'), '')

    const result = discoverCollections(TOKENS_DIR)
    expect(result.size).toBe(1)
    expect(result.get('Primitives')).toEqual(['Value'])
  })

  it('ignores JSON files without a dot separator (no mode)', () => {
    fs.writeFileSync(path.join(TOKENS_DIR, 'metadata.json'), '{}')
    writeToken('Primitives.Value.json', {})

    const result = discoverCollections(TOKENS_DIR)
    expect(result.size).toBe(1)
  })

  it('handles collection names with dots (uses first dot as separator)', () => {
    writeToken('Brand.A.BrandA.json', {})

    const result = discoverCollections(TOKENS_DIR)
    // First dot splits: collection = 'Brand', mode = 'A.BrandA'
    expect(result.get('Brand')).toEqual(['A.BrandA'])
  })

  it('handles empty directory', () => {
    const result = discoverCollections(TOKENS_DIR)
    expect(result.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// runBuild — integration tests
// ---------------------------------------------------------------------------

describe('runBuild', () => {
  beforeEach(() => {
    fs.mkdirSync(TOKENS_DIR, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('generates CSS, JS, and Tailwind output from single-mode tokens', async () => {
    writeToken('Primitives.Value.json', PRIMITIVES_TOKEN)

    await runBuild(makeConfig(), { verbose: false })

    // Phase A — base.css
    const baseCss = fs.readFileSync(`${OUTPUT_DIR}/css/base.css`, 'utf-8')
    expect(baseCss).toContain(':root')
    expect(baseCss).toContain('#003f8a')

    // Phase C — variables.css
    const varsCss = fs.readFileSync(`${OUTPUT_DIR}/css/variables.css`, 'utf-8')
    expect(varsCss).toContain(':root')
    expect(varsCss).toContain('#003f8a')

    // Phase C — colorpalette.js
    const js = fs.readFileSync('output/js/colorpalette.js', 'utf-8')
    expect(js).toContain('export')

    // Phase C — Tailwind v3
    const twV3 = fs.readFileSync(`${OUTPUT_DIR}/tailwind/tailwind.tokens.ts`, 'utf-8')
    expect(twV3).toContain('colors')

    // Phase C — Tailwind v4
    const twV4 = fs.readFileSync(`${OUTPUT_DIR}/tailwind/tailwind.css`, 'utf-8')
    expect(twV4).toContain('@theme')

    // Phase D — docs
    const docs = fs.readFileSync(`${OUTPUT_DIR}/docs/index.html`, 'utf-8')
    expect(docs).toContain('<html')
  }, 30_000)

  it('applies dimension-px transform for tokens with GAP/WIDTH_HEIGHT scopes', async () => {
    writeToken('Primitives.Value.json', PRIMITIVES_TOKEN)

    await runBuild(makeConfig(), { verbose: false })

    const css = fs.readFileSync(`${OUTPUT_DIR}/css/variables.css`, 'utf-8')
    expect(css).toMatch(/16px/)
  }, 30_000)

  it('applies opacity-decimal transform for OPACITY scoped tokens', async () => {
    writeToken('Primitives.Value.json', PRIMITIVES_TOKEN)

    await runBuild(makeConfig(), { verbose: false })

    const css = fs.readFileSync(`${OUTPUT_DIR}/css/variables.css`, 'utf-8')
    // 50 → 0.5
    expect(css).toContain('0.5')
  }, 30_000)

  it('generates per-brand theme CSS when brands are configured', async () => {
    writeToken('Primitives.Value.json', PRIMITIVES_TOKEN)
    writeToken('Brand.BrandA.json', BRAND_A_TOKEN)
    writeToken('Brand.BrandB.json', BRAND_B_TOKEN)

    await runBuild(makeConfig({ brands: ['BrandA', 'BrandB'] }), { verbose: false })

    // Phase B — brand theme CSS
    const brandACss = fs.readFileSync(`${OUTPUT_DIR}/css/themes/branda.css`, 'utf-8')
    expect(brandACss).toContain('[data-brand="branda"]')
    // Phase B uses outputReferences: true, so brand CSS contains var() references
    expect(brandACss).toContain('var(--colors-blue-500)')

    const brandBCss = fs.readFileSync(`${OUTPUT_DIR}/css/themes/brandb.css`, 'utf-8')
    expect(brandBCss).toContain('[data-brand="brandb"]')
    expect(brandBCss).toContain('var(--colors-blue-700)')

    // Phase B — per-brand Tailwind
    expect(fs.existsSync(`${OUTPUT_DIR}/tailwind/branda/tailwind.tokens.ts`)).toBe(true)
    expect(fs.existsSync(`${OUTPUT_DIR}/tailwind/branda/tailwind.css`)).toBe(true)
    expect(fs.existsSync(`${OUTPUT_DIR}/tailwind/brandb/tailwind.tokens.ts`)).toBe(true)
    expect(fs.existsSync(`${OUTPUT_DIR}/tailwind/brandb/tailwind.css`)).toBe(true)
  }, 30_000)

  it('deduplicates kebab-case segments in CSS variable names', async () => {
    const token = {
      Colors: {
        Colors: {
          Brand: {
            $type: 'color',
            $value: '#ff0000',
          },
        },
      },
    }
    writeToken('Test.Value.json', token)

    await runBuild(makeConfig(), { verbose: false })

    const css = fs.readFileSync(`${OUTPUT_DIR}/css/variables.css`, 'utf-8')
    // "Colors.Colors.Brand" should deduplicate to "colors-brand", not "colors-colors-brand"
    expect(css).toContain('colors-brand')
    expect(css).not.toContain('colors-colors-brand')
  }, 30_000)

  it('strips self-referencing aliases to avoid circular resolution', async () => {
    // When Brand aliases a Primitives token with the same path,
    // the preprocessor should strip the self-ref so SD doesn't error.
    const primitives = {
      Colors: {
        Primary: {
          $type: 'color',
          $value: '#003f8a',
        },
      },
    }
    const brand = {
      Colors: {
        Primary: {
          $type: 'color',
          $value: '{Colors.Primary}',
        },
      },
    }
    writeToken('Primitives.Value.json', primitives)
    writeToken('Brand.BrandA.json', brand)

    // Should not throw due to circular reference
    await expect(
      runBuild(makeConfig({ brands: ['BrandA'] }), { verbose: false }),
    ).resolves.not.toThrow()
  }, 30_000)

  it('filters to configured collections only', async () => {
    writeToken('Primitives.Value.json', PRIMITIVES_TOKEN)
    writeToken('Unrelated.Value.json', {
      Custom: {
        Token: { $type: 'color', $value: '#abcdef' },
      },
    })

    await runBuild(makeConfig({ collections: ['Primitives'] }), { verbose: false })

    const css = fs.readFileSync(`${OUTPUT_DIR}/css/variables.css`, 'utf-8')
    expect(css).toContain('#003f8a')
    expect(css).not.toContain('#abcdef')
  }, 30_000)

  it('exits gracefully when tokens directory is empty', async () => {
    // No token files, but directory exists — SD phases are skipped,
    // Phase D (docs) still runs and produces an HTML page.
    await expect(runBuild(makeConfig(), { verbose: false })).resolves.not.toThrow()

    expect(fs.existsSync(`${OUTPUT_DIR}/docs/index.html`)).toBe(true)
  }, 30_000)

  it('uses default output paths when config.outputs is not set', async () => {
    writeToken('Primitives.Value.json', PRIMITIVES_TOKEN)

    await runBuild({ figma: {}, tokens: { dir: TOKENS_DIR } }, { verbose: false })

    // Default paths: output/css/, output/tailwind/, output/docs/
    expect(fs.existsSync('output/css/base.css')).toBe(true)
    expect(fs.existsSync('output/css/variables.css')).toBe(true)
    expect(fs.existsSync('output/tailwind/tailwind.tokens.ts')).toBe(true)
    expect(fs.existsSync('output/tailwind/tailwind.css')).toBe(true)
    expect(fs.existsSync('output/docs/index.html')).toBe(true)
  }, 30_000)
})
