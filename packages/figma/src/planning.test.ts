import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { nameToDot, parseTokenFiles } from '@dta/core'
import type { TokenFileInput, TokenModel } from '@dta/core'
import { parseVariablesResponse, planPush } from './index.js'
import type { LocalVariablesResponse } from './index.js'

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

function fixtureModel(): TokenModel {
  return structuredClone(parseTokenFiles(fixtureFiles).model)
}

function modelFrom(files: Record<string, unknown>): TokenModel {
  const { model, diagnostics } = parseTokenFiles(
    Object.entries(files).map(([fileName, content]) => ({
      fileName,
      content: JSON.stringify(content),
    })),
  )
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  return model
}

function emptyFigma(): LocalVariablesResponse {
  return parseVariablesResponse({
    status: 200,
    error: false,
    meta: { variableCollections: {}, variables: {} },
  })
}

function findToken(model: TokenModel, collection: string, name: string) {
  const token = model.collections
    .find((c) => c.name === collection)
    ?.tokens.find((t) => nameToDot(t.name) === name)
  if (!token) throw new Error(`No token ${collection}/${name} in the fixture`)
  return token
}

const emptyPayload = {
  variableCollections: [],
  variableModes: [],
  variables: [],
  variableModeValues: [],
}

describe('planPush: the BrandA/BrandB recording', () => {
  it('plans nothing when the files match Figma', () => {
    expect(planPush(fixtureModel(), recording)).toEqual({
      payload: null,
      changes: [],
      diagnostics: [],
    })
  })

  it('plans exactly one value update for an edited color, with the payload v1 sent', () => {
    const model = fixtureModel()
    findToken(model, 'Primitives', 'Colors.Foundation.Blue.500').values.Value = '#010203'

    const plan = planPush(model, recording)

    expect(plan.diagnostics).toEqual([])
    expect(plan.changes).toEqual([
      {
        kind: 'update-value',
        collection: 'Primitives',
        mode: 'Value',
        name: ['Colors', 'Foundation', 'Blue', '500'],
        from: '#0057b8',
        to: '#010203',
      },
    ])
    expect(plan.payload).toEqual({
      ...emptyPayload,
      variableModeValues: [
        {
          variableId: 'VariableID:1:1',
          modeId: '1:0',
          value: { r: 1 / 255, g: 2 / 255, b: 3 / 255 },
        },
      ],
    })
  })

  it('repoints an alias at the real id of an existing variable', () => {
    const model = fixtureModel()
    const token = findToken(model, 'Brand(Alias)', 'Colors.Brand.Primary')
    token.values.BrandA = '{Colors.Foundation.Blue.500}'
    token.values.BrandB = '{Colors.Foundation.Blue.500}'

    const plan = planPush(model, recording)

    expect(plan.diagnostics).toEqual([])
    const aliasValues = plan.payload?.variableModeValues?.map((v) => v.value)
    expect(aliasValues?.length).toBeGreaterThan(0)
    for (const value of aliasValues ?? []) {
      expect(value).toEqual({ type: 'VARIABLE_ALIAS', id: 'VariableID:1:1' })
    }
  })

  it('pushes the DTCG 2025.10 values Figma variables can hold and skips the rest, saying why', () => {
    const model = modelFrom({
      'Extra.Value.json': {
        Sky: { $type: 'color', $value: { colorSpace: 'oklch', components: [0.7, 0.15, 250] } },
        Vivid: { $type: 'color', $value: { colorSpace: 'display-p3', components: [1, 0, 0] } },
        Gap: { $type: 'dimension', $value: { value: 8, unit: 'px' } },
        Lead: { $type: 'dimension', $value: '1rem' },
        Body: { $type: 'fontFamily', $value: ['Inter'] },
        Stack: { $type: 'fontFamily', $value: ['Inter', 'sans-serif'] },
        Ease: { $type: 'cubicBezier', $value: [0.5, 0, 1, 1] },
        Link: { $type: 'color', $value: { $ref: '#/Sky' } },
        Half: { $type: 'number', $value: { $ref: '#/Gap/$value/value' } },
      },
    })
    const plan = planPush(model, emptyFigma())
    expect(plan.diagnostics.map((d) => [d.code, d.message])).toEqual([
      [
        'clipped-to-srgb',
        '"Extra/Vivid" (color(display-p3 1 0 0)) is outside sRGB; Figma gets #ff0000.',
      ],
      [
        'not-pushable',
        '"Extra/Lead" is 1rem; Figma holds lengths as px numbers; it was not pushed.',
      ],
      [
        'not-pushable',
        '"Extra/Stack" is a list of font families; a Figma variable holds one; it was not pushed.',
      ],
      [
        'not-pushable',
        '"Extra/Ease" is cubicBezier, which Figma variables cannot hold; it was not pushed.',
      ],
    ])
    const created = Object.fromEntries(
      (plan.payload?.variables ?? []).map((v) => [
        'name' in v ? v.name : v.id,
        'resolvedType' in v ? v.resolvedType : undefined,
      ]),
    )
    expect(created).toEqual({
      Sky: 'COLOR',
      Vivid: 'COLOR',
      Gap: 'FLOAT',
      Body: 'STRING',
      Link: 'COLOR',
      Half: 'FLOAT',
    })
    const values = Object.fromEntries(
      (plan.payload?.variableModeValues ?? []).map((v) => [v.variableId, v.value]),
    )
    expect(values.Gap).toBe(8)
    expect(values.Body).toBe('Inter')
    expect(values.Half).toBe(8)
    expect(values.Link).toEqual({ type: 'VARIABLE_ALIAS', id: 'Sky' })
    expect(values.Sky).toMatchObject({ r: expect.any(Number), g: expect.any(Number) })
  })

  it('keeps an alias to a variable that is pushed in some modes only', () => {
    const model = modelFrom({
      'Size.A.json': { Gap: { $type: 'dimension', $value: { value: 8, unit: 'px' } } },
      'Size.B.json': { Gap: { $type: 'dimension', $value: '1rem' } },
      'Use.Value.json': { Card: { $type: 'dimension', $value: '{Gap}' } },
      'Other.Value.json': { Lead: { $type: 'dimension', $value: '2rem' } },
      'Ref.Value.json': { Line: { $type: 'dimension', $value: '{Lead}' } },
    })
    const plan = planPush(model, emptyFigma())
    const created = (plan.payload?.variables ?? []).map((v) => ('name' in v ? v.name : v.id))
    // Gap exists in Figma (mode A), so Card aliases it; Lead is never pushed, so Line is not.
    expect(created).toContain('Card')
    expect(created).not.toContain('Line')
    // In its own collection an alias reads the same mode: Pad (B) aliases Gap, not pushed in B.
    const same = planPush(
      modelFrom({
        'Size.A.json': {
          Gap: { $type: 'dimension', $value: { value: 8, unit: 'px' } },
          Pad: { $type: 'dimension', $value: '{Gap}' },
        },
        'Size.B.json': {
          Gap: { $type: 'dimension', $value: '1rem' },
          Pad: { $type: 'dimension', $value: '{Gap}' },
        },
      }),
      emptyFigma(),
    )
    expect(same.diagnostics.map((d) => d.message)).toEqual([
      '"Size/Gap" in mode "B" is 1rem; Figma holds lengths as px numbers; that value was not pushed.',
      '"Size/Pad" in mode "B" aliases "Gap", which is not pushed; that value was not pushed.',
    ])
  })

  it('ignores floating point noise in colors', () => {
    const noisy = structuredClone(recording)
    const variable = noisy.meta.variables['VariableID:1:1']
    variable.valuesByMode['1:0'] = {
      r: 0 + 1e-9,
      g: 0.3411764705882353,
      b: 0.7215686274509804,
      a: 1,
    }

    expect(planPush(fixtureModel(), noisy).changes).toEqual([])
  })

  it('does not create a metadata change for reordered scopes', () => {
    const model = fixtureModel()
    const token = findToken(model, 'Primitives', 'Colors.Foundation.Blue.500')
    token.extensions = { 'com.figma': { scopes: ['ALL_SCOPES'] } }
    const figma = structuredClone(recording)
    figma.meta.variables['VariableID:1:1'].scopes = ['ALL_SCOPES']

    expect(planPush(model, figma).changes).toEqual([])
  })

  it('updates a changed description and nothing else', () => {
    const model = fixtureModel()
    findToken(model, 'Primitives', 'Colors.Foundation.Blue.500').description = 'Our blue'

    const plan = planPush(model, recording)

    expect(plan.changes).toEqual([
      {
        kind: 'update-metadata',
        collection: 'Primitives',
        name: ['Colors', 'Foundation', 'Blue', '500'],
        fields: ['description'],
      },
    ])
    expect(plan.payload).toEqual({
      ...emptyPayload,
      variables: [{ action: 'UPDATE', id: 'VariableID:1:1', description: 'Our blue' }],
    })
  })

  it('refuses to update a remote variable', () => {
    const model = fixtureModel()
    findToken(model, 'Primitives', 'Colors.Foundation.Blue.500').description = 'Our blue'
    const figma = structuredClone(recording)
    figma.meta.variables['VariableID:1:1'].remote = true

    const plan = planPush(model, figma)

    expect(plan.payload).toBeNull()
    expect(plan.diagnostics.map((d) => [d.severity, d.code])).toEqual([
      ['error', 'remote-variable'],
    ])
  })

  it('refuses to change the type of an existing variable', () => {
    const model = fixtureModel()
    const token = findToken(model, 'Primitives', 'Colors.Foundation.Blue.500')
    token.type = 'string'
    token.values.Value = 'blue'

    const plan = planPush(model, recording)

    expect(plan.payload).toBeNull()
    expect(plan.diagnostics.map((d) => d.code)).toEqual(['type-mismatch'])
  })

  it('adds a mode to an existing collection with a temporary id', () => {
    const model = fixtureModel()
    const collection = model.collections.find((c) => c.name === 'Primitives')!
    collection.modes = [...collection.modes, 'Dark']
    findToken(model, 'Primitives', 'Colors.Foundation.Blue.500').values.Dark = '#000000'

    const plan = planPush(model, recording)

    expect(plan.changes).toEqual([
      { kind: 'create-mode', collection: 'Primitives', mode: 'Dark' },
      {
        kind: 'update-value',
        collection: 'Primitives',
        mode: 'Dark',
        name: ['Colors', 'Foundation', 'Blue', '500'],
        from: undefined,
        to: '#000000',
      },
    ])
    expect(plan.payload).toEqual({
      ...emptyPayload,
      variableModes: [
        {
          action: 'CREATE',
          id: 'Dark',
          name: 'Dark',
          variableCollectionId: 'VariableCollectionId:1:1',
        },
      ],
      variableModeValues: [
        { variableId: 'VariableID:1:1', modeId: 'Dark', value: { r: 0, g: 0, b: 0 } },
      ],
    })
  })

  it('reports duplicate collection names in the Figma file', () => {
    const figma = structuredClone(recording)
    figma.meta.variableCollections['VariableCollectionId:1:2'].name = 'Primitives'

    const plan = planPush(fixtureModel(), figma)

    expect(plan.payload).toBeNull()
    expect(plan.diagnostics.some((d) => d.code === 'duplicate-collection')).toBe(true)
  })
})

describe('planPush: never deletes', () => {
  it('plans nothing for models that are subsets of what Figma has', () => {
    for (const stride of [1, 2, 3, 5, 7]) {
      const model = fixtureModel()
      for (const collection of model.collections) {
        collection.tokens = collection.tokens.filter((_, index) => index % stride === 0)
        if (stride === 1) collection.tokens = []
      }
      const plan = planPush(model, recording)
      expect(plan, `stride ${stride}`).toEqual({ payload: null, changes: [], diagnostics: [] })
    }
  })

  it('plans nothing when a mode or a collection is missing from the files', () => {
    const model = fixtureModel()
    model.collections = model.collections.filter((c) => c.name !== 'ScreenType')
    const brand = model.collections.find((c) => c.name === 'Brand(Alias)')!
    brand.modes = brand.modes.filter((m) => m !== 'BrandB')
    for (const token of brand.tokens) delete token.values.BrandB

    expect(planPush(model, recording)).toEqual({ payload: null, changes: [], diagnostics: [] })
  })

  it('still resolves aliases to variables that only exist in Figma', () => {
    const model = fixtureModel()
    model.collections = model.collections.filter((c) => c.name === 'Brand(Alias)')

    expect(planPush(model, recording).diagnostics).toEqual([])
  })
})

describe('planPush: creating everything in an empty Figma file', () => {
  const model = modelFrom({
    'Primitives.Value.json': {
      Colors: {
        Blue: { $type: 'color', $value: '#0057b8', $description: 'Blue' },
      },
      Size: { Base: { $type: 'number', $value: 8 } },
    },
    'Brand.BrandA.json': {
      Primary: { $type: 'color', $value: '{Colors.Blue}' },
    },
    'Brand.BrandB.json': {
      Primary: { $type: 'color', $value: '#ff0000' },
    },
  })

  it('creates collections, modes and variables with temporary ids', () => {
    const plan = planPush(model, emptyFigma())

    expect(plan.diagnostics).toEqual([])
    expect(plan.payload).toEqual({
      variableCollections: [
        { action: 'CREATE', id: 'Brand', name: 'Brand', initialModeId: 'BrandA' },
        { action: 'CREATE', id: 'Primitives', name: 'Primitives', initialModeId: 'Value' },
      ],
      variableModes: [
        { action: 'UPDATE', id: 'BrandA', name: 'BrandA', variableCollectionId: 'Brand' },
        { action: 'CREATE', id: 'BrandB', name: 'BrandB', variableCollectionId: 'Brand' },
        { action: 'UPDATE', id: 'Value', name: 'Value', variableCollectionId: 'Primitives' },
      ],
      variables: [
        {
          action: 'CREATE',
          id: 'Primary',
          name: 'Primary',
          variableCollectionId: 'Brand',
          resolvedType: 'COLOR',
        },
        {
          action: 'CREATE',
          id: 'Colors/Blue',
          name: 'Colors/Blue',
          variableCollectionId: 'Primitives',
          resolvedType: 'COLOR',
          description: 'Blue',
        },
        {
          action: 'CREATE',
          id: 'Size/Base',
          name: 'Size/Base',
          variableCollectionId: 'Primitives',
          resolvedType: 'FLOAT',
        },
      ],
      variableModeValues: [
        // an alias to a variable created in the same payload goes through its temporary id
        {
          variableId: 'Primary',
          modeId: 'BrandA',
          value: { type: 'VARIABLE_ALIAS', id: 'Colors/Blue' },
        },
        { variableId: 'Primary', modeId: 'BrandB', value: { r: 1, g: 0, b: 0 } },
        { variableId: 'Colors/Blue', modeId: 'Value', value: { r: 0, g: 87 / 255, b: 184 / 255 } },
        { variableId: 'Size/Base', modeId: 'Value', value: 8 },
      ],
    })
  })

  it('lists every creation and value as a change', () => {
    const { changes } = planPush(model, emptyFigma())

    expect(changes.filter((c) => c.kind === 'create-collection')).toEqual([
      { kind: 'create-collection', collection: 'Brand' },
      { kind: 'create-collection', collection: 'Primitives' },
    ])
    expect(changes.filter((c) => c.kind === 'create-mode')).toEqual([
      { kind: 'create-mode', collection: 'Brand', mode: 'BrandB' },
    ])
    expect(changes.filter((c) => c.kind === 'create-variable')).toHaveLength(3)
    expect(changes.filter((c) => c.kind === 'update-value')).toHaveLength(4)
  })

  it('creates a variable only once even though it has several modes', () => {
    const { payload } = planPush(model, emptyFigma())
    expect(payload?.variables?.filter((v) => 'id' in v && v.id === 'Primary')).toHaveLength(1)
  })
})

describe('planPush: problems that block the payload', () => {
  it('reports duplicate variable names across collections', () => {
    const model = modelFrom({
      'A.Value.json': { Shared: { $type: 'number', $value: 1 } },
      'B.Value.json': { Shared: { $type: 'number', $value: 2 } },
    })

    const plan = planPush(model, emptyFigma())

    expect(plan.payload).toBeNull()
    expect(plan.changes).toEqual([])
    expect(plan.diagnostics.map((d) => d.severity)).toContain('error')
  })

  it('reports an alias to a variable that exists nowhere', () => {
    const model = modelFrom({
      'A.Value.json': { Token: { $type: 'color', $value: '{Missing.Thing}' } },
    })

    const plan = planPush(model, emptyFigma())

    expect(plan.payload).toBeNull()
    expect(plan.diagnostics).toMatchObject([
      { severity: 'error', code: 'unknown-alias-target', path: ['Token'] },
    ])
  })

  it('reports a color that cannot be parsed', () => {
    const model = modelFrom({
      'A.Value.json': { Token: { $type: 'color', $value: 'not-a-color' } },
    })

    const plan = planPush(model, emptyFigma())

    expect(plan.payload).toBeNull()
    expect(plan.diagnostics.map((d) => d.code)).toEqual(['invalid-color'])
  })

  it('reports a value that does not fit the token type', () => {
    const model = modelFrom({
      'A.Value.json': { Token: { $type: 'number', $value: 'wide' } },
    })

    const plan = planPush(model, emptyFigma())

    expect(plan.payload).toBeNull()
    expect(plan.diagnostics.map((d) => d.code)).toEqual(['invalid-value'])
  })
})
