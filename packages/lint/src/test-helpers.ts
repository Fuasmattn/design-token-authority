import fs from 'node:fs'
import path from 'node:path'
import { parseTokenFiles } from '@dta/core'
import type { TokenModel } from '@dta/core'

export const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')

export function fixtureModel(fixture: string): TokenModel {
  const dir = path.join(repoRoot, 'test', 'fixtures', fixture, 'tokens')
  const files = fs.readdirSync(dir).map((fileName) => ({
    fileName,
    content: fs.readFileSync(path.join(dir, fileName), 'utf-8'),
  }))
  return parseTokenFiles(files).model
}

/** A model from `{ 'Collection.Mode.json': tokenTree }`. */
export function modelFrom(files: Record<string, unknown>): TokenModel {
  return parseTokenFiles(
    Object.entries(files).map(([fileName, content]) => ({
      fileName,
      content: JSON.stringify(content),
    })),
  ).model
}

export const color = (value: string) => ({ $type: 'color', $value: value })
export const num = (value: number) => ({ $type: 'number', $value: value })
