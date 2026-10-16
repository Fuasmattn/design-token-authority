/**
 * The config JSON Schema (published on the website for `$schema` and turned into the config
 * reference) agrees with the Zod schema the CLI validates with.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { commandReference, configJsonSchema, loadConfig, COMMAND_NAMES } from './index.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const validate = new Ajv2020({ strict: false }).compile(configJsonSchema())

/** Every config in the repository: the fixtures, the website and the Learn examples. */
const configDirs = [
  'test/fixtures/brand-ab',
  'test/fixtures/daisyui',
  'site',
  ...fs
    .readdirSync(path.join(repoRoot, 'site', 'learn-examples'))
    .map((name) => `site/learn-examples/${name}`),
]

describe('configJsonSchema', () => {
  it('is a draft 2020-12 schema that rejects unknown top-level keys', () => {
    const schema = configJsonSchema()
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.additionalProperties).toBe(false)
  })

  it.each(configDirs)('accepts the config in %s, as the CLI does', async (dir) => {
    const cwd = path.join(repoRoot, dir)
    await expect(loadConfig({ cwd })).resolves.toBeTruthy()
    const raw = (await import(path.join(cwd, 'dta.config.ts'))) as { default: unknown }
    expect(validate(raw.default), JSON.stringify(validate.errors)).toBe(true)
  })

  it('accepts a minimal config, a $schema key and diff stories without a type', () => {
    expect(validate({})).toBe(true)
    expect(validate({ $schema: 'https://example.com/dta.config.schema.json' })).toBe(true)
    expect(validate({ diff: { outDir: 'dist' } })).toBe(true)
    expect(validate({ diff: { outDir: 'dist', stories: { manifest: 'm.json' } } })).toBe(true)
    expect(validate({ diff: { outDir: 'dist', stories: { type: 'storybook' } } })).toBe(true)
  })

  it('lets a dta.config.json point $schema at the published schema', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-schema-'))
    try {
      const config = {
        $schema: 'https://example.com/schemas/dta.config.schema.json',
        brands: ['A'],
      }
      fs.writeFileSync(path.join(cwd, 'dta.config.json'), JSON.stringify(config))
      expect((await loadConfig({ cwd })).config.brands).toEqual(['A'])
      expect(validate(config)).toBe(true)
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('rejects unknown keys, outputs.docs and wrong types', () => {
    expect(validate({ token: { dir: 'tokens' } })).toBe(false)
    expect(validate({ outputs: { docs: { outDir: 'docs' } } })).toBe(false)
    expect(validate({ outputs: { css: {} } })).toBe(false)
    expect(validate({ brands: 'BrandA' })).toBe(false)
    expect(validate({ diff: { outDir: 'dist', stories: { type: 'ladle' } } })).toBe(false)
    expect(validate({ lint: { rules: { 'no-such-rule': {} } } })).toBe(false)
  })

  it('describes every property, so the generated reference has no empty rows', () => {
    const missing: string[] = []
    const walk = (node: unknown, at: string) => {
      if (typeof node !== 'object' || node === null) return
      const schema = node as Record<string, unknown>
      for (const [key, child] of Object.entries(
        (schema.properties ?? {}) as Record<string, Record<string, unknown>>,
      )) {
        const where = at ? `${at}.${key}` : key
        if (typeof child.description !== 'string' && !['type', 'severity'].includes(key)) {
          missing.push(where)
        }
        walk(child, where)
      }
      for (const list of ['anyOf', 'oneOf'] as const) {
        for (const option of (schema[list] ?? []) as unknown[]) walk(option, at)
      }
    }
    walk(configJsonSchema(), '')
    expect(missing).toEqual([])
  })
})

describe('commandReference', () => {
  it('lists every registered command with its options', () => {
    const reference = commandReference()
    expect(reference.map((command) => command.name)).toEqual([...COMMAND_NAMES])
    for (const command of reference) {
      expect(command.description).not.toBe('')
      for (const option of command.options) expect(option.flags).toMatch(/^-/)
    }
  })
})
