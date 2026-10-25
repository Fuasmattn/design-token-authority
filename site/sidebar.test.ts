/**
 * The docs sidebar (TICKET-149): every group starts collapsed except the first, Start. Starlight
 * still opens the group that holds the current page.
 */
import { describe, expect, it } from 'vitest'
import { SIDEBAR } from './sidebar.mjs'

type Entry = { label: string; collapsed?: boolean; items?: Entry[]; link?: string }
const groups = (entries: readonly Entry[]): Entry[] =>
  entries.flatMap((entry) => (entry.items ? [entry, ...groups(entry.items)] : []))

describe('docs sidebar', () => {
  it('opens Start and collapses every other group, nested ones included', () => {
    const [first, ...rest] = SIDEBAR as readonly Entry[]
    expect(first.label).toBe('Start')
    expect(first.collapsed).not.toBe(true)
    const others = groups(rest).filter((group) => group.label)
    expect(others.map((group) => group.label)).toEqual([
      'Learn',
      'Guides',
      'Reference',
      'Design system',
      'Tokens',
      'Components',
      'Contribute',
    ])
    for (const group of others) expect(group.collapsed, group.label).toBe(true)
  })

  it('keeps the playground a plain link', () => {
    expect((SIDEBAR as readonly Entry[]).find((entry) => entry.label === 'Playground')).toEqual({
      label: 'Playground',
      link: '/playground/',
    })
  })
})
