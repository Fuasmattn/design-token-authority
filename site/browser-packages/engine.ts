/**
 * What the playground (spec: docs/specs/playground.md) calls on the `@dta/*` packages, in one
 * module that runs the same in Node and in a browser bundle (TICKET-076). Input and results are
 * plain JSON, so a run in Chromium can be compared with a run in Node.
 *
 * `@dta/build` (Style Dictionary) is imported only when outputs are asked for (spec decision 9):
 * a bundler splits it into its own chunk, which the first load does not fetch.
 */
import { analyzeGraph, analyzeStructure, parseTokenFiles, resolve } from '@dta/core'
import type { Breakpoints } from '@dta/build'
import type { TokenFileInput } from '@dta/core'
import { detectFormat, importPluginExport } from '@dta/figma'
import { lintTokens } from '@dta/lint'

export interface AnalysisInput {
  files: TokenFileInput[]
  /** The `lint` section of a `dta.config.ts`. */
  lint?: unknown
  /** A third-party export (for example tokenHaus) to detect and import. */
  pluginExport?: unknown
  /** A token to resolve, and the modes to read it in. */
  resolve?: { name: string[]; selection: Record<string, string> }
}

/** Structure, graph, lint, format detection and import: everything but the outputs. */
export function runAnalysis(input: AnalysisInput) {
  const parsed = parseTokenFiles(input.files)
  const model = parsed.model
  return {
    diagnostics: parsed.diagnostics,
    model,
    structure: analyzeStructure(model),
    graph: analyzeGraph(model),
    resolved: input.resolve
      ? resolve(model, input.resolve.name, input.resolve.selection)
      : undefined,
    lint: lintTokens(model, input.lint),
    formats: input.files.map((file) => detectFormat(JSON.parse(file.content))),
    imported: input.pluginExport === undefined ? undefined : importPluginExport(input.pluginExport),
  }
}

export interface OutputsInput {
  files: TokenFileInput[]
  brands?: string[]
  breakpoints?: Breakpoints
  collections?: string[]
  css?: { outDir?: string }
  tailwind?: { outDir?: string }
}

/** The output files (CSS, JS, Tailwind), loading `@dta/build` on first use. */
export async function runOutputs(input: OutputsInput) {
  const { buildOutputs } = await import('@dta/build')
  const { model } = parseTokenFiles(input.files)
  return buildOutputs(model, {
    brands: input.brands,
    breakpoints: input.breakpoints,
    collections: input.collections,
    css: input.css,
    tailwind: input.tailwind,
  })
}
