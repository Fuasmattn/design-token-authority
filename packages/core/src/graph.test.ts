import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeGraph, parseTokenFiles } from './index.js'
import type { TokenFileInput, TokenModel } from './index.js'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')

function readFixtureFiles(fixture: string): TokenFileInput[] {
  const dir = path.join(repoRoot, 'test', 'fixtures', fixture, 'tokens')
  return fs.readdirSync(dir).map((fileName) => ({
    fileName,
    content: fs.readFileSync(path.join(dir, fileName), 'utf-8'),
  }))
}

const file = (fileName: string, tree: unknown): TokenFileInput => ({
  fileName,
  content: JSON.stringify(tree),
})
const n = (value: number | string) => ({ $type: 'number', $value: value })
const model = (...files: TokenFileInput[]): TokenModel => parseTokenFiles(files).model

describe('analyzeGraph: small graphs', () => {
  it('counts tokens per mode, aliases, edges, depth and orphans', () => {
    const result = analyzeGraph(
      model(file('A.V.json', { raw: n(1), unused: n(2), mid: n('{raw}'), top: n('{mid}') })),
    )
    expect(result.nodes.map((x) => x.id)).toEqual(['A.V/raw', 'A.V/unused', 'A.V/mid', 'A.V/top'])
    expect(result.edges).toEqual([
      { from: 'A.V/mid', to: 'A.V/raw' },
      { from: 'A.V/top', to: 'A.V/mid' },
    ])
    expect(result.chainDepths).toEqual({
      'A.V/raw': 0,
      'A.V/unused': 0,
      'A.V/mid': 1,
      'A.V/top': 2,
    })
    expect(result.maxChainDepth).toBe(2)
    expect(result.orphanedTokens).toEqual(['A.V/unused'])
    expect(result.stats).toMatchObject({
      totalTokens: 4,
      aliasTokens: 2,
      aliasPercentage: 50,
      maxChainDepth: 2,
      circularRefs: 0,
      danglingAliases: 0,
      orphanedTokens: 1,
      fileCount: 1,
      tokensByFile: { 'A.V': 4 },
      tokensByType: { number: 4 },
    })
  })

  it('treats the same token in two modes as two nodes', () => {
    const result = analyzeGraph(
      model(file('A.One.json', { x: n(1) }), file('A.Two.json', { x: n(2) })),
    )
    expect(result.nodes.map((x) => x.id)).toEqual(['A.One/x', 'A.Two/x'])
  })

  it('reports dangling aliases and keeps them out of the edges', () => {
    const result = analyzeGraph(
      model(file('A.V.json', { x: n('{nope.here}'), g: { a: n(1) }, y: n('{g}') })),
    )
    expect(result.edges).toEqual([])
    expect(result.danglingAliases).toEqual([
      { sourceId: 'A.V/x', file: 'A.V', rawAlias: '{nope.here}', targetName: 'nope.here' },
      { sourceId: 'A.V/y', file: 'A.V', rawAlias: '{g}', targetName: 'g' },
    ])
    expect(result.stats.danglingAliases).toBe(2)
  })

  it('reports cycles once and terminates', () => {
    const result = analyzeGraph(
      model(
        file('A.V.json', { a: n('{b}'), b: n('{c}'), c: n('{a}'), self: n('{self}'), ok: n(1) }),
      ),
    )
    expect(result.cycles).toEqual([
      { path: ['A.V/a', 'A.V/b', 'A.V/c', 'A.V/a'] },
      { path: ['A.V/self', 'A.V/self'] },
    ])
    expect(result.stats.circularRefs).toBe(2)
    expect(Number.isFinite(result.maxChainDepth)).toBe(true)
  })

  it('handles an empty model', () => {
    expect(analyzeGraph({ collections: [] }).stats).toMatchObject({
      totalTokens: 0,
      aliasPercentage: 0,
      maxChainDepth: 0,
      fileCount: 0,
    })
  })

  it('handles very long alias chains', () => {
    const tree: Record<string, unknown> = {}
    const length = 20000
    for (let i = 0; i < length; i++) tree[`t${i}`] = n(i === length - 1 ? 1 : `{t${i + 1}}`)
    const result = analyzeGraph(model(file('A.V.json', tree)))
    expect(result.maxChainDepth).toBe(length - 1)
  })
})

describe('analyzeGraph: alias targets are mode-aware', () => {
  const m = model(
    file('Base.Dark.json', { c: n(1) }),
    file('Base.Light.json', { c: n(2) }),
    file('Base.Other.json', { c: n(3), d: n('{c}') }),
    file('Theme.Only.json', { bg: n('{c}') }),
  )

  it('points a same-collection alias at the same mode', () => {
    expect(analyzeGraph(m).edges).toContainEqual({ from: 'Base.Other/d', to: 'Base.Other/c' })
  })

  it('points a cross-collection alias at the first mode of the target collection', () => {
    expect(analyzeGraph(m).edges).toContainEqual({ from: 'Theme.Only/bg', to: 'Base.Dark/c' })
  })

  it('does not count only the first mode of the target as referenced', () => {
    const orphans = analyzeGraph(m).orphanedTokens
    expect(orphans).toContain('Base.Light/c')
    expect(orphans).not.toContain('Base.Dark/c')
  })
})

describe('analyzeGraph: output', () => {
  const files = readFixtureFiles('brand-ab')

  it('is plain JSON data', () => {
    const result = analyzeGraph(parseTokenFiles(files).model)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('does not depend on the order the files were given in', () => {
    const forward = analyzeGraph(parseTokenFiles(files).model)
    const backward = analyzeGraph(parseTokenFiles([...files].reverse()).model)
    expect(backward).toEqual(forward)
  })
})

/** Numbers printed by the frozen legacy `dta graph` for a fixture. */
function legacyReport(fixture: string) {
  const text = fs.readFileSync(
    path.join(repoRoot, 'test', 'snapshots', fixture, 'graph-console', 'stdout.txt'),
    'utf-8',
  )
  const count = (label: string) =>
    Number(new RegExp(`${label}:\\s+([\\d,]+)`).exec(text)![1].replace(/,/g, ''))
  const section = (title: string) => {
    const block = text.split(`${title}:\n`)[1].split('\n\n')[0]
    return Object.fromEntries(
      block.split('\n').map((line) => {
        const [, key, value] = /^\s+(.+): (\d+)$/.exec(line)!
        return [key, Number(value)]
      }),
    )
  }
  return {
    totalTokens: count('Total tokens'),
    aliasTokens: count('Alias tokens'),
    maxChainDepth: count('Max chain depth'),
    circularRefs: count('Circular refs'),
    danglingAliases: count('Dangling aliases'),
    orphanedTokens: count('Orphaned tokens'),
    tokensByFile: section('Tokens by file'),
    tokensByType: section('Tokens by type'),
  }
}

describe.each(['brand-ab', 'daisyui'])(
  'analyzeGraph agrees with legacy `dta graph` on %s',
  (fixture) => {
    it('reports the same totals, per-file and per-type counts', () => {
      const { model: parsed } = parseTokenFiles(readFixtureFiles(fixture))
      const { stats } = analyzeGraph(parsed)
      const legacy = legacyReport(fixture)
      expect({
        totalTokens: stats.totalTokens,
        aliasTokens: stats.aliasTokens,
        maxChainDepth: stats.maxChainDepth,
        circularRefs: stats.circularRefs,
        danglingAliases: stats.danglingAliases,
        orphanedTokens: stats.orphanedTokens,
        tokensByType: stats.tokensByType,
      }).toEqual({
        totalTokens: legacy.totalTokens,
        aliasTokens: legacy.aliasTokens,
        maxChainDepth: legacy.maxChainDepth,
        circularRefs: legacy.circularRefs,
        danglingAliases: legacy.danglingAliases,
        orphanedTokens: legacy.orphanedTokens,
        tokensByType: legacy.tokensByType,
      })
      expect(stats.tokensByFile).toEqual(legacy.tokensByFile)
    })
  },
)
