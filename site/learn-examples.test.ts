/**
 * The example token sets of the Learn pages (`learn-examples/*`) are real projects: the CLI
 * lints them clean and builds them, and the output the pages describe is what the build writes.
 * Every example is shown on at least one Learn page.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const siteDir = import.meta.dirname
const examplesDir = path.join(siteDir, 'learn-examples')
const learnDir = path.join(siteDir, 'src', 'content', 'docs', 'learn')
const bin = path.join(siteDir, '..', 'bin', 'dta.js')

const examples = fs
  .readdirSync(examplesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-learn-'))
afterAll(() => fs.rmSync(workDir, { recursive: true, force: true }))

/** Copies an example (config and tokens only) to a temp folder and runs a CLI command there. */
function run(example: string, ...args: string[]) {
  const cwd = path.join(workDir, `${example}-${args[0]}`)
  fs.mkdirSync(cwd, { recursive: true })
  fs.copyFileSync(path.join(examplesDir, example, 'dta.config.ts'), path.join(cwd, 'dta.config.ts'))
  fs.cpSync(path.join(examplesDir, example, 'tokens'), path.join(cwd, 'tokens'), {
    recursive: true,
  })
  const out = execFileSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  const read = (file: string) => fs.readFileSync(path.join(cwd, file), 'utf-8')
  const exists = (file: string) => fs.existsSync(path.join(cwd, file))
  return { out, read, exists }
}

function learnPages(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return learnPages(full)
    return entry.name.endsWith('.mdx') ? [fs.readFileSync(full, 'utf-8')] : []
  })
}

describe('Learn example token sets', () => {
  it('are the six sets the pages use', () => {
    expect(examples).toEqual([
      'component-overrides',
      'dtcg-basics',
      'multi-brand',
      'responsive',
      'themes',
      'tiers',
    ])
  })

  it.each(examples)('%s is linked from a Learn page', (example) => {
    expect(learnPages(learnDir).some((page) => page.includes(`learn-examples/${example}/`))).toBe(
      true,
    )
  })

  it.each(examples)('%s lints clean', (example) => {
    expect(run(example, 'lint').out).toContain('No lint violations found.')
  })

  it('dtcg-basics: all four types build, aliases stay references, lengths get px', () => {
    const { read } = run('dtcg-basics', 'build')
    const css = read('output/css/variables.css')
    expect(css).toContain('--color-blue-500: #2f6bd8; /** Links and primary actions */')
    expect(css).toContain('--color-link: var(--color-blue-500);')
    expect(css).toContain('--space-4: 4px;')
    expect(css).toContain('--font-body: Instrument Sans, sans-serif;')
    expect(css).toContain('--motion-enabled: true;')
  })

  it('tiers: component tokens alias semantic tokens, which alias primitives', () => {
    const css = run('tiers', 'build').read('output/css/variables.css')
    expect(css).toContain('--radius-4: 4px;')
    expect(css).toContain('--action-background: var(--color-blue-600);')
    expect(css).toContain('--button-background: var(--action-background);')
    expect(css).toContain('--button-radius: var(--shape-control);')
  })

  it('multi-brand: one theme file per brand, primitives once', () => {
    const { read, exists } = run('multi-brand', 'build')
    expect(read('output/css/variables.css')).not.toContain('--action-background')
    expect(read('output/css/themes/branda.css')).toContain(
      '[data-brand="branda"] {\n  --action-background: var(--color-blue-600);',
    )
    const brandb = read('output/css/themes/brandb.css')
    expect(brandb).toContain('--shape-control: var(--radius-999);')
    expect(brandb).toContain('--type-heading: var(--font-serif);')
    expect(exists('output/css/themes/brandc.css')).toBe(false)
  })

  it('themes: light and dark are modes, built like brands', () => {
    const { read } = run('themes', 'build')
    expect(read('output/css/themes/light.css')).toContain(
      '--surface-default: var(--color-neutral-0);',
    )
    expect(read('output/css/themes/dark.css')).toContain(
      '[data-brand="dark"] {\n  --surface-default: var(--color-neutral-950);',
    )
  })

  it('responsive: breakpoint modes are read and linted, but not built yet (TICKET-091)', () => {
    const { read, exists } = run('responsive', 'build')
    expect(read('output/css/variables.css')).toContain('--size-48: 48px;')
    expect(read('output/css/variables.css')).not.toContain('--layout-gutter')
    expect(exists('output/css/themes')).toBe(false)
  })

  it('component-overrides: BrandB overrides one component token, the rest follows the brand', () => {
    const { read } = run('component-overrides', 'build')
    const brandb = read('output/css/themes/brandb.css')
    expect(brandb).toContain('--shape-control: var(--radius-999);')
    expect(brandb).toContain('--button-radius: var(--radius-4);')
    expect(brandb).toContain('--button-background: var(--action-background);')
    expect(read('output/css/themes/branda.css')).toContain('--button-radius: var(--shape-control);')
  })
})
