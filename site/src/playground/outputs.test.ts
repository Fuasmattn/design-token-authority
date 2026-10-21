/**
 * The playground's outputs equal what `dta build` writes (TICKET-079): for the fixtures, the
 * files the playground builds (outputs-engine.ts on the model analyse.ts reads) are compared byte
 * for byte with the files the real CLI writes in a project made of the same token files and the
 * `dta.config.ts` the playground generates, loaded by the CLI's own config loader. The brand-ab
 * build also equals the CLI reference snapshot. The zip has the CLI's folder layout.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { OutputFormat } from '@dta/build'
import { formatDiagnostic } from '@dta/core'
import { loadConfig, runCli } from '@dta/cli'
import { unzipSync, strFromU8 } from 'fflate'
import { afterEach, describe, expect, it } from 'vitest'
import { analyse } from './analyse'
import { buildFiles, zipFiles } from './outputs-engine'
import {
  ALL_FORMATS,
  cliSteps,
  CLI,
  CONFIG_FILE,
  formatSize,
  generateConfig,
  groupOutputs,
  OUTPUT_CHOICES,
  outputFileGroups,
  outputLabel,
} from './outputs'

const repo = path.join(import.meta.dirname, '..', '..', '..')
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tokenFiles = (fixture: string) => {
  const dir = path.join(repo, 'test', 'fixtures', fixture, 'tokens')
  return fs
    .readdirSync(dir)
    .sort()
    .map((fileName) => ({ fileName, content: fs.readFileSync(path.join(dir, fileName), 'utf8') }))
}

/** Every file below `dir`, as `{ path: content }` with forward slashes. */
function tree(dir: string, base = dir): Record<string, string> {
  if (!fs.existsSync(dir)) return {}
  return Object.fromEntries(
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return Object.entries(tree(full, base))
      return [[path.relative(base, full).split(path.sep).join('/'), fs.readFileSync(full, 'utf8')]]
    }),
  )
}

/** A project folder with the generated config (and token files): what the visitor sets up. */
function project(config: string, files: ReadonlyArray<{ fileName: string; content: string }>) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-playground-')))
  dirs.push(dir)
  fs.writeFileSync(path.join(dir, CONFIG_FILE), config)
  fs.mkdirSync(path.join(dir, 'tokens'))
  for (const file of files) fs.writeFileSync(path.join(dir, 'tokens', file.fileName), file.content)
  return dir
}

async function cli(cwd: string, ...args: string[]) {
  let out = ''
  const code = await runCli(args, {
    cwd,
    stdout: (text) => void (out += text),
    stderr: (text) => void (out += text),
  })
  return { code, out }
}

/** What the playground shows for these token files and outputs. */
async function playground(
  files: ReadonlyArray<{ fileName: string; content: string }>,
  formats: readonly OutputFormat[],
) {
  const result = analyse(files)
  if (!result.model || !result.structure) throw new Error('the input does not read')
  const brands = result.structure.brands
  const built = await buildFiles(result.model, { brands, formats })
  return { brands, built, config: generateConfig({ brands, formats }) }
}

describe('playground outputs = dta build', () => {
  it.each([
    ['brand-ab', ALL_FORMATS],
    ['brand-ab', ['tailwind-v3', 'js'] as OutputFormat[]],
    ['brand-ab', ['css'] as OutputFormat[]],
    ['daisyui', ALL_FORMATS],
  ] as const)(
    '%s with %j: the same files, byte for byte, as the CLI with the generated config',
    async (fixture, formats) => {
      const files = tokenFiles(fixture)
      const { built, config } = await playground(files, formats)
      expect(built.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
      const cwd = project(config, files)

      // The real loader reads the generated config and keeps the choices
      const { config: loaded } = await loadConfig({ cwd })
      expect(loaded.outputs?.formats).toEqual([...formats])

      const { code, out } = await cli(cwd, 'build')
      expect(code, out).toBe(0)
      const written = tree(path.join(cwd, 'output'), cwd)
      expect(Object.keys(written).sort()).toEqual(built.files.map((file) => file.path))
      for (const file of built.files) expect(written[file.path], file.path).toBe(file.content)
    },
    60_000,
  )

  it('equals the reference snapshot of `dta build` on brand-ab (its brands are the ones found)', async () => {
    const { brands, built } = await playground(tokenFiles('brand-ab'), ALL_FORMATS)
    expect(brands).toEqual(['BrandA', 'BrandB'])
    const snapshot = tree(path.join(repo, 'test', 'snapshots', 'brand-ab', 'build', 'files'))
    const files = Object.fromEntries(built.files.map((file) => [file.path, file.content]))
    // The fixture's config also has `breakpoints` (TICKET-091), which the playground does not
    // write (it cannot know the media queries): the snapshot's only extra is the ScreenType
    // blocks appended to variables.css and tailwind.css.
    const extra = ['output/css/variables.css', 'output/tailwind/tailwind.css']
    for (const file of extra) {
      expect(snapshot[file].startsWith(files[file]), file).toBe(true)
      expect(snapshot[file].slice(files[file].length), file).toMatch(/^\n\/\* ScreenType[ :·]/)
    }
    expect(Object.keys(files).sort()).toEqual(Object.keys(snapshot).sort())
    for (const [file, content] of Object.entries(files)) {
      if (!extra.includes(file)) expect(content, file).toBe(snapshot[file])
    }
  })

  it('shows for the example with problems the errors `dta build` prints, and the CLI writes nothing', async () => {
    const files = tokenFiles('brand-ab-problems')
    const { built, config } = await playground(files, ALL_FORMATS)
    const errors = built.diagnostics.filter((d) => d.severity === 'error')
    expect(errors.map((d) => d.code)).toEqual(['dangling-alias', 'circular-alias'])
    expect(built.diagnostics).toEqual(errors)

    const cwd = project(config, files)
    const { code, out } = await cli(cwd, 'build')
    expect(code, out).toBe(1)
    for (const error of errors) expect(out).toContain(formatDiagnostic(error))
    expect(fs.existsSync(path.join(cwd, 'output'))).toBe(false)
  }, 60_000)

  it('gives the same files for a plugin export as `dta pull --from-file` and `dta build`', async () => {
    const primitives = tokenFiles('brand-ab').find((f) => f.fileName === 'Primitives.Value.json')
    const exported = JSON.stringify({
      $extensions: { 'com.figma': { modes: {} } },
      Primitives: JSON.parse(primitives?.content ?? '{}'),
    })
    const { built, config } = await playground(
      [{ fileName: 'export.json', content: exported }],
      ALL_FORMATS,
    )
    const cwd = project(config, [])
    fs.writeFileSync(path.join(cwd, 'export.json'), exported)
    const [pull, build] = cliSteps({ pluginExport: 'export.json' })
      .flatMap((step) => (step.command ? [step.command] : []))
      .map((command) => command.slice(CLI.length + 1).split(' '))
    expect((await cli(cwd, ...pull)).code).toBe(0)
    expect((await cli(cwd, ...build)).code).toBe(0)
    const written = tree(path.join(cwd, 'output'), cwd)
    expect(Object.keys(written).sort()).toEqual(built.files.map((file) => file.path))
    for (const file of built.files) expect(written[file.path], file.path).toBe(file.content)
  }, 60_000)
})

describe('generateConfig', () => {
  it('writes a plain object before the npm release, which any project can load', async () => {
    const config = generateConfig({ brands: ['BrandA', "O'Brand"], formats: ['css', 'js'] })
    expect(config).not.toContain('import')
    expect(config).toContain(`run: ${CLI} build`)
    const { config: loaded } = await loadConfig({ cwd: project(config, []) })
    expect(loaded.brands).toEqual(['BrandA', "O'Brand"])
    expect(loaded.outputs?.formats).toEqual(['css', 'js'])
    expect(loaded.figma.source).toBe('file')
    expect(loaded.tokens.dir).toBe('tokens')
  })

  it('writes no removed keys and no breakpoints (the playground cannot know the media queries)', () => {
    const config = generateConfig({ brands: ['BrandA'], formats: [...ALL_FORMATS] })
    for (const key of ['version', 'prefix', 'breakpoints']) expect(config).not.toContain(key)
  })

  it('leaves out brands when none were found', () => {
    expect(generateConfig({ brands: [], formats: ['js'] })).not.toContain('brands')
  })

  it('uses defineConfig from the package once it is released', async () => {
    const config = generateConfig({ brands: [], formats: ALL_FORMATS, defineConfig: true })
    expect(config).toContain("import { defineConfig } from 'design-token-authority'")
    const cwd = project(config, [])
    const pkg = path.join(cwd, 'node_modules', 'design-token-authority')
    fs.mkdirSync(pkg, { recursive: true })
    fs.writeFileSync(
      path.join(pkg, 'package.json'),
      JSON.stringify({ name: 'design-token-authority', type: 'module', main: 'index.js' }),
    )
    fs.writeFileSync(path.join(pkg, 'index.js'), 'export const defineConfig = (config) => config\n')
    const { config: loaded } = await loadConfig({ cwd })
    expect(loaded.outputs?.formats).toEqual([...ALL_FORMATS])
  })

  it('never shows `npx dta` (that npm name belongs to another package)', () => {
    for (const step of [...cliSteps({}), ...cliSteps({ pluginExport: 'x.json' })]) {
      expect(step.command ?? '').not.toMatch(/npx dta\b/)
    }
  })
})

describe('grouping, sizes and the zip', () => {
  it('offers the outputs the build knows, in its order', async () => {
    const { OUTPUT_FORMATS } = await import('@dta/build')
    expect(OUTPUT_CHOICES.map((choice) => choice.format)).toEqual([...OUTPUT_FORMATS])
  })

  it('groups the files into CSS, Tailwind and JS in path order', async () => {
    const { built } = await playground(tokenFiles('brand-ab'), ALL_FORMATS)
    const groups = groupOutputs(built.files)
    expect(groups.map((group) => [group.name, group.files.length])).toEqual([
      ['CSS', 4],
      ['Tailwind', 6],
      ['JS', 1],
    ])
    expect(groups[0].files.map((file) => file.path)).toEqual([
      'output/css/base.css',
      'output/css/themes/branda.css',
      'output/css/themes/brandb.css',
      'output/css/variables.css',
    ])
    expect(groupOutputs(built.files.filter((f) => !f.path.includes('/js/'))).length).toBe(2)
  })

  it('labels Tailwind v4 and v3 files in the Tailwind group, and nothing in CSS or JS', async () => {
    const { built } = await playground(tokenFiles('brand-ab'), ALL_FORMATS)
    const shown = outputFileGroups(groupOutputs(built.files))
    const tags = (id: string) =>
      Object.fromEntries(
        shown.find((group) => group.id === id)?.files.map((f) => [f.path, f.tag]) ?? [],
      )
    expect(tags('tailwind')).toEqual({
      'output/tailwind/branda/tailwind.css': 'Tailwind v4',
      'output/tailwind/branda/tailwind.tokens.ts': 'Tailwind v3',
      'output/tailwind/brandb/tailwind.css': 'Tailwind v4',
      'output/tailwind/brandb/tailwind.tokens.ts': 'Tailwind v3',
      'output/tailwind/tailwind.css': 'Tailwind v4',
      'output/tailwind/tailwind.tokens.ts': 'Tailwind v3',
    })
    expect(Object.values(tags('css')).every((tag) => tag === undefined)).toBe(true)
    expect(Object.values(tags('js')).every((tag) => tag === undefined)).toBe(true)
    // Only one Tailwind version chosen: the group is one output, so no labels
    const { built: v3 } = await playground(tokenFiles('brand-ab'), ['tailwind-v3'])
    const [only] = groupOutputs(v3.files)
    expect(only.files.map((file) => outputLabel(only, file))).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    expect(shown.find((group) => group.id === 'css')?.downloadLabel).toBe('Download CSS (.zip)')
  })

  it('formats sizes in bytes and KB', () => {
    expect(formatSize(746)).toBe('746 B')
    expect(formatSize(1024)).toBe('1.0 KB')
    expect(formatSize(1536)).toBe('1.5 KB')
  })

  it('zips the files at the paths dta build writes, plus the config at the root', async () => {
    const files = tokenFiles('brand-ab')
    const { built, config } = await playground(files, ALL_FORMATS)
    const zipped = unzipSync(zipFiles([...built.files, { path: CONFIG_FILE, content: config }]))
    const cwd = project(config, files)
    expect((await cli(cwd, 'build')).code).toBe(0)
    const expected: Record<string, string> = {
      ...tree(path.join(cwd, 'output'), cwd),
      [CONFIG_FILE]: config,
    }
    expect(Object.keys(zipped).sort()).toEqual(Object.keys(expected).sort())
    for (const [name, bytes] of Object.entries(zipped)) {
      expect(strFromU8(bytes), name).toBe(expected[name])
    }
  }, 60_000)
})
