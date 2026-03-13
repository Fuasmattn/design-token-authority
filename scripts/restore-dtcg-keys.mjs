/**
 * One-time migration: restores DTCG $ prefixes to token files
 * after they were stripped by the old removedollarsigns.sh script.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'

const DTCG_KEYS = new Set(['type', 'value', 'description', 'extensions'])

function restoreDollars(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    const newKey = DTCG_KEYS.has(k) ? `$${k}` : k
    result[newKey] = restoreDollars(v)
  }
  return result
}

const dir = 'tokens'
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const fullPath = join(dir, file)
  const obj = JSON.parse(readFileSync(fullPath, 'utf-8'))
  writeFileSync(fullPath, JSON.stringify(restoreDollars(obj), null, 2))
  console.log(`Restored $-prefixes: ${file}`)
}

console.log('Done.')
