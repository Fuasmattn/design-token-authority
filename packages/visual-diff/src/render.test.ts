import { describe, expect, it } from 'vitest'
import {
  formatState,
  renderTokenChangesMarkdown,
  summarizeCounts,
  toJson,
  TOKEN_CHANGES_SCHEMA,
  type TokenChangeSet,
} from './index.js'

const set: TokenChangeSet = {
  counts: { changed: 1, added: 1, removed: 0, affected: 1 },
  changes: [
    {
      kind: 'changed',
      collection: 'Base',
      mode: 'Value',
      name: 'Blue',
      type: 'color',
      before: { raw: '#0000ff', resolved: '#0000ff' },
      after: { raw: '#0000cc', resolved: '#0000cc' },
    },
    {
      kind: 'added',
      collection: 'Base',
      mode: 'Value',
      name: 'Pill',
      type: 'number',
      after: { raw: 999, resolved: 999 },
    },
    {
      kind: 'affected',
      collection: 'Brand',
      mode: 'A',
      name: 'Primary',
      type: 'color',
      before: { raw: '{Blue}', resolved: '#0000ff' },
      after: { raw: '{Blue}', resolved: '#0000cc' },
      causes: ['Blue'],
    },
  ],
}

describe('summarizeCounts', () => {
  it('leaves out zeros and says when there is nothing', () => {
    expect(summarizeCounts(set.counts)).toBe('1 changed · 1 added · 1 affected')
    expect(summarizeCounts({ changed: 0, added: 0, removed: 0, affected: 0 })).toBe('no changes')
  })
})

describe('formatState', () => {
  it('shows aliases with their resolved value', () => {
    expect(formatState({ raw: '{Blue}', resolved: '#0000ff' })).toBe('`{Blue}` → `#0000ff`')
    expect(formatState({ raw: '{Gone}' })).toBe('`{Gone}` → unresolved')
    expect(formatState({ raw: 16, resolved: 16 })).toBe('`16`')
    expect(formatState(undefined)).toBe('—')
  })

  it('keeps table cells intact', () => {
    expect(formatState({ raw: 'a|b' })).toBe('`a\\|b`')
  })
})

describe('renderTokenChangesMarkdown', () => {
  it('renders one table per kind that has changes', () => {
    const markdown = renderTokenChangesMarkdown(set, { base: 'tokens-base' })
    expect(markdown).toContain('Base: `tokens-base` · **1 changed · 1 added · 1 affected**')
    expect(markdown).toContain('### Changed (1)')
    expect(markdown).toContain('| `Blue` | Base · Value | `#0000ff` | `#0000cc` |')
    expect(markdown).toContain('### Added (1)')
    expect(markdown).not.toContain('### Removed')
    expect(markdown).toContain('| `Primary` | Brand · A | `#0000ff` | `#0000cc` | `Blue` |')
  })

  it('says when nothing changed', () => {
    const empty = { changes: [], counts: { changed: 0, added: 0, removed: 0, affected: 0 } }
    expect(renderTokenChangesMarkdown(empty, { base: 'main' })).toContain('**no changes**')
  })
})

describe('toJson', () => {
  it('carries the schema id, base, counts and changes', () => {
    const parsed = JSON.parse(toJson(set, { base: 'main' }))
    expect(parsed).toEqual({
      schema: TOKEN_CHANGES_SCHEMA,
      base: 'main',
      counts: set.counts,
      changes: set.changes,
    })
  })
})
