import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { runCli, tokenJsonSchema } from '../index.js'
import { fixtureTokens } from './test-support.js'

let dir: string
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-token-')))
  fs.writeFileSync(
    path.join(dir, 'dta.config.json'),
    JSON.stringify({ tokens: { dir: 'tokens' }, brands: ['BrandA', 'BrandB'] }),
  )
  fs.mkdirSync(path.join(dir, 'tokens'))
  for (const [name, content] of Object.entries(fixtureTokens())) {
    fs.writeFileSync(path.join(dir, 'tokens', name), content)
  }
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

async function token(...args: string[]) {
  let stdout = ''
  let stderr = ''
  const exitCode = await runCli(['token', ...args], {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  })
  return { exitCode, stdout, stderr }
}

describe('dta token get', () => {
  it('shows the value and alias chain per brand and the names in code', async () => {
    const { exitCode, stdout } = await token('get', 'Colors.Brand.Primary')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Colors.Brand.Primary  color · Brand(Alias)')
    expect(stdout).toMatch(
      /BrandA\s+#0057b8\s+Colors\.Brand\.Primary → Colors\.Foundation\.Blue\.500/,
    )
    expect(stdout).toMatch(/BrandB\s+#3d5a80/)
    expect(stdout).toContain('var(--colors-brand-primary)')
    expect(stdout).toContain('Tailwind  --color-brand-primary')
  })

  it('gives no code names for a token the build does not write', async () => {
    const { exitCode, stdout } = await token('get', 'Spacing.Gap', '-f', 'json')
    expect(exitCode).toBe(0)
    expect(JSON.parse(stdout).code).toBeUndefined()
    const text = (await token('get', 'Spacing.Gap')).stdout
    expect(text).toContain('Not in the build output')
  })

  it('reads in the selected modes only, with loose collection names', async () => {
    const { exitCode, stdout } = await token(
      'get',
      'Colors.Brand.Primary',
      '--mode',
      'brand=BrandB',
    )
    expect(exitCode).toBe(0)
    expect(stdout).toContain('BrandB')
    expect(stdout).not.toContain('BrandA')
  })

  it('prints JSON with the schema version', async () => {
    const { exitCode, stdout } = await token('get', 'Colors.Brand.Primary', '-f', 'json')
    expect(exitCode).toBe(0)
    const result = JSON.parse(stdout)
    expect(result).toMatchObject({
      schema: 'dta.token/1',
      kind: 'token',
      name: 'Colors.Brand.Primary',
      code: { css: '--colors-brand-primary', tailwind: '--color-brand-primary' },
    })
    expect(result.readings).toHaveLength(2)
  })

  it('suggests close names for an unknown token and exits 1', async () => {
    const { exitCode, stderr } = await token('get', 'Colors.Brand.Primay')
    expect(exitCode).toBe(1)
    expect(stderr).toContain('No token "Colors.Brand.Primay"')
    expect(stderr).toContain('  Colors.Brand.Primary\n')
  })

  it('exits 2 for an unknown collection or mode', async () => {
    expect((await token('get', 'Colors.Brand.Primary', '--mode', 'Nope=X')).exitCode).toBe(2)
    const mode = await token('get', 'Colors.Brand.Primary', '--mode', 'Brand(Alias)=BrandC')
    expect(mode.exitCode).toBe(2)
    expect(mode.stderr).toContain('Modes: BrandA, BrandB')
  })
})

describe('dta token find', () => {
  it('lists semantic tokens before the primitive', async () => {
    const { exitCode, stdout } = await token('find', '#003F8A')
    expect(exitCode).toBe(0)
    const semantic = stdout.indexOf('Colors.Brand.Primary Dark')
    const primitive = stdout.indexOf('Colors.Foundation.Blue.700')
    expect(semantic).toBeGreaterThan(-1)
    expect(primitive).toBeGreaterThan(semantic)
  })

  it('matches numbers with or without px and filters by type', async () => {
    const { stdout } = await token('find', '16px', '--type', 'number')
    expect(stdout).toContain('Dimensions.spacing.4')
  })

  it('exits 1 without matches and hints at --near', async () => {
    const { exitCode, stderr } = await token('find', '#003f8b')
    expect(exitCode).toBe(1)
    expect(stderr).toContain('Try --near')
    expect((await token('find', '#003f8b', '--near')).exitCode).toBe(0)
  })

  it('exits 2 for an unknown type', async () => {
    expect((await token('find', '#fff', '--type', 'colour')).exitCode).toBe(2)
  })
})

describe('dta token list', () => {
  it('lists tokens matching a glob', async () => {
    const { exitCode, stdout } = await token('list', '--match', 'Colors.Text.*')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Colors.Text.On Primary')
    expect(stdout).toContain('3 tokens.')
  })

  it('prints JSON', async () => {
    const { stdout } = await token('list', '--collection', 'Primitives', '-f', 'json')
    const result = JSON.parse(stdout)
    expect(result.kind).toBe('list')
    expect(result.tokens.every((t: { collection: string }) => t.collection === 'Primitives')).toBe(
      true,
    )
  })

  it('exits 2 for an unknown collection', async () => {
    expect((await token('list', '--collection', 'Nope')).exitCode).toBe(2)
  })
})

describe('--format json', () => {
  const validate = new Ajv2020({ strict: false }).compile(tokenJsonSchema())
  it.each([
    [['get', 'Colors.Brand.Primary']],
    [['get', 'Colors.Brand.Primay']],
    [['find', '#003f8a']],
    [['find', '16']],
    [['list']],
  ])('matches the published schema: %j', async (args) => {
    const { stdout } = await token(...args, '--format', 'json')
    const ok = validate(JSON.parse(stdout))
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })
})
