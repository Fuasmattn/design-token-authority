/**
 * The generated reference (site/scripts/generate-reference.ts): every command and option of the
 * CLI is on the Commands page, every config key on the Configuration page, and every docs page
 * in llms.txt and llms-full.txt.
 */
import fs from 'node:fs'
import path from 'node:path'
import { commandReference, configJsonSchema } from '@dta/cli'
import { describe, expect, it } from 'vitest'
import {
  commandsPage,
  configRows,
  configurationPage,
  docPages,
  llmsFullTxt,
  llmsTxt,
  toMarkdown,
  typeOf,
} from './scripts/generate-reference.js'

describe('Commands page', async () => {
  const page = await commandsPage()

  it.each(commandReference().map((command) => [command.name, command] as const))(
    'has dta %s with all its options',
    (name, command) => {
      expect(page).toContain(`## dta ${name}\n`)
      expect(page).toContain(`$ dta ${name} --help\nUsage: dta ${name} [options]`)
      for (const option of command.options) expect(page).toContain(option.flags)
    },
  )

  it('starts with the overview of dta --help', () => {
    expect(page).toContain('$ dta --help\nUsage: dta [options] [command]')
  })
})

describe('Configuration page', () => {
  const page = configurationPage()

  it('has a row for every key of the config schema', () => {
    const rows = configRows(configJsonSchema())
    expect(rows.length).toBeGreaterThan(40)
    for (const row of rows) expect(page).toContain(`| \`${row.key}\` |`)
    expect(rows.map((row) => row.key)).toEqual(
      expect.arrayContaining([
        'figma.source',
        'tokens.dir',
        'outputs.css.outDir',
        'lint.rules.color-contrast.pairs',
        'diff.stories.excludeTags',
        'diff.publish.url',
        'push.skipConfirmation',
      ]),
    )
  })

  it('shows types, defaults and required keys', () => {
    expect(page).toContain("| `figma.source` | `'api' \\| 'file'` |")
    expect(page).toContain('| `tokens.dir` | `string` | `"tokens"` |')
    expect(page).toContain('| `outputs.css.outDir` | `string (required)` |')
    expect(page).toContain("(`type: 'storybook'`) Stories with one of these tags")
    expect(page).toContain('## diff\n')
    expect(page).toContain('Key of the Figma file (from its URL: figma.com/file/&lt;key>/…).')
  })

  it('names JSON Schema types the way a config author reads them', () => {
    expect(typeOf({ type: 'array', items: { type: 'string' } })).toBe('string[]')
    expect(typeOf({ type: 'array', prefixItems: [{ type: 'string' }, { type: 'string' }] })).toBe(
      '[string, string]',
    )
    expect(typeOf({ type: 'object', additionalProperties: { type: 'string' } })).toBe(
      '{ [name]: string }',
    )
    expect(typeOf({ anyOf: [{ type: 'string' }, { type: 'object' }] })).toBe('string | object')
    expect(typeOf({ not: {} })).toBe('never')
  })
})

describe('llms.txt', () => {
  const pages = docPages()

  it('lists every page of Start, Learn, Guides, Reference and Contribute', () => {
    const docsDir = path.join(import.meta.dirname, 'src', 'content', 'docs')
    const files = ['start', 'learn', 'guides', 'reference', 'contribute'].flatMap((dir) =>
      fs.readdirSync(path.join(docsDir, dir), { recursive: true, encoding: 'utf8' }),
    )
    const sources = files.filter((file) => /\.mdx?$/.test(file))
    // The generated reference pages may not exist yet in a fresh checkout.
    expect(pages.length).toBeGreaterThanOrEqual(sources.length)
    const index = llmsTxt(pages)
    for (const page of pages) expect(index).toContain(`- [${page.title}](${page.url})`)
    expect(index).toContain('- [Token patterns](/learn/patterns/)')
    expect(index).not.toContain('/design-system/')
  })

  it('llms-full.txt has the text of every page, without MDX', () => {
    const full = llmsFullTxt(pages)
    for (const page of pages) expect(full).toContain(`# ${page.title}\n\nURL: ${page.url}`)
    expect(full).not.toMatch(/^import /m)
    expect(full).not.toContain('<Code')
    expect(full).not.toContain('<Steps>')
  })

  it('inlines code imported with ?raw', () => {
    const file = path.join(import.meta.dirname, 'src', 'content', 'docs', 'guides', 'x.mdx')
    const markdown = toMarkdown(
      'import config from \'../../../../learn-examples/tiers/dta.config.ts?raw\'\n\n<Code code={config} lang="ts" title="dta.config.ts" />\n',
      file,
    )
    expect(markdown).toMatch(/^```ts title="dta.config.ts"\nexport default \{/)
  })
})
