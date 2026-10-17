import { cssVariableName, tailwindThemeProperty } from '@dta/build'
import type { TokenModel, TokenType } from '@dta/core'
import type { Config } from './config/schema.js'

/** The names to use for a token in code, as `dta build` writes them. */
export interface CodeNames {
  /** CSS custom property, e.g. `--colors-brand-primary`. */
  css: string
  /** Tailwind v4 theme variable, when the token maps to a utility namespace. */
  tailwind?: string
}

/**
 * Whether `dta build` writes a token: single-mode collections always, multi-mode collections
 * only in the modes listed in `brands`, and only collections the config builds.
 */
export function isBuilt(model: TokenModel, collectionName: string, config: Config | null): boolean {
  if (config?.collections && !config.collections.includes(collectionName)) return false
  const collection = model.collections.find((c) => c.name === collectionName)
  if (!collection) return false
  if (collection.modes.length === 1) return true
  return collection.modes.some((mode) => config?.brands?.includes(mode))
}

/** The names `dta build` gives a token in code, or undefined when the build does not write it. */
export function codeNames(
  model: TokenModel,
  config: Config | null,
  token: { name: string; type: TokenType; collection: string },
  extensions?: Record<string, unknown>,
): CodeNames | undefined {
  if (!isBuilt(model, token.collection, config)) return undefined
  const path = token.name.split('.')
  const figma = extensions?.['com.figma'] as { scopes?: unknown } | undefined
  const raw = figma?.scopes
  const scopes = Array.isArray(raw) ? raw.map(String) : []
  const tailwind = tailwindThemeProperty(path, token.type, scopes)
  return {
    css: `--${cssVariableName(path)}`,
    ...(tailwind.utility ? { tailwind: tailwind.property } : {}),
  }
}
