import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  planSection,
  planWorkflows,
  readRecord,
  writeSection,
  type DiffSection,
} from './diff-setup.js'
import { renderDiffWorkflows } from './diff-workflows.js'

const SECTION: DiffSection = {
  build: 'npx dta build && npm run build-storybook',
  outDir: 'storybook-static',
  stories: { type: 'storybook' },
  workflow: 'split',
}

const written = (file: string, content: string, section = SECTION, record = section) => {
  const edit = writeSection(file, content, section, record)
  if (!edit.ok) throw new Error(edit.reason)
  return edit.content
}

describe('writeSection (TICKET-131)', () => {
  it('inserts the block after a last property without a trailing comma', () => {
    const content = written('dta.config.ts', "export default {\n  tokens: { dir: 'tokens' }\n}\n")
    expect(content).toMatch(/tokens: \{ dir: 'tokens' \},\n\n {2}\/\/ dta init --diff: generated/)
    expect(content.trimEnd().endsWith('// end of dta init --diff\n}')).toBe(true)
  })

  it('finds the end of the exported object, not of a function after it', () => {
    const content = written(
      'dta.config.ts',
      [
        "export default defineConfig({ tokens: { dir: 'tokens' } })",
        '',
        'function helper() {',
        "  return '}'",
        '}',
        '',
      ].join('\n'),
    )
    const exported = content.slice(0, content.indexOf('function helper'))
    expect(exported).toContain('diff: {')
    expect(content.slice(content.indexOf('function helper'))).not.toContain('diff')
  })

  it('does not edit a diff section it did not write, also as shorthand', () => {
    for (const config of [
      "export default { diff: { outDir: 'x' } }\n",
      'const diff = { outDir: "x" }\nexport default { tokens: {}, diff }\n',
    ]) {
      const edit = writeSection('dta.config.ts', config, SECTION)
      expect(edit.ok).toBe(false)
    }
  })

  it('replaces its block, keeping lines added by hand, also when Prettier wrapped its keys', () => {
    const first = written('dta.config.ts', 'export default {\n  tokens: {},\n}\n', {
      ...SECTION,
      stories: ['/', '/pricing'],
    })
    // As Prettier wraps long values, plus a key added by hand.
    const wrapped = first
      .replace(
        '    build: "npx dta build && npm run build-storybook",',
        "    build:\n      'npx dta build && npm run build-storybook',",
      )
      .replace(
        '    stories: ["/", "/pricing"],',
        "    stories: [\n      '/',\n      '/pricing',\n    ],",
      )
      .replace("    workflow: 'split',", "    workflow: 'split',\n    viewports: [1280, 390],")
    const again = written('dta.config.ts', wrapped, { ...SECTION, stories: ['/', '/pricing'] })
    const block = again.slice(again.indexOf('diff: {'), again.indexOf('// end of dta init'))
    expect(block.match(/build:/g)).toHaveLength(1)
    expect(block).not.toContain("'/pricing',")
    expect(block).toContain('viewports: [1280, 390],')
  })
})

describe('planSection', () => {
  it('keeps a key changed by hand on every re-run, since the record holds the proposal', () => {
    const proposed = SECTION
    const handBuild = 'npm run build:prod'
    const current = { ...SECTION, build: handBuild }
    const plan = planSection(proposed, current, SECTION)
    expect(plan.kept).toEqual([`build: ${handBuild} (changed by hand)`])
    // What init writes: the hand value in the section, the proposal in the record.
    const content = written('dta.config.ts', 'export default {\n}\n', plan.next, proposed)
    const next = planSection(proposed, current, readRecord(content))
    expect(next.kept).toEqual([`build: ${handBuild} (changed by hand)`])
    expect(next.next.build).toBe(handBuild)
  })
})

describe('planWorkflows after an upgrade (TICKET-148)', () => {
  const render = (ref: string) =>
    renderDiffWorkflows({
      manager: 'npm',
      install: 'npm ci',
      node: { file: '.nvmrc' },
      layout: 'single',
      ref,
    })

  it('moves an untouched workflow to the new release, and keeps one edited by hand', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-workflows-'))
    try {
      for (const file of planWorkflows(root, render('v2.1.0')).write) {
        fs.mkdirSync(path.dirname(path.join(root, file.path)), { recursive: true })
        fs.writeFileSync(path.join(root, file.path), file.content)
      }
      const upgrade = planWorkflows(root, render('v2.2.0'))
      expect(upgrade.changes).toEqual(['.github/workflows/dta-diff.yml (updated)'])
      expect(upgrade.write[0].content).toContain('actions/diff-pr@v2.2.0')

      const file = path.join(root, '.github/workflows/dta-diff.yml')
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('npm ci', 'npm install'))
      expect(planWorkflows(root, render('v2.2.0')).kept).toEqual([
        '.github/workflows/dta-diff.yml (edited by hand: not overwritten)',
      ])
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
