import type { TokenModel, TokenType } from '@dta/core'
import { tailwindThemeProperty } from './formatters/tailwind-v4.js'
import { cssVariableName } from './transforms.js'

/** The names to use for a token in code, as `dta build` writes them. */
export interface CodeNames {
  /** CSS custom property, e.g. `--colors-brand-primary`. */
  css: string
  /** Tailwind v4 theme variable, when the token maps to a utility namespace. */
  tailwind?: string
}

/** What a build writes: the modes of multi-mode collections it builds, and which collections. */
export interface BuildSelection {
  brands?: readonly string[]
  /** Only these collections; all when absent. */
  collections?: readonly string[]
}

/**
 * Whether `dta build` writes a token of a collection: single-mode collections always,
 * multi-mode collections only in the modes listed in `brands`, and only collections it builds.
 */
export function isBuilt(
  model: TokenModel,
  collectionName: string,
  selection: BuildSelection | null | undefined,
): boolean {
  if (selection?.collections && !selection.collections.includes(collectionName)) return false
  const collection = model.collections.find((c) => c.name === collectionName)
  if (!collection) return false
  if (collection.modes.length === 1) return true
  return collection.modes.some((mode) => selection?.brands?.includes(mode))
}

/**
 * The names `dta build` gives a token in code (`dta token get` prints them), or undefined when
 * the build does not write it. Pure: no Style Dictionary, so it also runs in a browser bundle.
 */
export function codeNames(
  model: TokenModel,
  selection: BuildSelection | null | undefined,
  token: { name: string; type: TokenType; collection: string },
  extensions?: Record<string, unknown>,
): CodeNames | undefined {
  if (!isBuilt(model, token.collection, selection)) return undefined
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
