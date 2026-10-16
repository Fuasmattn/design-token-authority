import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { COMMAND_NAMES, runCli } from './index.js'

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-cli-run-')))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

async function run(args: string[]) {
  let stdout = ''
  let stderr = ''
  const exitCode = await runCli(args, {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  })
  return { exitCode, stdout, stderr }
}

function writeConfig(config: unknown = {}, name = 'dta.config.json'): void {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(config))
}

describe('help and usage', () => {
  it('lists every command', async () => {
    const { exitCode, stdout } = await run(['--help'])
    expect(exitCode).toBe(0)
    for (const name of COMMAND_NAMES) expect(stdout).toContain(name)
  })

  it('offers the same commands as the legacy CLI', () => {
    expect([...COMMAND_NAMES].sort()).toEqual(
      ['analyze', 'build', 'clean', 'graph', 'init', 'lint', 'pull', 'push', 'test:visual'].sort(),
    )
  })

  it('shows usage and fails when no command is given', async () => {
    const { exitCode, stderr } = await run([])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })

  it('fails on an unknown command and names it', async () => {
    const { exitCode, stderr } = await run(['frobnicate'])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('frobnicate')
  })

  it('documents the options of a command', async () => {
    const { stdout } = await run(['graph', '--help'])
    expect(stdout).toContain('--format')
    expect(stdout).toContain('--output')
    expect(stdout).toContain('--config')
  })
})

describe('commands that are not ported yet', () => {
  it('exit with code 3 and say so, once the config is valid', async () => {
    writeConfig({ figma: { source: 'file' } })
    const { exitCode, stdout, stderr } = await run(['pull'])
    expect(exitCode).toBe(3)
    expect(stdout).toBe('')
    expect(stderr).toContain('"pull" is not ported')
  })

  it('accept the options of the legacy command', async () => {
    writeConfig()
    const { exitCode } = await run(['push', '--dry-run', '--format', 'markdown', '-v'])
    expect(exitCode).toBe(3)
  })

  it('init does not need a config', async () => {
    const { exitCode, stderr } = await run(['init'])
    expect(exitCode).toBe(3)
    expect(stderr).toContain('"init" is not ported')
  })
})

describe('config handling', () => {
  it('fails with code 1 and explains how to fix a missing config', async () => {
    const { exitCode, stderr } = await run(['build'])
    expect(exitCode).toBe(1)
    expect(stderr).toContain('No config file found')
    expect(stderr).toContain('--config')
  })

  it('fails with code 2 and names each invalid field', async () => {
    writeConfig({ outputs: { css: { outDir: 1 } }, brands: 'A' })
    const { exitCode, stderr } = await run(['lint'])
    expect(exitCode).toBe(2)
    expect(stderr).toContain('Invalid configuration')
    expect(stderr).toContain('outputs.css.outDir')
    expect(stderr).toContain('brands')
  })

  it('uses the file given with --config', async () => {
    writeConfig({ brands: 5 }, 'dta.config.json')
    fs.writeFileSync(path.join(dir, 'other.json'), '{}')
    const { exitCode } = await run(['pull', '--config', 'other.json'])
    expect(exitCode).toBe(3)
  })
})
