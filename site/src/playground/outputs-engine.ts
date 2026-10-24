/**
 * The heavy half of the playground's outputs (spec decision 9, TICKET-079): `@dta/build` (Style
 * Dictionary) and the zip code (fflate). Playground.tsx imports this module dynamically when the
 * Outputs tab opens, so the bundler puts it in chunks of its own that the first load does not
 * fetch. Runs the same in Node (outputs.test.ts) and in the browser.
 */
import { buildOutputs } from '@dta/build'
import type { BuildResult, OutputFormat } from '@dta/build'
import type { TokenModel } from '@dta/core'
import { strToU8, zipSync } from 'fflate'

export interface OutputChoices {
  brands: readonly string[]
  formats: readonly OutputFormat[]
}

/** The files `dta build` writes for these choices, with the config `generateConfig` writes. */
export function buildFiles(model: TokenModel, choices: OutputChoices): Promise<BuildResult> {
  return buildOutputs(model, { brands: [...choices.brands], formats: choices.formats })
}

/** One zip with each file at its path (`output/css/base.css`), as `dta build` lays them out. */
export function zipFiles(files: ReadonlyArray<{ path: string; content: string }>): Uint8Array {
  return zipSync(
    Object.fromEntries(files.map((file) => [file.path, strToU8(file.content)] as const)),
    { level: 6 },
  )
}
