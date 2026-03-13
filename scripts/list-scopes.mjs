import { readFileSync, readdirSync } from 'fs'

const scopes = new Map()

function walk(obj) {
  if (obj && typeof obj === 'object') {
    if (obj.$type === 'number' && obj.$extensions?.['com.figma']?.scopes) {
      for (const scope of obj.$extensions['com.figma'].scopes) {
        scopes.set(scope, (scopes.get(scope) ?? 0) + 1)
      }
    } else {
      for (const v of Object.values(obj)) walk(v)
    }
  }
}

for (const f of readdirSync('tokens').filter((x) => x.endsWith('.json'))) {
  walk(JSON.parse(readFileSync(`tokens/${f}`, 'utf-8')))
}

for (const [scope, count] of [...scopes.entries()].sort()) {
  console.log(`${scope.padEnd(30)} ${count} tokens`)
}
