import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { packageVersion } from './version.js'

describe('packageVersion', () => {
  it('reads the version of the published package at the repository root', () => {
    const root = path.resolve(import.meta.dirname, '..', '..', '..', 'package.json')
    const { version } = JSON.parse(fs.readFileSync(root, 'utf8')) as { version: string }
    expect(packageVersion()).toBe(version)
  })
})
