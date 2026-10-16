import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from '../index.js'

let dir: string
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-lint-')))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

function project(tokens: Record<string, unknown> | null, config: unknown = {}) {
  fs.writeFileSync(path.join(dir, 'dta.config.json'), JSON.stringify(config))
  if (tokens === null) return
  fs.mkdirSync(path.join(dir, 'tokens'))
  for (const [name, content] of Object.entries(tokens)) {
    fs.writeFileSync(path.join(dir, 'tokens', name), JSON.stringify(content))
  }
}

async function lint(...args: string[]) {
  let stdout = ''
  let stderr = ''
  const exitCode = await runCli(['lint', ...args], {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  })
  // eslint-disable-next-line no-control-regex
  const plain = (text: string) => text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
  return { exitCode, stdout: plain(stdout), stderr: plain(stderr) }
}

const color = (value: string) => ({ $type: 'color', $value: value })

describe('dta lint', () => {
  it('passes a clean project', async () => {
    project({ 'Base.Value.json': { A: color('#fff') } })
    const { exitCode, stdout } = await lint()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('No lint violations found.')
    expect(stdout).toContain('All clean!')
  })

  it('passes with warnings (exit 0) and groups them by file', async () => {
    project(
      { 'Base.Value.json': { A: color('#fff'), B: color('#fff') } },
      { lint: { rules: { 'no-duplicate-values': {} } } },
    )
    const { exitCode, stdout } = await lint()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Base.Value.json')
    expect(stdout).toContain('[no-duplicate-values]')
    expect(stdout).toContain('1 warning found.')
    expect(stdout).toContain('Lint passed with warnings.')
  })

  it('fails with exit code 2 when there are errors', async () => {
    project({ 'Base.Mode 1.json': { A: color('#fff') } })
    const { exitCode, stdout } = await lint()
    expect(exitCode).toBe(2)
    expect(stdout).toContain('1 error found.')
    expect(stdout).toContain('Lint failed.')
  })

  it('reports a missing tokens directory', async () => {
    project(null)
    const { exitCode, stdout } = await lint()
    expect(exitCode).toBe(1)
    expect(stdout).toContain('Tokens directory "tokens" not found.')
  })

  it('says --fix is not supported and still lints', async () => {
    project({ 'Base.Value.json': { A: color('#fff') } })
    const { exitCode, stdout } = await lint('--fix')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('--fix is not yet supported')
  })

  it('shows token file problems and fails', async () => {
    project({ 'Base.Value.json': { A: color('#fff') } })
    fs.writeFileSync(path.join(dir, 'tokens', 'Broken.Value.json'), '{ not json')
    const { exitCode, stdout } = await lint()
    expect(exitCode).toBe(1)
    expect(stdout).toContain('Broken.Value.json')
    expect(stdout).toContain('Lint failed.')
  })
})
