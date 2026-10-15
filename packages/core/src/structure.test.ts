import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeStructure, parseTokenFiles } from './index.js'
import type { Token, TokenModel } from './index.js'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')

function fixtureModel(name: string): TokenModel {
  const dir = path.join(repoRoot, 'test', 'fixtures', name, 'tokens')
  const files = fs.readdirSync(dir).map((fileName) => ({
    fileName,
    content: fs.readFileSync(path.join(dir, fileName), 'utf-8'),
  }))
  return parseTokenFiles(files).model
}

/** A collection with `count` color tokens in every mode; the first `aliasRatio` share are aliases. */
function collection(name: string, modes: string[], count: number, aliasRatio: number) {
  const tokens: Token[] = []
  for (let i = 0; i < count; i++) {
    const isAlias = i / count < aliasRatio
    tokens.push({
      name: ['item', String(i)],
      type: 'color',
      values: Object.fromEntries(modes.map((m) => [m, isAlias ? `{ref.${i}}` : '#000000'])),
    })
  }
  return { name, modes: [...modes].sort(), tokens, sources: {} }
}

const model = (...collections: ReturnType<typeof collection>[]): TokenModel => ({ collections })

describe('analyzeStructure: the BrandA/BrandB fixture', () => {
  it('finds the three layers, as legacy `dta analyze` does for the same data', () => {
    const result = analyzeStructure(fixtureModel('brand-ab'))

    expect(result).toEqual({
      collections: [
        {
          name: 'Brand(Alias)',
          modeNames: ['BrandA', 'BrandB'],
          modeCount: 2,
          variableCount: 11,
          aliasRatio: 1,
          inferredRole: 'brand',
          confidence: 0.94,
          notes: [],
        },
        {
          name: 'Primitives',
          modeNames: ['Value'],
          modeCount: 1,
          variableCount: 26,
          aliasRatio: 0,
          inferredRole: 'primitives',
          confidence: 0.9,
          notes: [],
        },
        {
          name: 'ScreenType',
          modeNames: ['Desktop', 'Mobile', 'Tablet'],
          modeCount: 3,
          variableCount: 5,
          aliasRatio: 1,
          inferredRole: 'dimension',
          confidence: 0.92,
          notes: [],
        },
      ],
      suggestedCollections: ['Brand(Alias)', 'Primitives', 'ScreenType'],
      suggestedLayers: { primitives: 'Primitives', brand: 'Brand(Alias)', dimension: 'ScreenType' },
      suggestedBrands: ['BrandA', 'BrandB'],
    })
  })
})

describe('analyzeStructure: the DaisyUI fixture', () => {
  it('analyses without throwing and gives every collection a role', () => {
    const result = analyzeStructure(fixtureModel('daisyui'))
    expect(result.collections).toHaveLength(22)
    for (const c of result.collections) {
      expect(['primitives', 'brand', 'dimension', 'semantic', 'unknown']).toContain(c.inferredRole)
    }
  })
})

describe('analyzeStructure: heuristics', () => {
  it('detects a primitives collection (single mode, low alias ratio)', () => {
    const result = analyzeStructure(model(collection('Primitives(Global)', ['Value'], 100, 0.02)))
    expect(result.collections[0].inferredRole).toBe('primitives')
    expect(result.collections[0].confidence).toBeGreaterThanOrEqual(0.85)
    expect(result.suggestedLayers.primitives).toBe('Primitives(Global)')
  })

  it('detects a brand collection (several modes, high alias ratio)', () => {
    const result = analyzeStructure(
      model(collection('Brand(Alias)', ['Sunrise', 'Moonlight'], 200, 0.92)),
    )
    expect(result.collections[0].inferredRole).toBe('brand')
    expect(result.collections[0].confidence).toBeGreaterThanOrEqual(0.9)
    expect(result.suggestedLayers.brand).toBe('Brand(Alias)')
    // modes are sorted in the model
    expect(result.suggestedBrands).toEqual(['Moonlight', 'Sunrise'])
  })

  it('detects a dimension collection by responsive mode names', () => {
    const result = analyzeStructure(
      model(collection('ScreenType', ['Desktop', 'Tablet', 'Mobile'], 50, 0.5)),
    )
    expect(result.collections[0].inferredRole).toBe('dimension')
    expect(result.suggestedLayers.dimension).toBe('ScreenType')
  })

  it('detects dimension with t-shirt sizes', () => {
    const result = analyzeStructure(model(collection('Breakpoints', ['sm', 'md', 'lg'], 30, 0.5)))
    expect(result.collections[0].inferredRole).toBe('dimension')
  })

  it('detects a semantic collection (single mode, high alias ratio)', () => {
    const result = analyzeStructure(model(collection('Semantic', ['Default'], 150, 0.9)))
    expect(result.collections[0].inferredRole).toBe('semantic')
  })

  it('marks small primitives collections with low confidence and a note', () => {
    const result = analyzeStructure(model(collection('Meta', ['Mode 1'], 5, 0)))
    const [meta] = result.collections
    expect(meta.inferredRole).toBe('primitives')
    expect(meta.confidence).toBeLessThan(0.75)
    expect(meta.notes).toHaveLength(1)
  })

  it('returns unknown for several modes with few aliases, with a note', () => {
    const result = analyzeStructure(model(collection('Themed', ['Light', 'Dark'], 40, 0.05)))
    expect(result.collections[0]).toMatchObject({ inferredRole: 'unknown', confidence: 0.4 })
    expect(result.collections[0].notes).toHaveLength(1)
  })

  it('returns unknown for mixed signals instead of guessing', () => {
    const result = analyzeStructure(model(collection('Mixed', ['Light', 'Dark'], 40, 0.5)))
    expect(result.collections[0]).toMatchObject({ inferredRole: 'unknown', confidence: 0.3 })
  })

  it('handles a full 3-layer design system', () => {
    const result = analyzeStructure(
      model(
        collection('Primitives', ['Value'], 400, 0.03),
        collection('Brand', ['BrandA', 'BrandB'], 1800, 0.91),
        collection('ScreenType', ['Desktop', 'Tablet', 'Mobile'], 160, 0.78),
      ),
    )
    expect(result.suggestedLayers).toEqual({
      primitives: 'Primitives',
      brand: 'Brand',
      dimension: 'ScreenType',
    })
    expect(result.suggestedBrands).toEqual(['BrandA', 'BrandB'])
  })

  it('counts alias values over all values, and variables once however many modes', () => {
    const half = collection('Half', ['A', 'B'], 10, 0.5)
    const [c] = analyzeStructure(model(half)).collections
    expect(c.variableCount).toBe(10)
    expect(c.aliasRatio).toBe(0.5)
  })

  it('handles an empty model', () => {
    expect(analyzeStructure({ collections: [] })).toEqual({
      collections: [],
      suggestedCollections: [],
      suggestedLayers: {},
      suggestedBrands: [],
    })
  })

  it('handles a collection without tokens', () => {
    const [c] = analyzeStructure(model(collection('Empty', ['Value'], 0, 0))).collections
    expect(c).toMatchObject({ variableCount: 0, aliasRatio: 0, inferredRole: 'primitives' })
  })

  it('returns plain JSON data', () => {
    const result = analyzeStructure(fixtureModel('brand-ab'))
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })
})
