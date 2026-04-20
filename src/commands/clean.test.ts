import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { runClean } from './clean.js'
import { Config } from '../config/index.js'

const TOKENS_DIR = '__test_clean_tokens__'
const OUTPUT_DIR = '__test_clean_output__'

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    figma: {},
    tokens: { dir: TOKENS_DIR },
    outputs: {
      css: { outDir: `${OUTPUT_DIR}/css` },
      tailwind: { outDir: `${OUTPUT_DIR}/tailwind` },
    },
    ...overrides,
  }
}

beforeEach(() => {
  fs.mkdirSync(TOKENS_DIR, { recursive: true })
  fs.mkdirSync(`${OUTPUT_DIR}/css`, { recursive: true })
  fs.mkdirSync(`${OUTPUT_DIR}/tailwind`, { recursive: true })
  fs.writeFileSync(path.join(TOKENS_DIR, 'Primitives.Global.json'), '{}')
  fs.writeFileSync(path.join(TOKENS_DIR, 'Brand.BrandB.json'), '{}')
  fs.writeFileSync(`${OUTPUT_DIR}/css/variables.css`, ':root {}')
  fs.writeFileSync(`${OUTPUT_DIR}/tailwind/tailwind.css`, '@theme {}')
})

afterEach(() => {
  fs.rmSync(TOKENS_DIR, { recursive: true, force: true })
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
})

describe('runClean', () => {
  it('removes token JSON files from tokens dir', async () => {
    await runClean(makeConfig(), {})
    expect(fs.existsSync(TOKENS_DIR)).toBe(true)
    const remaining = fs.readdirSync(TOKENS_DIR)
    expect(remaining).toEqual([])
  })

  it('removes output directories', async () => {
    await runClean(makeConfig(), {})
    expect(fs.existsSync(OUTPUT_DIR)).toBe(false)
  })

  it('handles missing directories gracefully', async () => {
    fs.rmSync(TOKENS_DIR, { recursive: true, force: true })
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
    await expect(runClean(makeConfig(), {})).resolves.not.toThrow()
  })
})
