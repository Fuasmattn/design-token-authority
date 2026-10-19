import fs from 'node:fs'
import path from 'node:path'
import { DOC_PATHS } from '@dta/core'
import { describe, expect, it } from 'vitest'
import { DOC_LINKS } from './doc-links'

const docs = path.join(import.meta.dirname, '..', 'content', 'docs')

describe('doc links of diagnostics', () => {
  it('links every doc id the packages use to a page of this site that exists', () => {
    expect(Object.keys(DOC_LINKS).sort()).toEqual(Object.keys(DOC_PATHS).sort())
    for (const { href } of Object.values(DOC_LINKS)) {
      expect(href).toMatch(/^\/[a-z0-9/-]+\/$/)
      const page = path.join(docs, href.slice(1, -1))
      expect(
        ['.md', '.mdx'].some((ext) => fs.existsSync(page + ext)),
        `${href} is a docs page`,
      ).toBe(true)
    }
  })
})
