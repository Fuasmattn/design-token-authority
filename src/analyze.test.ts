import { describe, it, expect } from 'vitest'
import { analyzeCollections, formatAnalysisReport, CollectionAnalysis } from './analyze.js'
import { GetLocalVariablesResponse } from '@figma/rest-api-spec'

// ---------------------------------------------------------------------------
// Test helpers — build mock Figma API responses
// ---------------------------------------------------------------------------

type MockVariable = {
  id: string
  name: string
  collectionId: string
  valuesByMode: Record<string, unknown>
}

function buildResponse(
  collections: {
    id: string
    name: string
    modes: { modeId: string; name: string }[]
    variables: MockVariable[]
  }[],
): GetLocalVariablesResponse {
  const variableCollections: Record<string, any> = {}
  const variables: Record<string, any> = {}

  for (const col of collections) {
    variableCollections[col.id] = {
      id: col.id,
      name: col.name,
      key: col.id,
      modes: col.modes,
      defaultModeId: col.modes[0]?.modeId ?? '',
      remote: false,
      hiddenFromPublishing: false,
      variableIds: col.variables.map((v) => v.id),
    }

    for (const v of col.variables) {
      variables[v.id] = {
        id: v.id,
        name: v.name,
        key: v.id,
        variableCollectionId: v.collectionId,
        resolvedType: 'COLOR',
        valuesByMode: v.valuesByMode,
        remote: false,
        description: '',
        hiddenFromPublishing: false,
        scopes: ['ALL_SCOPES'],
        codeSyntax: {},
      }
    }
  }

  return {
    status: 200,
    error: false,
    meta: { variableCollections, variables },
  } as unknown as GetLocalVariablesResponse
}

function rawValue(color = '#000000') {
  return { r: 0, g: 0, b: 0, a: 1 }
}

function aliasValue(id: string) {
  return { type: 'VARIABLE_ALIAS' as const, id }
}

function makeVars(
  prefix: string,
  collectionId: string,
  count: number,
  modeIds: string[],
  aliasRatio: number,
): MockVariable[] {
  const vars: MockVariable[] = []
  for (let i = 0; i < count; i++) {
    const isAlias = i / count < aliasRatio
    const valuesByMode: Record<string, unknown> = {}
    for (const modeId of modeIds) {
      valuesByMode[modeId] = isAlias ? aliasValue(`ref-${i}`) : rawValue()
    }
    vars.push({
      id: `${prefix}-var-${i}`,
      name: `${prefix}/item-${i}`,
      collectionId,
      valuesByMode,
    })
  }
  return vars
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analyzeCollections', () => {
  it('detects a primitives collection (single mode, low alias ratio)', () => {
    const response = buildResponse([
      {
        id: 'col-1',
        name: 'Primitives(Global)',
        modes: [{ modeId: 'm1', name: 'Value' }],
        variables: makeVars('prim', 'col-1', 100, ['m1'], 0.02),
      },
    ])

    const result = analyzeCollections(response)
    expect(result.collections).toHaveLength(1)
    expect(result.collections[0].inferredRole).toBe('primitives')
    expect(result.collections[0].confidence).toBeGreaterThanOrEqual(0.85)
    expect(result.suggestedLayers.primitives).toBe('Primitives(Global)')
  })

  it('detects a brand collection (multiple modes, high alias ratio)', () => {
    const response = buildResponse([
      {
        id: 'col-2',
        name: 'Brand(Alias)',
        modes: [
          { modeId: 'm1', name: 'Sunrise' },
          { modeId: 'm2', name: 'Moonlight' },
        ],
        variables: makeVars('brand', 'col-2', 200, ['m1', 'm2'], 0.92),
      },
    ])

    const result = analyzeCollections(response)
    expect(result.collections[0].inferredRole).toBe('brand')
    expect(result.collections[0].confidence).toBeGreaterThanOrEqual(0.9)
    expect(result.suggestedLayers.brand).toBe('Brand(Alias)')
    expect(result.suggestedBrands).toEqual(['Sunrise', 'Moonlight'])
  })

  it('detects a dimension collection (mode names match responsive patterns)', () => {
    const response = buildResponse([
      {
        id: 'col-3',
        name: 'ScreenType',
        modes: [
          { modeId: 'm1', name: 'Desktop' },
          { modeId: 'm2', name: 'Tablet' },
          { modeId: 'm3', name: 'Mobile' },
        ],
        variables: makeVars('screen', 'col-3', 50, ['m1', 'm2', 'm3'], 0.5),
      },
    ])

    const result = analyzeCollections(response)
    expect(result.collections[0].inferredRole).toBe('dimension')
    expect(result.suggestedLayers.dimension).toBe('ScreenType')
  })

  it('detects dimension with t-shirt sizes (sm, md, lg)', () => {
    const response = buildResponse([
      {
        id: 'col-4',
        name: 'Breakpoints',
        modes: [
          { modeId: 'm1', name: 'sm' },
          { modeId: 'm2', name: 'md' },
          { modeId: 'm3', name: 'lg' },
        ],
        variables: makeVars('bp', 'col-4', 30, ['m1', 'm2', 'm3'], 0.5),
      },
    ])

    const result = analyzeCollections(response)
    expect(result.collections[0].inferredRole).toBe('dimension')
  })

  it('detects a semantic collection (single mode, high alias ratio)', () => {
    const response = buildResponse([
      {
        id: 'col-5',
        name: 'Semantic',
        modes: [{ modeId: 'm1', name: 'Default' }],
        variables: makeVars('sem', 'col-5', 150, ['m1'], 0.9),
      },
    ])

    const result = analyzeCollections(response)
    expect(result.collections[0].inferredRole).toBe('semantic')
  })

  it('marks small collections with low confidence', () => {
    const response = buildResponse([
      {
        id: 'col-6',
        name: 'meta',
        modes: [{ modeId: 'm1', name: 'Mode 1' }],
        variables: makeVars('meta', 'col-6', 5, ['m1'], 0.0),
      },
    ])

    const result = analyzeCollections(response)
    expect(result.collections[0].inferredRole).toBe('primitives')
    expect(result.collections[0].confidence).toBeLessThan(0.75)
    expect(result.collections[0].notes.length).toBeGreaterThan(0)
  })

  it('handles a full 3-layer design system correctly', () => {
    const response = buildResponse([
      {
        id: 'col-p',
        name: 'Primitives(Global)',
        modes: [{ modeId: 'm1', name: 'Value' }],
        variables: makeVars('prim', 'col-p', 400, ['m1'], 0.03),
      },
      {
        id: 'col-b',
        name: 'Brand(Alias)',
        modes: [
          { modeId: 'm1', name: 'BrandA' },
          { modeId: 'm2', name: 'BrandB' },
        ],
        variables: makeVars('brand', 'col-b', 1800, ['m1', 'm2'], 0.91),
      },
      {
        id: 'col-s',
        name: 'ScreenType',
        modes: [
          { modeId: 'm1', name: 'Desktop' },
          { modeId: 'm2', name: 'Tablet' },
          { modeId: 'm3', name: 'Mobile' },
        ],
        variables: makeVars('screen', 'col-s', 160, ['m1', 'm2', 'm3'], 0.78),
      },
    ])

    const result = analyzeCollections(response)
    expect(result.collections).toHaveLength(3)
    expect(result.suggestedLayers).toEqual({
      primitives: 'Primitives(Global)',
      brand: 'Brand(Alias)',
      dimension: 'ScreenType',
    })
    expect(result.suggestedBrands).toEqual(['BrandA', 'BrandB'])
  })

  it('skips remote collections', () => {
    const response = buildResponse([
      {
        id: 'col-local',
        name: 'Local',
        modes: [{ modeId: 'm1', name: 'Default' }],
        variables: makeVars('loc', 'col-local', 50, ['m1'], 0.0),
      },
    ])

    // Manually mark a collection as remote
    ;(response.meta.variableCollections as any)['col-remote'] = {
      id: 'col-remote',
      name: 'RemoteLib',
      key: 'col-remote',
      modes: [{ modeId: 'mr', name: 'Default' }],
      defaultModeId: 'mr',
      remote: true,
      hiddenFromPublishing: false,
      variableIds: [],
    }

    const result = analyzeCollections(response)
    expect(result.collections).toHaveLength(1)
    expect(result.collections[0].name).toBe('Local')
  })

  it('handles an empty file with no collections', () => {
    const response = buildResponse([])
    const result = analyzeCollections(response)
    expect(result.collections).toHaveLength(0)
    expect(result.suggestedBrands).toEqual([])
  })
})

describe('formatAnalysisReport', () => {
  it('produces a readable table with all collections', () => {
    const result = analyzeCollections(
      buildResponse([
        {
          id: 'col-p',
          name: 'Primitives',
          modes: [{ modeId: 'm1', name: 'Value' }],
          variables: makeVars('prim', 'col-p', 100, ['m1'], 0.02),
        },
        {
          id: 'col-b',
          name: 'Brand',
          modes: [
            { modeId: 'm1', name: 'A' },
            { modeId: 'm2', name: 'B' },
          ],
          variables: makeVars('brand', 'col-b', 50, ['m1', 'm2'], 0.92),
        },
      ]),
    )

    const report = formatAnalysisReport(result)
    expect(report).toContain('Collection Analysis')
    expect(report).toContain('Primitives')
    expect(report).toContain('Brand')
    expect(report).toContain('primitives')
    expect(report).toContain('brand')
    expect(report).toContain('Suggested layers config')
  })

  it('includes warning markers for low-confidence collections', () => {
    const result = analyzeCollections(
      buildResponse([
        {
          id: 'col-m',
          name: 'meta',
          modes: [{ modeId: 'm1', name: 'Mode 1' }],
          variables: makeVars('meta', 'col-m', 5, ['m1'], 0.0),
        },
      ]),
    )

    const report = formatAnalysisReport(result)
    expect(report).toContain('⚠')
  })
})
