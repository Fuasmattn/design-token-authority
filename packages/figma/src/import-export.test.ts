import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { nameToDot, serializeTokenFiles } from '@dta/core'
import type { TokenModel } from '@dta/core'
import { detectFormat, importPluginExport, tokenFileSchema } from './index.js'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')

const figmaMeta = { 'com.figma': { modes: {} } }

/** Order-independent view of the collections, modes and tokens in a model. */
function view(model: TokenModel) {
  return Object.fromEntries(
    model.collections.map((c) => [
      c.name,
      {
        modes: c.modes,
        tokens: Object.fromEntries(
          c.tokens.map((t) => [nameToDot(t.name), { type: t.type, values: t.values }]),
        ),
      },
    ]),
  )
}

function tokenHaus(collections: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { $name: 'Test', $extensions: figmaMeta, ...collections, ...extra }
}

describe('importPluginExport: tokenHaus exports', () => {
  it('splits multi-mode tokens into one mode each', () => {
    const { format, model, diagnostics } = importPluginExport(
      tokenHaus({
        Theme: {
          color: {
            primary: {
              $type: 'color',
              $value: { Light: '#ffffff', Dark: '#000000' },
              $extensions: { 'com.figma': { scopes: ['ALL_SCOPES'] } },
            },
          },
        },
      }),
    )

    expect(format).toBe('tokenhaus')
    expect(diagnostics).toEqual([])
    expect(view(model)).toEqual({
      Theme: {
        modes: ['Dark', 'Light'],
        tokens: {
          'color.primary': { type: 'color', values: { Light: '#ffffff', Dark: '#000000' } },
        },
      },
    })
    expect(model.collections[0].tokens[0].extensions).toEqual({
      'com.figma': { scopes: ['ALL_SCOPES'] },
    })
  })

  it('puts single-mode tokens in a "Mode 1" mode and keeps descriptions', () => {
    const { model } = importPluginExport(
      tokenHaus({
        Spacing: {
          small: { $type: 'number', $value: 4 },
          large: { $type: 'number', $value: 32, $description: 'Large spacing' },
        },
      }),
    )

    expect(view(model)).toEqual({
      Spacing: {
        modes: ['Mode 1'],
        tokens: {
          small: { type: 'number', values: { 'Mode 1': 4 } },
          large: { type: 'number', values: { 'Mode 1': 32 } },
        },
      },
    })
    expect(model.collections[0].tokens[1].description).toBe('Large spacing')
  })

  it('skips the root metadata keys', () => {
    const { model } = importPluginExport(
      tokenHaus({ Tokens: { value: { $type: 'number', $value: 42 } } }, { $description: 'About' }),
    )
    expect(model.collections.map((c) => c.name)).toEqual(['Tokens'])
  })

  it('handles deeply nested groups', () => {
    const { model } = importPluginExport(
      tokenHaus({ Design: { typography: { heading: { size: { $type: 'number', $value: 24 } } } } }),
    )
    expect(view(model).Design.tokens).toEqual({
      'typography.heading.size': { type: 'number', values: { 'Mode 1': 24 } },
    })
  })

  it('handles single-mode and multi-mode tokens in one collection', () => {
    const { model } = importPluginExport(
      tokenHaus({
        Mixed: {
          spacing: { $type: 'number', $value: 8 },
          color: { $type: 'color', $value: { Light: '#fff', Dark: '#000' } },
        },
      }),
    )
    expect(model.collections[0].modes).toEqual(['Dark', 'Light', 'Mode 1'])
    expect(view(model).Mixed.tokens).toEqual({
      spacing: { type: 'number', values: { 'Mode 1': 8 } },
      color: { type: 'color', values: { Light: '#fff', Dark: '#000' } },
    })
  })

  it('strips the collection name from aliases', () => {
    const { model, diagnostics } = importPluginExport(
      tokenHaus({
        Colors: { blue: { 500: { $type: 'color', $value: '#0057b8' } } },
        Semantic: {
          primary: {
            $type: 'color',
            $value: { Light: '{Colors.blue.500}', Dark: '{Colors.blue.500}' },
          },
        },
      }),
    )
    expect(diagnostics).toEqual([])
    expect(view(model).Semantic.tokens.primary.values).toEqual({
      Light: '{blue.500}',
      Dark: '{blue.500}',
    })
  })

  it('handles boolean tokens', () => {
    const { model } = importPluginExport(
      tokenHaus({ Flags: { enabled: { $type: 'boolean', $value: { On: true, Off: false } } } }),
    )
    expect(view(model).Flags.tokens.enabled.values).toEqual({ On: true, Off: false })
  })

  it('reports a collection name with a dot instead of mis-splitting file names', () => {
    const { model, diagnostics } = importPluginExport(
      tokenHaus({ 'v1.2': { a: { $type: 'number', $value: 1 } } }),
    )
    expect(model.collections).toEqual([])
    expect(diagnostics).toMatchObject([{ severity: 'error', code: 'invalid-collection-name' }])
  })

  it('reports tokens of an unsupported type, through the token model diagnostics', () => {
    const { diagnostics } = importPluginExport(
      tokenHaus({ A: { x: { $type: 'dimension', $value: '4px' } } }),
    )
    expect(diagnostics.map((d) => d.code)).toEqual(['unsupported-type'])
  })

  it('converts a real export (daisyUI) into a model that serializes to valid token files', () => {
    const data = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'docs', 'token-files', 'design-tokens-daisyui.json'),
        'utf-8',
      ),
    ) as unknown
    const { format, model, diagnostics } = importPluginExport(data)

    expect(format).toBe('tokenhaus')
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    // the same 22 collections and 41 collection/mode files the fixture holds
    expect(model.collections).toHaveLength(22)
    expect(model.collections.reduce((sum, c) => sum + c.modes.length, 0)).toBe(41)
    for (const file of serializeTokenFiles(model)) {
      const result = tokenFileSchema.safeParse(JSON.parse(file.content))
      expect(result.success, file.fileName).toBe(true)
    }
  })
})

describe('importPluginExport: other input', () => {
  it('explains that per-mode DTCG files are read as they are', () => {
    const { format, model, diagnostics } = importPluginExport({
      Colors: { Primary: { $type: 'color', $value: '#003f8a' } },
    })
    expect(format).toBe('dtcg-per-mode')
    expect(model.collections).toEqual([])
    expect(diagnostics).toMatchObject([{ severity: 'error', code: 'native-format' }])
    expect(diagnostics[0].message).toContain('{Collection}.{Mode}.json')
  })

  it('points to the format documentation for unknown formats', () => {
    const { format, diagnostics } = importPluginExport({ foo: 'bar' })
    expect(format).toBe('unknown')
    expect(diagnostics).toMatchObject([{ severity: 'error', code: 'unknown-format' }])
    expect(diagnostics[0].message).toContain('docs/token-files/input-format.md')
  })

  it.each([null, 42, 'text', [], true])('never throws on %j and says what it expected', (input) => {
    const result = importPluginExport(input)
    expect(result.format).toBe('unknown')
    expect(result.diagnostics).toMatchObject([{ severity: 'error', code: 'invalid-export' }])
  })
})

describe('detectFormat', () => {
  it('detects tokenHaus by its modes metadata', () => {
    expect(detectFormat({ $extensions: { 'com.figma': { modes: { 'col:1': ['m:1'] } } } })).toBe(
      'tokenhaus',
    )
  })

  it('detects per-mode DTCG by scalar token values', () => {
    expect(detectFormat({ Colors: { Primary: { $type: 'color', $value: '#003f8a' } } })).toBe(
      'dtcg-per-mode',
    )
  })

  it('returns unknown for empty and non-token objects', () => {
    expect(detectFormat({})).toBe('unknown')
    expect(detectFormat({ foo: 'bar', baz: 42 })).toBe('unknown')
  })

  it('prefers tokenHaus when both patterns are present', () => {
    const data = {
      $extensions: { 'com.figma': { modes: { 'col:1': ['m:1'] } } },
      Colors: { Primary: { $type: 'color', $value: '#fff' } },
    }
    expect(detectFormat(data)).toBe('tokenhaus')
  })

  it('does not throw on input that is not an object', () => {
    expect(detectFormat(null)).toBe('unknown')
    expect(detectFormat('x')).toBe('unknown')
  })
})
