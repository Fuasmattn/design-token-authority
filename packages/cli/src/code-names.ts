import {
  codeNames as buildCodeNames,
  isBuilt as buildIsBuilt,
  type BuildSelection,
  type CodeNames,
} from '@dta/build'
import type { TokenModel, TokenType } from '@dta/core'
import type { Config } from './config/schema.js'

export type { CodeNames }

/** What the config builds: its brands and collections (`@dta/build` decides the rest). */
const selectionOf = (config: Config | null): BuildSelection | null =>
  config
    ? {
        brands: config.brands,
        collections: config.collections,
        ...(config.breakpoints
          ? { breakpoints: { collection: config.breakpoints.collection } }
          : {}),
      }
    : null

/**
 * Whether `dta build` writes a token: single-mode collections always, multi-mode collections
 * only in the modes listed in `brands` (the breakpoint collection in all its modes), and only
 * collections the config builds.
 */
export function isBuilt(model: TokenModel, collectionName: string, config: Config | null): boolean {
  return buildIsBuilt(model, collectionName, selectionOf(config))
}

/** The names `dta build` gives a token in code, or undefined when the build does not write it. */
export function codeNames(
  model: TokenModel,
  config: Config | null,
  token: { name: string; type: TokenType; collection: string },
  extensions?: Record<string, unknown>,
): CodeNames | undefined {
  return buildCodeNames(model, selectionOf(config), token, extensions)
}
