import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CUSTOM_PAGES } from './custom-pages.mjs'

describe('custom pages the docs link to', () => {
  it.each(CUSTOM_PAGES)('%s is a page in src/pages', (page) => {
    const file = path.join(
      import.meta.dirname,
      'src',
      'pages',
      `${page.replace(/^\/|\/$/g, '')}.astro`,
    )
    expect(fs.existsSync(file), file).toBe(true)
  })
})
