import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aliasProblems, analyzeGraph, formatDiagnostic, parseTokenFiles } from './index.js'
import type { TokenFileInput } from './index.js'

const file = (fileName: string, tree: unknown): TokenFileInput => ({
  fileName,
  content: JSON.stringify(tree),
})
const n = (value: number | string) => ({ $type: 'number', $value: value })
const problems = (...files: TokenFileInput[]) =>
  aliasProblems(analyzeGraph(parseTokenFiles(files).model))

describe('aliasProblems', () => {
  it('finds nothing in a graph whose aliases all resolve', () => {
    const result = problems(file('A.V.json', { raw: n(1), mid: n('{raw}'), top: n('{mid}') }))
    expect(result.diagnostics).toEqual([])
    expect([...result.unresolvable]).toEqual([])
  })

  it('reports a dangling alias as an error worded like dta lint, with its file and path', () => {
    const result = problems(file('A.V.json', { Link: { Main: n('{Nowhere.Fast}') } }))
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'dangling-alias',
        message: 'Alias {Nowhere.Fast} references non-existent token "Nowhere.Fast"',
        file: 'A.V.json',
        path: ['Link', 'Main'],
        docs: 'lint-rules',
      },
    ])
    expect(formatDiagnostic(result.diagnostics[0])).toBe(
      'error [dangling-alias] Alias {Nowhere.Fast} references non-existent token "Nowhere.Fast". See site/src/content/docs/reference/lint-rules.mdx. (A.V.json)',
    )
    expect(formatDiagnostic(result.diagnostics[0], { docs: false })).toBe(
      'error [dangling-alias] Alias {Nowhere.Fast} references non-existent token "Nowhere.Fast". (A.V.json)',
    )
  })

  it('reports a cycle once, and every alias that runs into it or a dangling one is unresolvable', () => {
    const result = problems(
      file('A.V.json', {
        a: n('{b}'),
        b: n('{a}'),
        intoCycle: n('{a}'),
        lost: n('{gone}'),
        intoLost: n('{lost}'),
        fine: n('{raw}'),
        raw: n(1),
      }),
    )
    expect(result.diagnostics.map((d) => [d.code, d.message])).toEqual([
      ['dangling-alias', 'Alias {gone} references non-existent token "gone"'],
      ['circular-alias', 'Circular alias chain: A.V/a → A.V/b → A.V/a'],
    ])
    expect(result.diagnostics[1]).toMatchObject({ file: 'A.V.json', path: ['a'] })
    expect([...result.unresolvable].sort()).toEqual([
      'A.V/a',
      'A.V/b',
      'A.V/intoCycle',
      'A.V/intoLost',
      'A.V/lost',
    ])
  })

  it('reports only the nodes `include` keeps, but still marks the others unresolvable', () => {
    const graph = analyzeGraph(
      parseTokenFiles([
        file('A.V.json', { x: n('{missing}') }),
        file('B.V.json', { y: n('{alsoMissing}') }),
      ]).model,
    )
    const result = aliasProblems(graph, (node) => node.collection === 'B')
    expect(result.diagnostics.map((d) => d.file)).toEqual(['B.V.json'])
    expect([...result.unresolvable].sort()).toEqual(['A.V/x', 'B.V/y'])
  })

  it('finds the two flaws of the brand-ab-problems fixture with the messages dta lint prints', () => {
    const dir = path.resolve(import.meta.dirname, '../../../test/fixtures/brand-ab-problems/tokens')
    const files = fs.readdirSync(dir).map((fileName) => ({
      fileName,
      content: fs.readFileSync(path.join(dir, fileName), 'utf-8'),
    }))
    const result = aliasProblems(analyzeGraph(parseTokenFiles(files).model))
    expect(result.diagnostics.map((d) => `${d.message} (${d.file})`)).toEqual([
      'Alias {Colors.Foundation.Sky.550} references non-existent token "Colors.Foundation.Sky.550" (Brand(Alias).BrandB.json)',
      'Circular alias chain: Brand(Alias).BrandA/Colors/Surface/Muted → Brand(Alias).BrandA/Colors/Text/Muted → Brand(Alias).BrandA/Colors/Surface/Muted (Brand(Alias).BrandA.json)',
    ])
  })
})
