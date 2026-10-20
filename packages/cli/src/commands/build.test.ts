import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from '../index.js'

let dir: string
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-build-')))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const color = (value: string) => ({ $type: 'color', $value: value })

function project(tokens: Record<string, unknown> | null, config: unknown = {}) {
  fs.writeFileSync(path.join(dir, 'dta.config.json'), JSON.stringify(config))
  if (tokens === null) return
  fs.mkdirSync(path.join(dir, 'tokens'))
  for (const [name, content] of Object.entries(tokens)) {
    fs.writeFileSync(path.join(dir, 'tokens', name), JSON.stringify(content))
  }
}

async function build(...args: string[]) {
  let stdout = ''
  const exitCode = await runCli(['build', ...args], {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: () => undefined,
  })
  // eslint-disable-next-line no-control-regex
  return { exitCode, stdout: stdout.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '') }
}

const exists = (file: string) => fs.existsSync(path.join(dir, file))
const tokens = {
  'Base.Value.json': { Blue: color('#0000ff') },
  'Brand.A.json': { Primary: color('{Blue}') },
  'Brand.B.json': { Primary: color('#ff0000') },
}

describe('dta build', () => {
  it('writes css, js and tailwind and lists them in build order', async () => {
    project(tokens, { brands: ['A', 'B'] })
    const { exitCode, stdout } = await build()
    expect(exitCode).toBe(0)
    for (const file of [
      'output/css/base.css',
      'output/css/themes/a.css',
      'output/css/themes/b.css',
      'output/css/variables.css',
      'output/js/colorpalette.js',
      'output/tailwind/a/tailwind.css',
      'output/tailwind/tailwind.tokens.ts',
    ]) {
      expect(exists(file), file).toBe(true)
    }
    const listed = [...stdout.matchAll(/^[|│]\s+(output\/\S+)/gm)].map((match) => match[1])
    expect(listed[0]).toBe('output/css/base.css')
    expect(listed.indexOf('output/css/themes/a.css')).toBeLessThan(
      listed.indexOf('output/css/themes/b.css'),
    )
    expect(listed.at(-1)).toBe('output/tailwind/tailwind.css')
    expect(exists('output/docs')).toBe(false)
    expect(stdout).not.toContain('docs')
    expect(stdout).toContain('Build complete!')
  })

  it('reports the path of the JS palette that is actually written', async () => {
    project(tokens)
    const { stdout } = await build()
    expect(stdout).toContain('output/js/colorpalette.js')
    expect(stdout).not.toContain('build/js/colorpalette.js')
  })

  it('uses the configured output directories', async () => {
    project(tokens, {
      outputs: {
        css: { outDir: 'dist/css' },
        tailwind: { outDir: 'dist/tw' },
      },
    })
    const { exitCode } = await build()
    expect(exitCode).toBe(0)
    expect(exists('dist/css/base.css')).toBe(true)
    expect(exists('dist/tw/tailwind.css')).toBe(true)
    expect(exists('output/css')).toBe(false)
    // The JS directory is not configurable (v1 quirk, kept).
    expect(exists('output/js/colorpalette.js')).toBe(true)
  })

  it('reports a missing tokens directory without writing anything', async () => {
    project(null)
    const { exitCode, stdout } = await build()
    expect(exitCode).toBe(1)
    expect(stdout).toContain('Tokens directory "tokens" not found.')
    expect(exists('output')).toBe(false)
  })

  it('stops on broken token files', async () => {
    project(tokens)
    fs.writeFileSync(path.join(dir, 'tokens', 'Broken.Value.json'), '{ nope')
    const { exitCode, stdout } = await build()
    expect(exitCode).toBe(1)
    expect(stdout).toContain('Build failed.')
    expect(exists('output')).toBe(false)
  })

  it('fails on a dangling or circular alias, worded as dta lint, and writes nothing', async () => {
    project(
      {
        'Base.Value.json': { Blue: color('#0000ff') },
        'Brand.A.json': { Primary: color('{Blue}'), Ping: color('{Pong}'), Pong: color('{Ping}') },
        'Brand.B.json': { Primary: color('{Red}'), Ping: color('#000000'), Pong: color('#ffffff') },
      },
      { brands: ['A', 'B'], context: { out: 'DESIGN.md' } },
    )
    const { exitCode, stdout } = await build()
    expect(exitCode).toBe(1)
    expect(stdout).toContain(
      'error [dangling-alias] Alias {Red} references non-existent token "Red". See site/src/content/docs/reference/lint-rules.mdx. (Brand.B.json)',
    )
    expect(stdout).toContain(
      'error [circular-alias] Circular alias chain: Brand.A/Ping → Brand.A/Pong → Brand.A/Ping.',
    )
    expect(stdout).toContain('Nothing was written: fix the errors above and build again.')
    expect(stdout).toContain('Build failed.')
    expect(exists('output')).toBe(false)
    expect(exists('DESIGN.md')).toBe(false)
  })

  it('leaves the files of an earlier build as they were when a build fails', async () => {
    project(tokens, { brands: ['A', 'B'] })
    expect((await build()).exitCode).toBe(0)
    const before = fs.readFileSync(path.join(dir, 'output/css/themes/b.css'), 'utf-8')
    fs.writeFileSync(
      path.join(dir, 'tokens', 'Brand.B.json'),
      JSON.stringify({ Primary: color('{Nowhere}') }),
    )
    expect((await build()).exitCode).toBe(1)
    expect(fs.readFileSync(path.join(dir, 'output/css/themes/b.css'), 'utf-8')).toBe(before)
  })

  it('warns about a brand that does not exist and still builds', async () => {
    project(tokens, { brands: ['A', 'Nope'] })
    const { exitCode, stdout } = await build()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('unknown-brand')
  })

  it('shows the settings with --verbose', async () => {
    project(tokens, { brands: ['A'] })
    const { stdout } = await build('--verbose')
    expect(stdout).toContain('Source: tokens')
    expect(stdout).toContain('Outputs: css, tailwind-v4, tailwind-v3, js')
    expect(stdout).toContain('Brands: A')
  })

  it('writes only the outputs listed in outputs.formats and lists only those', async () => {
    project(tokens, { brands: ['A'], outputs: { formats: ['tailwind-v3', 'js'] } })
    const { exitCode, stdout } = await build('--verbose')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Outputs: tailwind-v3, js')
    for (const file of [
      'output/js/colorpalette.js',
      'output/tailwind/tailwind.tokens.ts',
      'output/tailwind/a/tailwind.tokens.ts',
    ]) {
      expect(exists(file), file).toBe(true)
    }
    for (const file of [
      'output/css',
      'output/tailwind/tailwind.css',
      'output/tailwind/a/tailwind.css',
    ]) {
      expect(exists(file), file).toBe(false)
    }
    const listed = [...stdout.matchAll(/^[|│]\s+(output\/\S+)/gm)].map((match) => match[1])
    expect(listed.sort()).toEqual([
      'output/js/colorpalette.js',
      'output/tailwind/a/tailwind.tokens.ts',
      'output/tailwind/tailwind.tokens.ts',
    ])
    expect(stdout).toContain('Build complete!')
  })

  it('rejects an unknown or empty outputs.formats', async () => {
    project(tokens, { outputs: { formats: ['scss'] } })
    expect((await build()).exitCode).not.toBe(0)
    project(null, { outputs: { formats: [] } }) // the token files from above stay
    expect((await build()).exitCode).not.toBe(0)
    expect(exists('output')).toBe(false)
  })
})
