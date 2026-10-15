/**
 * Write the JSON Schema of the input format, generated from the Zod schema in @dta/figma.
 * A test fails when the committed file is out of date.
 *
 *   pnpm schema:generate        rewrite docs/token-files/token-file.schema.json
 */

import fs from 'node:fs'
import path from 'node:path'
import { tokenFileJsonSchema } from '@dta/figma'

const target = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'docs',
  'token-files',
  'token-file.schema.json',
)
fs.writeFileSync(target, JSON.stringify(tokenFileJsonSchema(), null, 2) + '\n')
console.log(`Wrote ${path.relative(process.cwd(), target)}`)
