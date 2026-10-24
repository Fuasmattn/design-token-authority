/**
 * Builds the Orbit Burger example (examples/orbit-burger) with DTA, both states, into one scoped
 * stylesheet the landing page's examples use:
 *
 *   output/css/examples/orbit-burger.css
 *     :root { …primitives… }                                    (once; both states share them)
 *     [data-example="orbit-burger"][data-state="main"] { … }     (tokens-base/)
 *     [data-example="orbit-burger"][data-state="change"] { … }   (tokens/)
 *
 * `dta build` writes one theme per brand mode under [data-brand="…"]; the example has one brand
 * and two token sets, so the selector is rewritten per state. Runs with `pnpm tokens`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildOutputs, cssVariableName } from '@dta/build'
import { parseTokenFiles } from '@dta/core'

const siteDir = path.resolve(import.meta.dirname, '..')
const exampleDir = path.join(siteDir, 'examples', 'orbit-burger')
const STATES: Array<[state: string, dir: string]> = [
  ['main', 'tokens-base'],
  ['change', 'tokens'],
]

async function buildState(dir: string) {
  const tokensDir = path.join(exampleDir, dir)
  const files = fs
    .readdirSync(tokensDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((fileName) => ({
      fileName,
      content: fs.readFileSync(path.join(tokensDir, fileName), 'utf8'),
    }))
  const { model, diagnostics } = parseTokenFiles(files)
  if (diagnostics.length) throw new Error(`${dir}: ${diagnostics.map((d) => d.message).join('; ')}`)
  // One brand with one mode: `dta build` declares everything in :root. The Brand collection's
  // variables are split out and scoped per state below.
  const result = await buildOutputs(model, { css: { outDir: 'css' } })
  if (result.diagnostics.length) {
    throw new Error(`${dir}: ${result.diagnostics.map((d) => d.message).join('; ')}`)
  }
  const base = result.files.find((f) => f.path === 'css/base.css')
  if (!base) throw new Error(`${dir}: no base.css in the build`)
  const brand = model.collections.find((c) => c.name === 'Brand')
  if (!brand) throw new Error(`${dir}: no Brand collection`)
  const semantic = new Set(brand.tokens.map((token) => `--${cssVariableName(token.name)}`))
  const lines = base.content.split('\n').filter((line) => /^\s+--[\w-]+:/.test(line))
  const isSemantic = (line: string) => semantic.has(line.trim().split(':')[0])
  return {
    primitives: lines.filter((line) => !isSemantic(line)).join('\n'),
    theme: lines.filter(isSemantic).join('\n'),
  }
}

export async function exampleStylesheet(): Promise<string> {
  const out: string[] = [
    '/**\n * Do not edit directly: built by scripts/build-example.ts from examples/orbit-burger with DTA.\n */',
  ]
  let primitives: string | undefined
  for (const [state, dir] of STATES) {
    const built = await buildState(dir)
    if (primitives === undefined) {
      primitives = built.primitives
      out.push(`:root {\n${primitives}\n}`)
    } else if (built.primitives !== primitives) {
      const a = primitives.split('\n'),
        b = built.primitives.split('\n')
      const changed = b
        .filter((line, i) => line !== a[i])
        .slice(0, 3)
        .join('\n')
      throw new Error(`the two states must share their primitives; ${dir} differs:\n${changed}`)
    }
    out.push(`[data-example="orbit-burger"][data-state="${state}"] {\n${built.theme}\n}`)
  }
  return out.join('\n\n') + '\n'
}

export const EXAMPLE_CSS = path.join(siteDir, 'output', 'css', 'examples', 'orbit-burger.css')

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const css = await exampleStylesheet()
  fs.mkdirSync(path.dirname(EXAMPLE_CSS), { recursive: true })
  fs.writeFileSync(EXAMPLE_CSS, css)
  console.log(`Wrote ${path.relative(siteDir, EXAMPLE_CSS)}`)
}
