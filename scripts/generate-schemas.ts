/**
 * Write the JSON Schemas generated from the Zod schemas: the token file input format
 * (@dta/figma) and dta diff's result.json (@dta/visual-diff). Tests fail when a committed file
 * is out of date.
 *
 *   pnpm schema:generate
 */

import fs from 'node:fs'
import path from 'node:path'
import { tokenFileJsonSchema } from '@dta/figma'
import { diffResultJsonSchema } from '@dta/visual-diff'

const root = path.resolve(import.meta.dirname, '..')
const targets: Array<[string, Record<string, unknown>]> = [
  ['docs/token-files/token-file.schema.json', tokenFileJsonSchema()],
  ['docs/diff/result.schema.json', diffResultJsonSchema()],
]
for (const [file, schema] of targets) {
  const target = path.join(root, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(schema, null, 2) + '\n')
  console.log(`Wrote ${file}`)
}
