import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from '../index.js'

let dir: string
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-clean-')))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const put = (file: string, content = 'x') => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  fs.writeFileSync(path.join(dir, file), content)
}
const exists = (file: string) => fs.existsSync(path.join(dir, file))

async function clean(config: unknown = {}, ...args: string[]) {
  fs.writeFileSync(path.join(dir, 'dta.config.json'), JSON.stringify(config))
  let stdout = ''
  const exitCode = await runCli(['clean', ...args], {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: () => undefined,
  })
  // eslint-disable-next-line no-control-regex
  return { exitCode, stdout: stdout.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '') }
}

describe('dta clean', () => {
  it('removes token files (keeping the folder and other files) and the default output', async () => {
    put('tokens/A.Value.json')
    put('tokens/notes.md')
    put('output/css/base.css')
    put('output/js/colorpalette.js')
    const { exitCode, stdout } = await clean()
    expect(exitCode).toBe(0)
    expect(exists('tokens/A.Value.json')).toBe(false)
    expect(exists('tokens/notes.md')).toBe(true)
    expect(exists('output')).toBe(false)
    expect(stdout).toContain('tokens/A.Value.json')
    expect(stdout).toContain('output/css/')
    expect(stdout).toContain('Clean complete!')
  })

  it('removes configured output folders', async () => {
    put('dist/css/base.css')
    put('dist/tw/tailwind.css')
    await clean({ outputs: { css: { outDir: 'dist/css' }, tailwind: { outDir: 'dist/tw' } } })
    expect(exists('dist')).toBe(false)
  })

  it('never removes more than the configured folder, even when its parent holds other files', async () => {
    put('src/styles/tokens/base.css')
    put('src/app.ts', 'keep me')
    await clean({ outputs: { css: { outDir: 'src/styles/tokens' } } })
    expect(exists('src/styles/tokens')).toBe(false)
    expect(exists('src/app.ts')).toBe(true)
  })

  it('refuses output folders outside the project', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-outside-'))
    fs.writeFileSync(path.join(outside, 'keep.txt'), 'x')
    try {
      const { stdout } = await clean({ outputs: { css: { outDir: outside } } })
      expect(fs.existsSync(path.join(outside, 'keep.txt'))).toBe(true)
      expect(stdout).toContain('outside the project')
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })

  it('says so when there is nothing to clean', async () => {
    const { exitCode, stdout } = await clean()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Nothing to clean.')
  })

  it('uses the configured tokens folder and reports with --verbose', async () => {
    put('design/tokens/A.Value.json')
    const { stdout } = await clean({ tokens: { dir: 'design/tokens' } }, '--verbose')
    expect(exists('design/tokens/A.Value.json')).toBe(false)
    expect(stdout).toContain('Removed 1 token file(s) from design/tokens/')
  })
})
