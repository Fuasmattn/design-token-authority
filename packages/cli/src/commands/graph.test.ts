import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from '../index.js'

let dir: string
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-graph-')))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const color = (value: string) => ({ $type: 'color', $value: value })

function project(tokens: Record<string, unknown> | null) {
  fs.writeFileSync(path.join(dir, 'dta.config.json'), '{}')
  if (tokens === null) return
  fs.mkdirSync(path.join(dir, 'tokens'))
  for (const [name, content] of Object.entries(tokens)) {
    fs.writeFileSync(path.join(dir, 'tokens', name), JSON.stringify(content))
  }
}

const clean = {
  'Base.Value.json': { Blue: color('#00f') },
  'Brand.A.json': { Primary: color('{Blue}') },
}

async function graph(...args: string[]) {
  let stdout = ''
  const opened: string[] = []
  const exitCode = await runCli(['graph', ...args], {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: () => undefined,
    openFile: (file) => opened.push(file),
  })
  // eslint-disable-next-line no-control-regex
  return { exitCode, stdout: stdout.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, ''), opened }
}

describe('dta graph', () => {
  it('prints a console report by default', async () => {
    project(clean)
    const { exitCode, stdout } = await graph()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Token Dependency Graph')
    expect(stdout).toContain('Tokens: 2 | Aliases: 1 (50%)')
    expect(stdout).toContain('Done!')
  })

  it('prints DOT without the summary line, so it can be piped', async () => {
    project(clean)
    const { stdout } = await graph('--format', 'dot')
    expect(stdout).toContain('digraph TokenDependencies {')
    expect(stdout).not.toContain('Tokens: ')
  })

  it('writes dot and markdown to --output', async () => {
    project(clean)
    const dot = await graph('--format', 'dot', '--output', 'out/g.dot')
    expect(dot.stdout).toContain('DOT file written to out/g.dot')
    expect(fs.readFileSync(path.join(dir, 'out/g.dot'), 'utf8')).toContain('digraph')
    const md = await graph('--format', 'markdown', '-o', 'g.md')
    expect(md.stdout).toContain('Markdown report written to g.md')
    expect(fs.readFileSync(path.join(dir, 'g.md'), 'utf8')).toContain(
      '# Token Dependency Graph Report',
    )
  })

  it('writes the html next to the tokens folder by default and opens it', async () => {
    project(clean)
    const { exitCode, stdout, opened } = await graph('--format', 'html')
    expect(exitCode).toBe(0)
    expect(fs.existsSync(path.join(dir, 'token-graph.html'))).toBe(true)
    expect(opened).toEqual([path.join(dir, 'token-graph.html')])
    expect(stdout).toContain('Opening visualization in browser...')
  })

  it('warns about dangling aliases and circular references', async () => {
    project({
      'Base.Value.json': { A: color('{Missing}'), B: color('{C}'), C: color('{B}') },
    })
    const { exitCode, stdout } = await graph()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('1 dangling alias(es) found')
    expect(stdout).toContain('1 circular reference(s) detected')
    expect(stdout).toContain('Dangling aliases:')
  })

  it('reports a missing tokens directory', async () => {
    project(null)
    const { exitCode, stdout } = await graph()
    expect(exitCode).toBe(1)
    expect(stdout).toContain('Tokens directory "tokens" not found.')
  })

  it('rejects an unknown format', async () => {
    project(clean)
    const { exitCode, stdout } = await graph('--format', 'svg')
    expect(exitCode).toBe(1)
    expect(stdout).toContain('Unknown format "svg"')
  })
})
