/**
 * The docs never mention ticket numbers or internal spec decisions: they are planning, not
 * documentation (TICKET-150). Checks the page sources and the pages generated at site build.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { commandsPage, configurationPage } from './scripts/generate-reference.js'

const DOCS = path.join(import.meta.dirname, 'src', 'content', 'docs')
// "TICKET-122", "ticket 039", "079's wrapping", "(spec, decision 15)", "spec decision 8".
const INTERNAL = /\bTICKET-\d+|\bticket \d+|\b0\d{2}'s\b|\bspec,? decision \d+/i

function pages(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
}

const hits = (text: string) =>
  text
    .split('\n')
    .map((line, i) => ({ line: i + 1, match: INTERNAL.exec(line)?.[0] }))
    .filter((hit) => hit.match)

describe('docs without internal references', () => {
  it('finds a ticket number or a spec decision (the check works)', () => {
    expect(hits('as decided (decision, TICKET-122).')).toHaveLength(1)
    expect(hits('(playground spec, decision 15)')).toHaveLength(1)
    expect(hits("replacing 079's wrapping")).toHaveLength(1)
    expect(hits('Tickets (`docs/tickets/`) are one deliverable each.')).toHaveLength(0)
  })

  it.each(pages(DOCS).map((file) => [path.relative(DOCS, file), file]))(
    '%s has none',
    (_name, file) => {
      expect(hits(fs.readFileSync(file, 'utf8'))).toEqual([])
    },
  )

  it('the generated Configuration and Commands pages have none', async () => {
    expect(hits(configurationPage())).toEqual([])
    expect(hits(await commandsPage())).toEqual([])
  })
})
