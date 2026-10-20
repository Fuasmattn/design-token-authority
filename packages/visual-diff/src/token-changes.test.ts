import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTokenFiles, type TokenFileInput, type TokenModel } from '@dta/core'
import { describe, expect, it } from 'vitest'
import { diffTokens, type TokenChange } from './index.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

function readDir(dir: string): TokenFileInput[] {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((fileName) => ({ fileName, content: fs.readFileSync(path.join(dir, fileName), 'utf8') }))
}

function model(files: Record<string, unknown>): TokenModel {
  const result = parseTokenFiles(
    Object.entries(files).map(([fileName, tree]) => ({
      fileName,
      content: JSON.stringify(tree),
    })),
  )
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  return result.model
}

const color = (value: string) => ({ $type: 'color', $value: value })
const number = (value: number | string) => ({ $type: 'number', $value: value })

const summary = (change: TokenChange) =>
  `${change.kind} ${change.collection}.${change.mode} ${change.name}`

describe('diffTokens', () => {
  it('finds nothing between identical models', () => {
    const files = { 'Base.Value.json': { Blue: color('#0000ff') } }
    const result = diffTokens(model(files), model(files))
    expect(result.changes).toEqual([])
    expect(result.counts).toEqual({ changed: 0, added: 0, removed: 0, affected: 0 })
  })

  it('reports a changed raw value with before and after', () => {
    const result = diffTokens(
      model({ 'Base.Value.json': { Blue: color('#0000ff') } }),
      model({ 'Base.Value.json': { Blue: color('#0000cc') } }),
    )
    expect(result.changes).toEqual([
      {
        kind: 'changed',
        collection: 'Base',
        mode: 'Value',
        name: 'Blue',
        type: 'color',
        before: { raw: '#0000ff', resolved: '#0000ff' },
        after: { raw: '#0000cc', resolved: '#0000cc' },
      },
    ])
  })

  it('treats the same colour in another notation as unchanged', () => {
    const result = diffTokens(
      model({ 'Base.Value.json': { White: color('#FFFFFF') } }),
      model({ 'Base.Value.json': { White: color('#ffffff') } }),
    )
    expect(result.changes).toEqual([])
  })

  it('reports added and removed tokens per mode', () => {
    const result = diffTokens(
      model({ 'Base.Value.json': { Old: number(1), Kept: number(2) } }),
      model({ 'Base.Value.json': { New: number(3), Kept: number(2) } }),
    )
    expect(result.changes.map(summary)).toEqual(['added Base.Value New', 'removed Base.Value Old'])
    expect(result.changes[0].before).toBeUndefined()
    expect(result.changes[1].after).toBeUndefined()
  })

  it('lists tokens whose resolved value changed through an alias, with the cause', () => {
    const base = model({
      'Base.Value.json': { Blue: color('#0000ff'), Sky: color('#66aaff') },
      'Brand.A.json': { Primary: color('{Blue}'), Accent: color('{Sky}') },
      'Brand.B.json': { Primary: color('{Sky}'), Accent: color('{Sky}') },
    })
    const head = model({
      'Base.Value.json': { Blue: color('#0000cc'), Sky: color('#66aaff') },
      'Brand.A.json': { Primary: color('{Blue}'), Accent: color('{Blue}') },
      'Brand.B.json': { Primary: color('{Sky}'), Accent: color('{Sky}') },
    })
    const result = diffTokens(base, head)
    expect(result.changes.map(summary)).toEqual([
      'changed Base.Value Blue',
      'changed Brand.A Accent',
      'affected Brand.A Primary',
    ])
    const affected = result.changes.find((c) => c.kind === 'affected')!
    expect(affected.before).toEqual({ raw: '{Blue}', resolved: '#0000ff' })
    expect(affected.after).toEqual({ raw: '{Blue}', resolved: '#0000cc' })
    expect(affected.causes).toEqual(['Blue'])
    expect(result.counts).toEqual({ changed: 2, added: 0, removed: 0, affected: 1 })
  })

  it('follows multi-step alias chains to the changed token', () => {
    const files = (size: number) =>
      model({
        'Base.Value.json': { Size: { md: number(size) } },
        'Semantic.Value.json': { Gap: number('{Size.md}') },
        'Screen.Desktop.json': { Padding: number('{Gap}') },
      })
    const result = diffTokens(files(16), files(20))
    expect(result.changes.map(summary)).toEqual([
      'changed Base.Value Size.md',
      'affected Screen.Desktop Padding',
      'affected Semantic.Value Gap',
    ])
    expect(result.changes.find((c) => c.name === 'Padding')!.causes).toEqual(['Size.md'])
  })

  it('reports an alias that no longer resolves, without a resolved value', () => {
    const result = diffTokens(
      model({ 'Base.Value.json': { Blue: color('#0000ff'), Primary: color('{Blue}') } }),
      model({ 'Base.Value.json': { Primary: color('{Blue}') } }),
    )
    expect(result.changes.map(summary)).toEqual([
      'removed Base.Value Blue',
      'affected Base.Value Primary',
    ])
    const primary = result.changes.find((c) => c.name === 'Primary')!
    expect(primary.after).toEqual({ raw: '{Blue}' })
    expect(primary.causes).toEqual(['Blue'])
  })

  it('reports a type change as a change', () => {
    const result = diffTokens(
      model({ 'Base.Value.json': { Flag: { $type: 'string', $value: '1' } } }),
      model({ 'Base.Value.json': { Flag: { $type: 'number', $value: 1 } } }),
    )
    expect(result.changes.map(summary)).toEqual(['changed Base.Value Flag'])
    expect(result.changes[0].type).toBe('number')
    expect(result.changes[0].typeBefore).toBe('string')
  })

  it('finds the changes of the brand-ab fixture pair', () => {
    const fixture = path.join(repoRoot, 'test', 'fixtures', 'brand-ab')
    const base = parseTokenFiles(readDir(path.join(fixture, 'tokens-base'))).model
    const head = parseTokenFiles(readDir(path.join(fixture, 'tokens'))).model
    const result = diffTokens(base, head)

    expect(result.changes.filter((c) => c.kind !== 'affected').map(summary)).toEqual([
      'changed Brand(Alias).BrandB Colors.Brand.Accent',
      'changed Primitives.Value Colors.Foundation.Blue.500',
      'changed Primitives.Value Dimensions.spacing.8',
      'added Primitives.Value Dimensions.radius.pill',
      'removed Primitives.Value Colors.Foundation.Steel.500',
    ])
    expect(result.changes.filter((c) => c.kind === 'affected').map(summary)).toEqual([
      'affected Brand(Alias).BrandA Colors.Brand.Primary',
      'affected ScreenType.Desktop Spacing.Padding',
    ])
    const accent = result.changes.find((c) => c.name === 'Colors.Brand.Accent')!
    expect(accent.before).toEqual({ raw: '{Colors.Foundation.Navy.700}', resolved: '#2c4466' })
    expect(accent.after).toEqual({ raw: '{Colors.Foundation.Sky.500}', resolved: '#3b8fd9' })
  })
})
