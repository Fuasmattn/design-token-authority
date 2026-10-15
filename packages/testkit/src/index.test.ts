import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  captureScenario,
  compareSnapshot,
  listFixtures,
  readSnapshot,
  SCENARIOS,
  writeSnapshot,
  type CliCommand,
  type ScenarioResult,
} from './index.js'

let tmp: string
let fixtureDir: string

/** A stand-in "CLI": runs `node -e <script>` and ignores the scenario args. */
function nodeScript(script: string): CliCommand {
  return { command: process.execPath, args: ['-e', script, '--'] }
}

const scenario = { name: 'demo', args: [] }

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'testkit-')))
  fixtureDir = path.join(tmp, 'fixture')
  fs.mkdirSync(path.join(fixtureDir, 'tokens'), { recursive: true })
  fs.writeFileSync(path.join(fixtureDir, 'tokens', 'a.json'), '{}\n')
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function capture(script: string, extra: { repoRoot?: string } = {}): Promise<ScenarioResult> {
  return captureScenario({
    fixtureDir,
    scenario,
    cli: nodeScript(script),
    repoRoot: extra.repoRoot ?? path.join(tmp, 'repo'),
  })
}

describe('SCENARIOS', () => {
  it('lists the commands every fixture is run with', async () => {
    expect(SCENARIOS.map((s) => s.name)).toEqual([
      'build',
      'lint',
      'graph-console',
      'graph-dot',
      'graph-markdown',
      'graph-html',
    ])
  })
})

describe('listFixtures', () => {
  it('returns the fixture directories sorted, ignoring plain files', async () => {
    fs.mkdirSync(path.join(tmp, 'zeta'))
    fs.mkdirSync(path.join(tmp, 'alpha'))
    fs.writeFileSync(path.join(tmp, 'README.md'), '')
    expect(listFixtures(tmp)).toEqual(['alpha', 'fixture', 'zeta'])
  })
})

describe('captureScenario', () => {
  it('returns stdout, stderr and the exit code', async () => {
    const result = await capture(`console.log('hello'); console.error('oops'); process.exit(2)`)
    expect(result).toMatchObject({ stdout: 'hello\n', stderr: 'oops\n', exitCode: 2 })
  })

  it('returns only files the command created, not the fixture files', async () => {
    const result = await capture(
      `require('fs').mkdirSync('output/css', {recursive: true}); require('fs').writeFileSync('output/css/a.css', 'x')`,
    )
    expect(result.files).toEqual({ 'output/css/a.css': 'x' })
  })

  it('runs every capture in a fresh copy and leaves the fixture untouched', async () => {
    const script = `const fs = require('fs'); console.log(fs.existsSync('marker.txt') ? 'existed' : 'fresh'); fs.writeFileSync('marker.txt', '1')`
    expect((await capture(script)).stdout).toBe('fresh\n')
    expect((await capture(script)).stdout).toBe('fresh\n')
    expect(fs.existsSync(path.join(fixtureDir, 'marker.txt'))).toBe(false)
  })

  it('strips ANSI colors and cursor codes', async () => {
    const result = await capture(`console.log('\\x1b[31mred\\x1b[0m \\x1b[?25lhidden\\x1b[?25h')`)
    expect(result.stdout).toBe('red hidden\n')
  })

  it('produces the same stdout whether or not a spinner printed intermediate frames', async () => {
    const fast = await capture(`process.stdout.write('|\\n' + 'o  done\\n')`)
    const slow = await capture(
      `process.stdout.write('|\\n' + '\\u2022  Working\\x1b[1G\\x1b[J' + 'o  done\\n')`,
    )
    expect(slow.stdout).toBe(fast.stdout)
    expect(slow.stdout).toBe('|\no  done\n')
  })

  it('replaces the working directory and the repo root with placeholders', async () => {
    const repoRoot = path.join(tmp, 'repo')
    const result = await capture(
      `console.log(process.cwd()); console.log(${JSON.stringify(repoRoot)} + '/src')`,
      {
        repoRoot,
      },
    )
    expect(result.stdout).toBe('<cwd>\n<repo>/src\n')
  })

  it('handles very long lines and large output quickly', async () => {
    // Generated HTML often has a single line of hundreds of kilobytes, and total output
    // can exceed Node's default 1 MB buffer for child processes.
    const result = await capture(
      `const fs = require('fs'); const long = 'x'.repeat(400000);
       fs.writeFileSync('long.html', '<html>' + long + '</html>\\n');
       process.stdout.write(long + '\\n' + 'y'.repeat(2000000) + '\\n')`,
    )
    expect(result.files['long.html']).toHaveLength(400000 + '<html></html>\n'.length)
    expect(result.stdout).toHaveLength(400000 + 1 + 2000000 + 1)
  })

  it('normalizes Windows line endings', async () => {
    expect((await capture(`process.stdout.write('a\\r\\nb\\r\\n')`)).stdout).toBe('a\nb\n')
  })

  it('pins locale, timezone and color settings and hides Figma credentials', async () => {
    process.env.FIGMA_FILE_KEY = 'secret-key'
    process.env.FIGMA_PERSONAL_ACCESS_TOKEN = 'secret-token'
    try {
      const result = await capture(
        `const e = process.env; console.log([e.LC_ALL, e.LANG, e.TZ, e.NO_COLOR, e.FORCE_COLOR, e.CI, e.FIGMA_FILE_KEY, e.FIGMA_PERSONAL_ACCESS_TOKEN].join('|'))`,
      )
      expect(result.stdout).toBe('en_US.UTF-8|en_US.UTF-8|UTC|1|0|1||\n')
    } finally {
      delete process.env.FIGMA_FILE_KEY
      delete process.env.FIGMA_PERSONAL_ACCESS_TOKEN
    }
  })

  it('stubs open and xdg-open so a command cannot launch a browser', async () => {
    const result = await capture(
      `const { spawnSync } = require('child_process'); for (const c of ['open', 'xdg-open']) console.log(c, spawnSync(c, ['x']).status)`,
    )
    expect(result.stdout).toBe('open 0\nxdg-open 0\n')
  })

  it('passes the scenario arguments after the base arguments', async () => {
    const result = await captureScenario({
      fixtureDir,
      scenario: { name: 'args', args: ['graph', '--format', 'dot'] },
      cli: nodeScript(`console.log(process.argv.slice(1).join(' '))`),
      repoRoot: path.join(tmp, 'repo'),
    })
    expect(result.stdout).toBe('graph --format dot\n')
  })
})

describe('writeSnapshot / readSnapshot', () => {
  const result: ScenarioResult = {
    stdout: 'out\n',
    stderr: '',
    exitCode: 0,
    files: { 'output/a.css': 'a', 'b.txt': 'b' },
  }

  it('round-trips a result', async () => {
    const dir = path.join(tmp, 'snap')
    writeSnapshot(dir, result)
    expect(readSnapshot(dir)).toEqual(result)
  })

  it('writes stderr only when it is not empty', async () => {
    const dir = path.join(tmp, 'snap')
    writeSnapshot(dir, result)
    expect(fs.existsSync(path.join(dir, 'stderr.txt'))).toBe(false)
    writeSnapshot(dir, { ...result, stderr: 'bad\n' })
    expect(readSnapshot(dir)?.stderr).toBe('bad\n')
  })

  it('replaces whatever was in the directory before', async () => {
    const dir = path.join(tmp, 'snap')
    writeSnapshot(dir, result)
    writeSnapshot(dir, { ...result, files: { 'only.txt': 'x' } })
    expect(readSnapshot(dir)?.files).toEqual({ 'only.txt': 'x' })
  })

  it('returns null when nothing was recorded there', async () => {
    expect(readSnapshot(path.join(tmp, 'missing'))).toBeNull()
  })
})

describe('compareSnapshot', () => {
  const base: ScenarioResult = {
    stdout: 'line 1\nline 2\nline 3\n',
    stderr: '',
    exitCode: 0,
    files: { 'out/a.css': 'a\n' },
  }

  it('reports no mismatches for identical results', async () => {
    expect(compareSnapshot(base, structuredClone(base))).toEqual([])
  })

  it('shows a readable diff when stdout differs', async () => {
    const mismatches = compareSnapshot(base, { ...base, stdout: 'line 1\nline TWO\nline 3\n' })
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0]).toContain('stdout differs')
    expect(mismatches[0]).toContain('-line 2')
    expect(mismatches[0]).toContain('+line TWO')
  })

  it('reports differing stderr', async () => {
    const mismatches = compareSnapshot(base, { ...base, stderr: 'boom\n' })
    expect(mismatches[0]).toContain('stderr differs')
    expect(mismatches[0]).toContain('+boom')
  })

  it('reports a differing exit code', async () => {
    expect(compareSnapshot(base, { ...base, exitCode: 3 })).toEqual([
      'exit code: expected 0, got 3',
    ])
  })

  it('reports missing, unexpected and changed files', async () => {
    const mismatches = compareSnapshot(
      { ...base, files: { 'a.txt': '1\n', 'b.txt': '2\n', 'c.txt': 'old\n' } },
      { ...base, files: { 'b.txt': '2\n', 'c.txt': 'new\n', 'd.txt': '4\n' } },
    )
    expect(mismatches.join('\n')).toContain('missing file: a.txt')
    expect(mismatches.join('\n')).toContain('unexpected file: d.txt')
    expect(mismatches.join('\n')).toContain('file differs: c.txt')
    expect(mismatches.join('\n')).toContain('-old')
    expect(mismatches.join('\n')).toContain('+new')
    expect(mismatches.join('\n')).not.toContain('b.txt')
  })

  it('truncates very long diffs', async () => {
    const many = (prefix: string) =>
      Array.from({ length: 500 }, (_, i) => `${prefix}${i}`).join('\n')
    const [message] = compareSnapshot(
      { ...base, stdout: many('a') },
      { ...base, stdout: many('b') },
    )
    expect(message.split('\n').length).toBeLessThan(80)
    expect(message).toMatch(/more diff lines/)
  })
})
