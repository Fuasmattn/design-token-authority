import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfigError, defineConfig, loadConfig } from './index.js'

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-cli-config-')))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function write(name: string, content: string): string {
  const file = path.join(dir, name)
  fs.writeFileSync(file, content)
  return file
}

/** Load and return the ConfigError (fails the test if loading succeeds). */
async function loadError(options: Parameters<typeof loadConfig>[0]): Promise<ConfigError> {
  try {
    await loadConfig(options)
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError)
    return error as ConfigError
  }
  throw new Error('expected loadConfig to throw')
}

describe('defineConfig', () => {
  it('returns the config unchanged (it only adds editor types)', () => {
    const config = { figma: { source: 'file' as const } }
    expect(defineConfig(config)).toBe(config)
  })
})

describe('loadConfig: finding and reading the file', () => {
  it('loads a TypeScript config with a default export', async () => {
    write('dta.config.ts', `export default { figma: { source: 'file' }, brands: ['BrandA'] }\n`)
    const { config, filePath } = await loadConfig({ cwd: dir })
    expect(config.brands).toEqual(['BrandA'])
    expect(filePath).toBe(path.join(dir, 'dta.config.ts'))
  })

  it('loads a JSON config', async () => {
    write('dta.config.json', JSON.stringify({ figma: { source: 'api' }, collections: ['Brand'] }))
    const { config } = await loadConfig({ cwd: dir })
    expect(config.collections).toEqual(['Brand'])
  })

  it('loads an explicit --config path, relative to cwd or absolute', async () => {
    write('custom.json', JSON.stringify({ brands: ['X'] }))
    expect((await loadConfig({ cwd: dir, configPath: 'custom.json' })).config.brands).toEqual(['X'])
    const absolute = path.join(dir, 'custom.json')
    expect((await loadConfig({ cwd: '/', configPath: absolute })).config.brands).toEqual(['X'])
  })

  it('fails with a helpful message when there is no config', async () => {
    const error = await loadError({ cwd: dir })
    expect(error.code).toBe('not-found')
    expect(error.message).toContain(dir)
    expect(error.message).toContain('dta.config.ts')
  })

  it('fails when an explicit config path does not exist', async () => {
    const error = await loadError({ cwd: dir, configPath: 'nope.json' })
    expect(error.code).toBe('not-found')
    expect(error.message).toContain('nope.json')
  })

  it('refuses to guess when several config files exist', async () => {
    write('dta.config.ts', `export default {}\n`)
    write('dta.config.json', `{}`)
    const error = await loadError({ cwd: dir })
    expect(error.code).toBe('multiple-files')
    expect(error.message).toContain('dta.config.ts')
    expect(error.message).toContain('dta.config.json')
  })

  it('reports broken JSON with the file name', async () => {
    write('dta.config.json', `{ "brands": [ }`)
    const error = await loadError({ cwd: dir })
    expect(error.code).toBe('unreadable')
    expect(error.message).toContain('dta.config.json')
  })

  it('reports a TypeScript config that throws while loading', async () => {
    write('dta.config.ts', `throw new Error('boom')\nexport default {}\n`)
    const error = await loadError({ cwd: dir })
    expect(error.code).toBe('unreadable')
    expect(error.message).toContain('boom')
  })

  it('requires a default export in script configs', async () => {
    write('dta.config.ts', `export const brands = ['A']\n`)
    const error = await loadError({ cwd: dir })
    expect(error.code).toBe('unreadable')
    expect(error.message).toMatch(/default export/)
  })
})

describe('loadConfig: validation and defaults', () => {
  it('applies defaults to an empty config', async () => {
    write('dta.config.json', `{}`)
    const { config } = await loadConfig({ cwd: dir })
    expect(config.tokens).toEqual({ dir: 'tokens', stripEmojis: false })
    expect(config.figma).toEqual({})
    expect(config.outputs).toBeUndefined()
  })

  it('applies output target defaults', async () => {
    write(
      'dta.config.json',
      JSON.stringify({
        outputs: {
          css: { outDir: 'out/css' },
          tailwind: { outDir: 'out/tw' },
          ios: { outDir: 'out/ios' },
          android: { outDir: 'out/android' },
        },
      }),
    )
    const { config } = await loadConfig({ cwd: dir })
    expect(config.outputs).toEqual({
      css: { outDir: 'out/css' },
      tailwind: { outDir: 'out/tw' },
      ios: { outDir: 'out/ios', lang: 'swift' },
      android: { outDir: 'out/android', lang: 'xml' },
    })
  })

  it('accepts the full v1 option set', async () => {
    write(
      'dta.config.json',
      JSON.stringify({
        figma: { fileKey: 'abc', personalAccessToken: 'tok', source: 'api' },
        collections: ['Primitives', 'Brand'],
        layers: { primitives: 'Primitives', brand: 'Brand', dimension: 'ScreenType' },
        brands: ['BrandA', 'BrandB'],
        tokens: { dir: 'my-tokens', stripEmojis: true },
        lint: {
          rules: {
            'semantic-must-alias': { severity: 'error', collections: ['Brand'] },
            'naming-pattern': { severity: 'warn', patterns: { Brand: '^[A-Z]' } },
            'color-contrast': {
              severity: 'warn',
              minRatio: 4.5,
              pairs: [['Text', 'Surface']],
            },
            'no-duplicate-values': { severity: 'off' },
          },
        },
        push: { skipConfirmation: true },
      }),
    )
    const { config } = await loadConfig({ cwd: dir })
    expect(config.tokens).toEqual({ dir: 'my-tokens', stripEmojis: true })
    expect(config.push?.skipConfirmation).toBe(true)
    expect(config.lint?.rules?.['color-contrast']?.pairs).toEqual([['Text', 'Surface']])
  })

  async function invalid(raw: unknown): Promise<ConfigError> {
    write('dta.config.json', JSON.stringify(raw))
    const error = await loadError({ cwd: dir })
    expect(error.code).toBe('invalid')
    return error
  }

  it('names the field and the problem for a wrong type', async () => {
    const error = await invalid({ outputs: { css: { outDir: 42 } } })
    expect(error.issues).toEqual([{ path: 'outputs.css.outDir', message: expect.any(String) }])
    expect(error.message).toContain('outputs.css.outDir')
    expect(error.message).toContain('dta.config.json')
  })

  it('rejects unknown keys so typos do not pass silently', async () => {
    const error = await invalid({ outputs: { css: { outDir: 'a', prefx: '--' } } })
    expect(error.issues[0].path).toBe('outputs.css')
    expect(error.message).toContain('prefx')
  })

  it('rejects outputs.docs with a message that it was removed in v2', async () => {
    const error = await invalid({ outputs: { docs: { outDir: 'output/docs' } } })
    expect(error.issues).toEqual([
      { path: 'outputs.docs', message: expect.stringContaining('removed in v2') },
    ])
    expect(error.message).toContain('Delete this key')
  })

  it('rejects outputs.css.prefix with a message that it was removed, and only that', async () => {
    const error = await invalid({ outputs: { css: { outDir: 'output/css', prefix: '--' } } })
    expect(error.issues).toEqual([
      {
        path: 'outputs.css.prefix',
        message:
          'was removed: it never had an effect (CSS variable names always start with --). Delete this line.',
      },
    ])
    expect(error.message).not.toContain('Unrecognized')
  })

  it('rejects outputs.tailwind.version with a message that names outputs.formats, and only that', async () => {
    for (const version of [3, 4]) {
      const error = await invalid({ outputs: { tailwind: { outDir: 'output/tailwind', version } } })
      expect(error.issues).toEqual([
        {
          path: 'outputs.tailwind.version',
          message:
            "was removed: it never had an effect. `outputs.formats` chooses the Tailwind versions ('tailwind-v4', 'tailwind-v3'). Delete this line.",
        },
      ])
      expect(error.message).not.toContain('Unrecognized')
    }
  })

  describe('breakpoints (TICKET-091)', () => {
    const breakpoints = {
      collection: 'ScreenType',
      default: 'Mobile',
      modes: { Tablet: '(min-width: 768px)', Desktop: '(min-width: 1024px)' },
    }

    it('accepts a collection, a default mode and media queries, keeping their order', async () => {
      write('dta.config.json', JSON.stringify({ breakpoints }))
      const { config } = await loadConfig({ cwd: dir })
      expect(config.breakpoints).toEqual(breakpoints)
      expect(Object.keys(config.breakpoints?.modes ?? {})).toEqual(['Tablet', 'Desktop'])
    })

    it('rejects the default mode in modes, a query with @media, a selector and no modes', async () => {
      const paths = async (value: unknown) =>
        (await invalid({ breakpoints: value })).issues.map((i) => `${i.path}: ${i.message}`)
      expect(
        await paths({
          ...breakpoints,
          modes: { ...breakpoints.modes, Mobile: '(max-width: 1px)' },
        }),
      ).toEqual([
        'breakpoints.modes.Mobile: is the default mode, which is written on :root without a media query: remove it from modes',
      ])
      expect(
        await paths({ ...breakpoints, modes: { Tablet: '@media (min-width: 768px)' } }),
      ).toEqual([
        'breakpoints.modes.Tablet: is the media query without "@media", e.g. (min-width: 1024px)',
      ])
      expect(await paths({ ...breakpoints, modes: { Tablet: '[data-screen="tablet"]' } })).toEqual([
        'breakpoints.modes.Tablet: must be a media query such as (min-width: 1024px); selectors are not supported',
      ])
      expect(await paths({ ...breakpoints, modes: {} })).toEqual([
        'breakpoints.modes: needs at least one mode',
      ])
      expect(await paths({ collection: 'ScreenType', modes: breakpoints.modes })).toEqual([
        expect.stringMatching(/^breakpoints.default: /),
      ])
    })
  })

  it('rejects values outside the allowed set', async () => {
    const error = await invalid({
      figma: { source: 'cloud' },
      outputs: { formats: ['tailwind-v5'] },
      lint: { rules: { 'no-duplicate-values': { severity: 'fatal' } } },
    })
    expect(error.issues.map((i) => i.path).sort()).toEqual([
      'figma.source',
      'lint.rules.no-duplicate-values.severity',
      'outputs.formats[0]',
    ])
  })

  it('rejects empty strings where a name or path is required', async () => {
    const error = await invalid({ brands: [''], tokens: { dir: '' } })
    expect(error.issues.map((i) => i.path).sort()).toEqual(['brands[0]', 'tokens.dir'])
  })

  it('rejects an invalid regular expression in naming patterns', async () => {
    const error = await invalid({
      lint: { rules: { 'naming-pattern': { patterns: { Brand: '([' } } } },
    })
    expect(error.issues[0].path).toBe('lint.rules.naming-pattern.patterns.Brand')
    expect(error.issues[0].message).toMatch(/regular expression/)
  })

  it('rejects malformed color-contrast pairs', async () => {
    const error = await invalid({
      lint: { rules: { 'color-contrast': { pairs: [['only-one']] } } },
    })
    expect(error.issues[0].path).toBe('lint.rules.color-contrast.pairs[0]')
  })

  it('reports every problem at once', async () => {
    const error = await invalid({
      brands: 'BrandA',
      tokens: { dir: 1 },
      push: { skipConfirmation: 'yes' },
    })
    expect(error.issues).toHaveLength(3)
  })

  it('rejects a config that is not an object', async () => {
    const error = await invalid(['not', 'an', 'object'])
    expect(error.issues[0].path).toBe('config')
  })
})
