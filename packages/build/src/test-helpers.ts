import fs from 'node:fs'
import path from 'node:path'
import { parseTokenFiles } from '@dta/core'
import type { TokenModel } from '@dta/core'
import { buildOutputs } from './index.js'
import type { BuildOptions } from './index.js'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')

export function fixtureModel(fixture: string): TokenModel {
  const dir = path.join(repoRoot, 'test', 'fixtures', fixture, 'tokens')
  const files = fs.readdirSync(dir).map((fileName) => ({
    fileName,
    content: fs.readFileSync(path.join(dir, fileName), 'utf-8'),
  }))
  return parseTokenFiles(files).model
}

/**
 * The build options of a fixture's `dta.config.ts` that change what is built: its brands and,
 * for brand-ab, its breakpoints (TICKET-091). Snapshot comparisons build with these.
 */
export function fixtureOptions(fixture: string): BuildOptions {
  if (fixture !== 'brand-ab') return { brands: [] }
  return {
    brands: ['BrandA', 'BrandB'],
    breakpoints: {
      collection: 'ScreenType',
      default: 'Mobile',
      media: [
        { mode: 'Tablet', query: '(min-width: 768px)' },
        { mode: 'Desktop', query: '(min-width: 1024px)' },
      ],
    },
  }
}

export function snapshot(fixture: string, file: string): string {
  return fs.readFileSync(
    path.join(repoRoot, 'test', 'snapshots', fixture, 'build', 'files', file),
    'utf-8',
  )
}

export type Spec = { type: string; value: string | number | boolean; scopes?: string[] }

/** A single-mode collection with the given tokens, nested by their dot path. */
export function model(tokens: Record<string, Spec>): TokenModel {
  const tree: Record<string, unknown> = {}
  for (const [dotPath, { type, value, scopes }] of Object.entries(tokens)) {
    const segments = dotPath.split('.')
    let node = tree
    for (const segment of segments.slice(0, -1)) {
      node = (node[segment] ??= {}) as Record<string, unknown>
    }
    node[segments[segments.length - 1]] = {
      $type: type,
      $value: value,
      ...(scopes ? { $extensions: { 'com.figma': { scopes } } } : {}),
    }
  }
  return parseTokenFiles([{ fileName: 'Base.Value.json', content: JSON.stringify(tree) }]).model
}

export async function sharedFile(tokens: Record<string, Spec>, file: string) {
  const { files } = await buildOutputs(model(tokens), {})
  return files.find((f) => f.path === file)?.content ?? ''
}
