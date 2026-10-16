import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateDocsHtml } from './index.js'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')

function tokenFiles(fixture: string) {
  const dir = path.join(repoRoot, 'test', 'fixtures', fixture, 'tokens')
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((fileName) => ({ fileName, content: fs.readFileSync(path.join(dir, fileName), 'utf8') }))
}

const snapshot = (fixture: string) =>
  fs.readFileSync(
    path.join(
      repoRoot,
      'test',
      'snapshots',
      fixture,
      'build',
      'files',
      'output',
      'docs',
      'index.html',
    ),
    'utf8',
  )

describe('generateDocsHtml: parity with the v1 build snapshots', () => {
  it.each([
    ['brand-ab', ['BrandA', 'BrandB']],
    ['daisyui', []],
  ])('%s', (fixture, brands) => {
    expect(generateDocsHtml(tokenFiles(fixture), brands)).toBe(snapshot(fixture))
  })
})

describe('generateDocsHtml: input handling', () => {
  const color = { $type: 'color', $value: '#112233' }
  const file = (fileName: string, content: unknown) => ({
    fileName,
    content: JSON.stringify(content),
  })

  it('does not depend on the order of the files', () => {
    const files = tokenFiles('brand-ab')
    expect(generateDocsHtml([...files].reverse(), ['BrandA', 'BrandB'])).toBe(
      generateDocsHtml(files, ['BrandA', 'BrandB']),
    )
  })

  it('skips files that are not JSON, and files that are not token files', () => {
    const files = [
      file('Base.Value.json', { Blue: color }),
      { fileName: 'Broken.Value.json', content: '{ nope' },
      { fileName: 'notes.md', content: '# hi' },
    ]
    const html = generateDocsHtml(files, [])
    expect(html).toContain('#112233')
    expect(html).not.toContain('Broken')
  })

  it('renders an empty project', () => {
    expect(generateDocsHtml([], [])).toContain('<html')
  })
})
