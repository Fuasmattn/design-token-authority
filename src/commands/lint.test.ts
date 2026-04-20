import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { runLint } from './lint.js'
import type { Config } from '../config/index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOKENS_DIR = '__test_lint_tokens__'

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    figma: {},
    tokens: { dir: TOKENS_DIR },
    ...overrides,
  }
}

function writeTokenFile(name: string, content: Record<string, unknown>) {
  fs.writeFileSync(path.join(TOKENS_DIR, name), JSON.stringify(content, null, 2))
}

// Suppress clack prompts output during tests
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
  log: {
    message: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runLint', () => {
  beforeEach(() => {
    fs.mkdirSync(TOKENS_DIR, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(TOKENS_DIR, { recursive: true, force: true })
  })

  it('returns clean result for valid tokens', async () => {
    writeTokenFile('Primitives.Default.json', {
      Colors: {
        Red: { $type: 'color', $value: '#ff0000' },
        Blue: { $type: 'color', $value: '#0000ff' },
      },
    })

    const result = await runLint(makeConfig(), {})
    expect(result.errorCount).toBe(0)
    expect(result.warningCount).toBe(0)
  })

  it('reports dangling aliases as errors', async () => {
    writeTokenFile('Brand.BrandA.json', {
      Colors: {
        Primary: { $type: 'color', $value: '{Colors.NonExistent}' },
      },
    })

    const result = await runLint(makeConfig(), {})
    expect(result.errorCount).toBeGreaterThan(0)
    expect(result.violations.some((v) => v.rule === 'no-dangling-aliases')).toBe(true)
  })

  it('reports default mode names as errors', async () => {
    writeTokenFile('Collection.Mode 1.json', {
      Colors: {
        Red: { $type: 'color', $value: '#ff0000' },
      },
    })

    const result = await runLint(makeConfig(), {})
    expect(result.violations.some((v) => v.rule === 'no-default-mode-names')).toBe(true)
  })

  it('applies configurable rules from config', async () => {
    writeTokenFile('Brand.BrandA.json', {
      Colors: {
        Primary: { $type: 'color', $value: '#003f8a' },
      },
    })

    const config = makeConfig({
      lint: {
        rules: {
          'semantic-must-alias': { collections: ['Brand'] },
        },
      },
    })

    const result = await runLint(config, {})
    expect(result.violations.some((v) => v.rule === 'semantic-must-alias')).toBe(true)
  })

  it('handles empty tokens directory', async () => {
    const result = await runLint(makeConfig(), {})
    expect(result.errorCount).toBe(0)
    expect(result.warningCount).toBe(0)
  })
})
