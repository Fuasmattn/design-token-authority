import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { banner } from '../ui.js'
import { readTokenDir, TokenDirError } from './token-dir.js'
import { writeFiles } from './write-files.js'

let dir: string
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-io-')))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('readTokenDir', () => {
  it('reads json files sorted by name, skipping blank files and other extensions', () => {
    fs.mkdirSync(path.join(dir, 'tokens'))
    fs.writeFileSync(path.join(dir, 'tokens', 'B.Value.json'), '{"a":1}')
    fs.writeFileSync(path.join(dir, 'tokens', 'A.Value.json'), '{}')
    fs.writeFileSync(path.join(dir, 'tokens', 'Blank.Value.json'), '  \n')
    fs.writeFileSync(path.join(dir, 'tokens', 'notes.md'), 'x')
    expect(readTokenDir('tokens', dir)).toEqual([
      { fileName: 'A.Value.json', content: '{}' },
      { fileName: 'B.Value.json', content: '{"a":1}' },
    ])
  })

  it('names the directory and the fix when it is missing', () => {
    expect(() => readTokenDir('tokens', dir)).toThrow(TokenDirError)
    expect(() => readTokenDir('tokens', dir)).toThrow(/"tokens" not found[\s\S]*dta pull/)
  })

  it('treats a file as a missing directory', () => {
    fs.writeFileSync(path.join(dir, 'tokens'), '')
    expect(() => readTokenDir('tokens', dir)).toThrow(TokenDirError)
  })
})

describe('writeFiles', () => {
  it('creates folders and writes the content', () => {
    writeFiles(dir, [{ path: 'output/css/base.css', content: ':root{}' }])
    expect(fs.readFileSync(path.join(dir, 'output/css/base.css'), 'utf8')).toBe(':root{}')
  })

  it('refuses to write outside the project', () => {
    expect(() => writeFiles(dir, [{ path: '../escape.txt', content: 'x' }])).toThrow(/outside/)
    expect(fs.existsSync(path.join(dir, '..', 'escape.txt'))).toBe(false)
  })
})

describe('banner', () => {
  it('shows the command name with its icon', () => {
    // eslint-disable-next-line no-control-regex
    const plain = banner('lint').replace(/\u001b\[[0-9;]*m/g, '')
    expect(plain).toBe(' ✔  dta lint ')
  })
})
