/**
 * Write the example workflows of `dta diff` (actions/examples) from the template `dta init
 * --diff` uses (TICKET-129), for npm and Node 24. A test fails when a committed file is out of
 * date.
 *
 *   pnpm workflows:generate
 */

import fs from 'node:fs'
import path from 'node:path'
import { exampleWorkflows } from '../packages/cli/src/init/diff-workflows.js'

const root = path.resolve(import.meta.dirname, '..')
for (const file of exampleWorkflows()) {
  fs.writeFileSync(path.join(root, 'actions', 'examples', file.name), file.content)
  console.log(`Wrote actions/examples/${file.name}`)
}
