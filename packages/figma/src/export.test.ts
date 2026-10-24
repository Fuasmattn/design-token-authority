import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { nameToDot, parseTokenFiles, serializeTokenFiles } from '@dta/core'
import type { TokenFileInput, TokenModel } from '@dta/core'
import { parseVariablesResponse, variablesToModel } from './index.js'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')
const fixtureDir = path.join(repoRoot, 'test', 'fixtures', 'brand-ab', 'tokens')

const recording = parseVariablesResponse(
  JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, 'test', 'recordings', 'brand-ab', 'variables-local.json'),
      'utf-8',
    ),
  ),
)
const fixtureFiles: TokenFileInput[] = fs.readdirSync(fixtureDir).map((fileName) => ({
  fileName,
  content: fs.readFileSync(path.join(fixtureDir, fileName), 'utf-8'),
}))

/** Order-independent view of a model, for comparing exports with parsed files. */
function view(model: TokenModel) {
  return Object.fromEntries(
    model.collections.map((c) => [
      c.name,
      {
        modes: [...c.modes].sort(),
        tokens: Object.fromEntries(
          c.tokens.map((t) => [
            nameToDot(t.name),
            {
              type: t.type,
              values: t.values,
              description: t.description || undefined,
              extensions: t.extensions,
            },
          ]),
        ),
      },
    ]),
  )
}

describe('variablesToModel: the BrandA/BrandB recording', () => {
  const { model, diagnostics } = variablesToModel(recording)

  it('has no diagnostics', () => {
    expect(diagnostics).toEqual([])
  })

  it('equals the model parsed from the fixture token files', () => {
    expect(view(model)).toEqual(view(parseTokenFiles(fixtureFiles).model))
  })

  it('follows Figma’s collection and mode order', () => {
    expect(model.collections.map((c) => [c.name, c.modes])).toEqual([
      ['Primitives', ['Value']],
      ['Brand(Alias)', ['BrandA', 'BrandB']],
      ['ScreenType', ['Desktop', 'Tablet', 'Mobile']],
    ])
  })

  it('serializes to the fixture contents when given the existing files', () => {
    const existing = parseTokenFiles(fixtureFiles).model
    const output = serializeTokenFiles(variablesToModel(recording, { existing }).model)
    expect(output).toHaveLength(fixtureFiles.length)
    for (const original of fixtureFiles) {
      expect(output.find((f) => f.fileName === original.fileName)?.content).toBe(original.content)
    }
  })

  it('updates only what changed in Figma when given the existing files', () => {
    const existing = parseTokenFiles(fixtureFiles).model
    const changed = structuredClone(recording)
    const blue = Object.values(changed.meta.variables).find(
      (v) => v.name === 'Colors/Foundation/Blue/500',
    )!
    blue.valuesByMode[Object.keys(blue.valuesByMode)[0]] = { r: 1, g: 0, b: 0 }
    const output = serializeTokenFiles(variablesToModel(changed, { existing }).model)
    const differing = output.filter(
      (f) => f.content !== fixtureFiles.find((o) => o.fileName === f.fileName)?.content,
    )
    expect(differing.map((f) => f.fileName)).toEqual(['Primitives.Value.json'])
    expect(differing[0].content).toContain('"#ff0000"')
  })
})

/** Smallest valid response: one collection with the given modes and variables. */
function response(
  modes: { modeId: string; name: string }[],
  variables: Record<string, Record<string, unknown>>,
  extra: { collectionRemote?: boolean } = {},
) {
  return parseVariablesResponse({
    status: 200,
    error: false,
    meta: {
      variableCollections: {
        C1: {
          id: 'C1',
          name: 'primitives',
          modes,
          defaultModeId: modes[0].modeId,
          remote: extra.collectionRemote ?? false,
          variableIds: Object.keys(variables),
        },
      },
      variables: Object.fromEntries(
        Object.entries(variables).map(([id, v]) => [
          id,
          {
            id,
            variableCollectionId: 'C1',
            remote: false,
            description: '',
            hiddenFromPublishing: false,
            scopes: ['ALL_SCOPES'],
            codeSyntax: {},
            ...v,
          },
        ]),
      ),
    },
  })
}

const modes = [
  { modeId: '1:0', name: 'mode1' },
  { modeId: '1:1', name: 'mode2' },
]

describe('variablesToModel: conversion rules', () => {
  it('ignores remote variables and remote collections', () => {
    const remoteVariable = response([modes[0]], {
      V1: { name: 'spacing/1', resolvedType: 'FLOAT', valuesByMode: { '1:0': 8 }, remote: true },
    })
    expect(variablesToModel(remoteVariable).model.collections).toEqual([])
    const remoteCollection = response(
      [modes[0]],
      { V1: { name: 'spacing/1', resolvedType: 'FLOAT', valuesByMode: { '1:0': 8 } } },
      { collectionRemote: true },
    )
    expect(variablesToModel(remoteCollection).model.collections).toEqual([])
  })

  it('ignores variables Figma deleted that are still referenced (TICKET-021)', () => {
    const deleted = response([modes[0]], {
      V1: { name: 'spacing/1', resolvedType: 'FLOAT', valuesByMode: { '1:0': 8 } },
      V2: {
        name: 'spacing/old',
        resolvedType: 'FLOAT',
        valuesByMode: { '1:0': 4 },
        deletedButReferenced: true,
      },
    })
    const tokens = variablesToModel(deleted).model.collections[0].tokens
    expect(tokens.map((token) => nameToDot(token.name))).toEqual(['spacing.1'])
  })

  it('maps types, splits names on "/", converts colors to hex and keeps metadata', () => {
    const { model, diagnostics } = variablesToModel(
      response(modes, {
        V1: {
          name: 'spacing/1',
          resolvedType: 'FLOAT',
          valuesByMode: { '1:0': 8, '1:1': 12 },
          description: '8px spacing',
          hiddenFromPublishing: true,
          scopes: ['TEXT_CONTENT'],
          codeSyntax: { WEB: 'web', ANDROID: 'android' },
        },
        V2: {
          name: 'color/brand/radish',
          resolvedType: 'COLOR',
          valuesByMode: {
            '1:0': { r: 1, g: 0.7450980392156863, b: 0.08627450980392157, a: 1 },
            '1:1': { r: 0, g: 0, b: 0, a: 0.5 },
          },
        },
        V3: { name: 'label', resolvedType: 'STRING', valuesByMode: { '1:0': 'a', '1:1': 'b' } },
        V4: { name: 'flag', resolvedType: 'BOOLEAN', valuesByMode: { '1:0': true, '1:1': false } },
      }),
    )
    expect(diagnostics).toEqual([])
    const [spacing, radish, label, flag] = model.collections[0].tokens
    expect(spacing).toEqual({
      name: ['spacing', '1'],
      type: 'number',
      values: { mode1: 8, mode2: 12 },
      description: '8px spacing',
      extensions: {
        'com.figma': {
          hiddenFromPublishing: true,
          scopes: ['TEXT_CONTENT'],
          codeSyntax: { WEB: 'web', ANDROID: 'android' },
        },
      },
    })
    expect(radish).toMatchObject({
      name: ['color', 'brand', 'radish'],
      type: 'color',
      values: { mode1: '#ffbe16', mode2: '#00000080' },
    })
    expect(label).toMatchObject({ type: 'string', values: { mode1: 'a', mode2: 'b' } })
    expect(flag).toMatchObject({ type: 'boolean', values: { mode1: true, mode2: false } })
  })

  it('writes v1-shaped files for new tokens (description always present)', () => {
    const { model } = variablesToModel(
      response([modes[0]], {
        V1: { name: 'g/x', resolvedType: 'FLOAT', valuesByMode: { '1:0': 1 } },
      }),
    )
    const [file] = serializeTokenFiles(model)
    expect(file.fileName).toBe('primitives.mode1.json')
    expect(JSON.parse(file.content)).toEqual({
      g: {
        x: {
          $type: 'number',
          $value: 1,
          $description: '',
          $extensions: {
            'com.figma': { hiddenFromPublishing: false, scopes: ['ALL_SCOPES'], codeSyntax: {} },
          },
        },
      },
    })
  })

  it('turns an alias into a dot reference to the target variable', () => {
    const { model, diagnostics } = variablesToModel(
      response([modes[0]], {
        V1: {
          name: 'color/blue/500',
          resolvedType: 'COLOR',
          valuesByMode: { '1:0': { r: 0, g: 0, b: 1 } },
        },
        V2: {
          name: 'color/brand',
          resolvedType: 'COLOR',
          valuesByMode: { '1:0': { type: 'VARIABLE_ALIAS', id: 'V1' } },
        },
      }),
    )
    expect(diagnostics).toEqual([])
    expect(model.collections[0].tokens[1].values.mode1).toBe('{color.blue.500}')
  })
})

describe('variablesToModel: problems become diagnostics and skip only that value', () => {
  const codes = (r: ReturnType<typeof variablesToModel>) => r.diagnostics.map((d) => d.code)

  it('skips an alias whose target does not exist', () => {
    const result = variablesToModel(
      response(modes, {
        V1: {
          name: 'a',
          resolvedType: 'COLOR',
          valuesByMode: {
            '1:0': { type: 'VARIABLE_ALIAS', id: 'GONE' },
            '1:1': { r: 0, g: 0, b: 0 },
          },
        },
      }),
    )
    expect(codes(result)).toEqual(['unresolved-alias'])
    expect(result.diagnostics[0]).toMatchObject({ severity: 'warning', path: ['a'] })
    expect(result.model.collections[0].tokens[0].values).toEqual({ mode2: '#000000' })
  })

  it('skips a value of the wrong kind', () => {
    const result = variablesToModel(
      response([modes[0]], {
        V1: { name: 'a', resolvedType: 'FLOAT', valuesByMode: { '1:0': 'eight' } },
      }),
    )
    expect(codes(result)).toEqual(['invalid-value'])
    expect(result.model.collections[0].tokens[0].values).toEqual({})
  })

  it('skips a color stored on a number variable', () => {
    const result = variablesToModel(
      response([modes[0]], {
        V1: { name: 'a', resolvedType: 'FLOAT', valuesByMode: { '1:0': { r: 0, g: 0, b: 0 } } },
      }),
    )
    expect(codes(result)).toEqual(['invalid-value'])
  })

  it('reports a mode without a value', () => {
    const result = variablesToModel(
      response(modes, { V1: { name: 'a', resolvedType: 'FLOAT', valuesByMode: { '1:0': 1 } } }),
    )
    expect(codes(result)).toEqual(['missing-value'])
    expect(result.model.collections[0].tokens[0].values).toEqual({ mode1: 1 })
  })

  it('reports two modes with the same name and keeps the first', () => {
    const result = variablesToModel(
      response(
        [
          { modeId: '1:0', name: 'same' },
          { modeId: '1:1', name: 'same' },
        ],
        { V1: { name: 'a', resolvedType: 'FLOAT', valuesByMode: { '1:0': 1, '1:1': 2 } } },
      ),
    )
    expect(codes(result)).toEqual(['duplicate-mode-name'])
    expect(result.model.collections[0]).toMatchObject({
      modes: ['same'],
      tokens: [{ values: { same: 1 } }],
    })
  })
})
