/**
 * The `@dta/*` packages the playground needs run in a browser (TICKET-076, playground spec
 * decisions 1, 9, 11). Two halves:
 *
 * 1. Always: each package's public entry point bundles with esbuild for `platform: 'browser'`.
 *    esbuild has no Node polyfills, so any `node:*` or built-in import (direct or through a
 *    dependency) fails the build. The minified sizes are the numbers in the ticket, with a budget
 *    each. The playground entry (browser-packages/engine.ts) splits: `@dta/build` and Style
 *    Dictionary land in a chunk of their own that the entry does not load.
 * 2. With a browser (DTA_E2E=1 or DTA_BROWSER_PATH, like contrast.e2e.test.ts): that bundle runs
 *    in Chromium on the brand-ab fixture. Structure, graph, resolve, lint, format detection and
 *    plugin import equal the same calls in Node; the build chunk is fetched only when outputs
 *    are asked for, and its files equal the CLI's reference snapshot of `dta build`.
 */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import zlib from 'node:zlib'
import { build, type Metafile } from 'esbuild'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runAnalysis, runOutputs, type AnalysisInput } from './browser-packages/engine'

const site = import.meta.dirname
const repo = path.join(site, '..')
const fixture = path.join(repo, 'test', 'fixtures', 'brand-ab')
const enabled = process.env.DTA_E2E === '1' || Boolean(process.env.DTA_BROWSER_PATH)

/**
 * Minified bytes of each package's whole public API, with headroom (measured in the ticket
 * outcome). zod is imported as a namespace (`import * as z`) so it tree-shakes: the named `{ z }`
 * import pulls in every locale and would put @dta/figma and @dta/lint at about 460 KB each.
 */
const BUDGET: Record<string, number> = {
  '@dta/core': 32_000,
  '@dta/figma': 160_000,
  '@dta/lint': 150_000,
  '@dta/build': 2_600_000,
}
/** The playground's first load: core, figma and lint, without @dta/build. */
const ENTRY_BUDGET = 160_000

const NODE_BUILTIN =
  /^(node:|(assert|buffer|child_process|crypto|events|fs|http|https|module|net|os|path|process|stream|url|util|vm|worker_threads|zlib)(\/|$))/

const gzip = (bytes: Uint8Array) => zlib.gzipSync(bytes).length

/** Inputs of a bundle that are Node built-ins (esbuild fails on them first; belt and braces). */
const builtinInputs = (metafile: Metafile) =>
  Object.keys(metafile.inputs).filter((input) => NODE_BUILTIN.test(input))

const tokenFiles = () => {
  const dir = path.join(fixture, 'tokens')
  return fs
    .readdirSync(dir)
    .sort()
    .map((fileName) => ({ fileName, content: fs.readFileSync(path.join(dir, fileName), 'utf8') }))
}

async function fixtureConfig() {
  const url = pathToFileURL(path.join(fixture, 'dta.config.ts')).href
  return (await import(url)).default as {
    brands: string[]
    lint: unknown
    outputs: { css: { outDir: string }; tailwind: { outDir: string } }
  }
}

async function analysisInput(): Promise<AnalysisInput> {
  const files = tokenFiles()
  const primitives = files.find((file) => file.fileName === 'Primitives.Value.json')
  return {
    files,
    lint: (await fixtureConfig()).lint,
    // brand-ab's primitives as a tokenHaus plugin export (single mode → "Mode 1").
    pluginExport: {
      $name: 'brand-ab',
      $extensions: { 'com.figma': { modes: {} } },
      Primitives: JSON.parse(primitives?.content ?? '{}'),
    },
    resolve: { name: ['Colors', 'Brand', 'Primary'], selection: { 'Brand(Alias)': 'BrandB' } },
  }
}

/** The playground entry, split: the entry chunk and the lazily loaded chunks. */
async function bundleEngine(outdir: string) {
  const result = await build({
    entryPoints: { engine: path.join(site, 'browser-packages', 'engine.ts') },
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    minify: true,
    metafile: true,
    absWorkingDir: repo,
    outdir,
    logLevel: 'silent',
  })
  const outputs = Object.entries(result.metafile.outputs).filter(([file]) => file.endsWith('.js'))
  const entry = outputs.find(([, output]) => output.entryPoint)
  if (!entry) throw new Error('no entry chunk')
  return { metafile: result.metafile, entry, chunks: outputs.filter((o) => o !== entry) }
}

describe('@dta packages in a browser bundle', () => {
  it.each(Object.keys(BUDGET))('%s bundles for the browser without Node built-ins', async (pkg) => {
    const result = await build({
      stdin: { contents: `export * from '${pkg}'`, resolveDir: site, loader: 'ts' },
      bundle: true,
      platform: 'browser',
      format: 'esm',
      minify: true,
      metafile: true,
      write: false,
      absWorkingDir: repo,
      logLevel: 'silent',
    })
    expect(builtinInputs(result.metafile)).toEqual([])
    const bytes = result.outputFiles[0].contents
    console.info(`${pkg}: ${bytes.length} B minified, ${gzip(bytes)} B gzip`)
    expect(bytes.length).toBeLessThan(BUDGET[pkg])
  })

  // TICKET-078: the graph's chunk shows a token's CSS and Tailwind names (`codeNames`, as
  // `dta token get`). @dta/build is side-effect free ("sideEffects": false), so its pure helpers
  // tree-shake into a few KB without Style Dictionary.
  it('bundles the code-name helpers of @dta/build without Style Dictionary', async () => {
    const result = await build({
      stdin: {
        contents: `export { codeNames, cssVariableName, isBuilt, tailwindThemeProperty } from '@dta/build'`,
        resolveDir: site,
        loader: 'ts',
      },
      bundle: true,
      platform: 'browser',
      format: 'esm',
      minify: true,
      metafile: true,
      write: false,
      absWorkingDir: repo,
      logLevel: 'silent',
    })
    // What ends up in the output (the metafile's inputs list every file read, shaken or not).
    const [output] = Object.values(result.metafile.outputs)
    const kept = Object.entries(output.inputs)
      .filter(([, input]) => input.bytesInOutput > 0)
      .map(([file]) => file)
    expect(kept.filter((file) => file.includes('style-dictionary'))).toEqual([])
    expect(kept.some((file) => file.includes('packages/build/src/code-names'))).toBe(true)
    const bytes = result.outputFiles[0].contents
    console.info(`@dta/build code names: ${bytes.length} B minified, ${gzip(bytes)} B gzip`)
    expect(bytes.length).toBeLessThan(12_000)
  })

  it('splits @dta/build (Style Dictionary) out of the playground entry', async () => {
    const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-browser-'))
    try {
      const { metafile, entry, chunks } = await bundleEngine(outdir)
      expect(builtinInputs(metafile)).toEqual([])
      const [entryFile, entryOutput] = entry
      const heavy = (input: string) => /style-dictionary|packages\/build\//.test(input)
      expect(Object.keys(entryOutput.inputs).filter(heavy)).toEqual([])
      // The entry imports the build chunk only dynamically.
      const lazy = chunks.filter(([, output]) => Object.keys(output.inputs).some(heavy))
      expect(lazy).toHaveLength(1)
      expect(entryOutput.imports.filter((i) => i.kind === 'import-statement')).toEqual(
        expect.not.arrayContaining([expect.objectContaining({ path: lazy[0][0] })]),
      )
      expect(entryOutput.imports).toContainEqual(
        expect.objectContaining({ path: lazy[0][0], kind: 'dynamic-import' }),
      )
      const size = (file: string) => fs.readFileSync(path.join(repo, file))
      const first = size(entryFile)
      const later = size(lazy[0][0])
      expect(first.length).toBeLessThan(ENTRY_BUDGET)
      console.info(
        `playground entry: ${first.length} B minified, ${gzip(first)} B gzip; ` +
          `@dta/build chunk: ${later.length} B minified, ${gzip(later)} B gzip`,
      )
    } finally {
      fs.rmSync(outdir, { recursive: true, force: true })
    }
  })
})

describe.skipIf(!enabled)('@dta packages running in Chromium', () => {
  let dir: string
  let server: http.Server
  let origin: string
  let lazyChunk: string
  let browser: { newContext(o?: object): Promise<any>; close(): Promise<void> }

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-browser-'))
    const { chunks } = await bundleEngine(dir)
    lazyChunk = path.basename(
      chunks.find(([, o]) => Object.keys(o.inputs).some((i) => i.includes('style-dictionary')))![0],
    )
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<!doctype html><meta charset="utf-8"><script type="module">import * as engine from "./engine.js"; window.engine = engine; window.ready = true</script>',
    )
    server = http.createServer((req, res) => {
      const file = path.join(dir, (req.url ?? '/').split('?')[0].replace(/\/$/, '/index.html'))
      if (!file.startsWith(dir) || !fs.existsSync(file)) return void res.writeHead(404).end()
      const type = file.endsWith('.html') ? 'text/html' : 'text/javascript'
      res.writeHead(200, { 'Content-Type': type })
      fs.createReadStream(file).pipe(res)
    })
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', () => done()))
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    const playwright = await import('playwright-core')
    browser = await playwright.chromium.launch({
      executablePath: process.env.DTA_BROWSER_PATH || undefined,
    })
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    server?.close()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('runs every needed API on brand-ab like Node, and loads @dta/build only for outputs', async () => {
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      const requested: string[] = []
      const errors: string[] = []
      page.on('request', (request: { url(): string }) => requested.push(request.url()))
      page.on('pageerror', (error: Error) => errors.push(error.message))
      await page.goto(`${origin}/`)
      await page.waitForFunction('window.ready === true')
      // A real browser: none of Node's globals exist.
      expect(
        await page.evaluate('[typeof process, typeof Buffer, typeof require, typeof global]'),
      ).toEqual(['undefined', 'undefined', 'undefined', 'undefined'])

      const input = await analysisInput()
      const inBrowser = await page.evaluate(
        `JSON.stringify(window.engine.runAnalysis(${JSON.stringify(input)}))`,
      )
      const inNode = JSON.stringify(runAnalysis(input))
      expect(JSON.parse(inBrowser)).toEqual(JSON.parse(inNode))
      // The calls did real work on the fixture.
      const analysis = JSON.parse(inNode)
      expect(analysis.structure.collections.length).toBe(3)
      expect(analysis.lint.violations.length).toBeGreaterThan(0)
      expect(analysis.resolved.ok).toBe(true)
      expect(analysis.formats).toEqual(input.files.map(() => 'dtcg-per-mode'))
      expect(analysis.imported.format).toBe('tokenhaus')
      expect(requested.some((url) => url.endsWith(lazyChunk))).toBe(false)

      const config = await fixtureConfig()
      const outputsInput = {
        files: input.files,
        brands: config.brands,
        css: config.outputs.css,
        tailwind: config.outputs.tailwind,
      }
      const outputs = JSON.parse(
        await page.evaluate(
          `window.engine.runOutputs(${JSON.stringify(outputsInput)}).then(JSON.stringify)`,
        ),
      )
      expect(requested.some((url) => url.endsWith(lazyChunk))).toBe(true)
      expect(outputs).toEqual(JSON.parse(JSON.stringify(await runOutputs(outputsInput))))

      // Byte for byte what `dta build` writes for brand-ab (the CLI reference snapshot).
      const snapshot = path.join(repo, 'test', 'snapshots', 'brand-ab', 'build', 'files')
      const expected = Object.fromEntries(
        fs
          .readdirSync(snapshot, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => {
            const file = path.join(entry.parentPath, entry.name)
            return [
              path.relative(snapshot, file).split(path.sep).join('/'),
              fs.readFileSync(file, 'utf8'),
            ]
          }),
      )
      const actual = Object.fromEntries(
        (outputs.files as Array<{ path: string; content: string }>).map((f) => [f.path, f.content]),
      )
      expect(actual).toEqual(expected)
      expect(errors).toEqual([])
    } finally {
      await context.close()
    }
  }, 120_000)
})
