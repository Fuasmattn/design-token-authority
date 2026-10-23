/**
 * Names in native code (spec native-outputs, decision 6): the first path segment is the group,
 * the rest the name; brand tokens are named from the whole path. Two tokens that end up with the
 * same name are a warning naming both; the second is left out.
 */
import { nameToDot, type Diagnostic } from '@dta/core'
import type { NativeToken } from './tokens.js'

/**
 * The words of path segments: `['Primary Dark', '700']` → `['Primary', 'Dark', '700']`. Letters
 * of any script count (Swift and Kotlin take `grün`); `ascii` folds them for Android resources
 * (`Grün` → `Grun`) and drops what is left.
 */
export const words = (segments: readonly string[], ascii = false) =>
  segments
    .flatMap((segment) =>
      (ascii ? segment.normalize('NFKD').replace(/[\u0300-\u036f]/g, '') : segment).split(
        ascii ? /[^A-Za-z0-9]+/ : /[^\p{L}\p{N}]+/u,
      ),
    )
    .filter(Boolean)

const upperFirst = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
const lowerFirst = (word: string) => word.charAt(0).toLowerCase() + word.slice(1)

/** `['Primary', 'Dark']` → `PrimaryDark` (Kotlin constants, Swift and Kotlin types). */
export const upperCamel = (parts: readonly string[]) => parts.map(upperFirst).join('')
/** `['Primary', 'Dark']` → `primaryDark` (Swift properties). */
export const lowerCamel = (parts: readonly string[]) =>
  parts.map((word, i) => (i === 0 ? lowerFirst(word) : upperFirst(word))).join('')
/** `['Colors', 'Primary Dark']` → `colors_primary_dark` (Android resources). */
export const snake = (parts: readonly string[]) => parts.map((word) => word.toLowerCase()).join('_')

/** An identifier that starts with a digit gets `_`. (Empty names are left out by `grouped`.) */
export const identifier = (name: string) => (/^\d/.test(name) ? `_${name}` : name)

/** A token in a group, with the name its platform gives it. */
export interface Named {
  token: NativeToken
  name: string
}

/**
 * Tokens by group (the first path segment; `''` for a token without one), named by `nameOf`
 * from the rest of the path. A name taken twice in a group is a warning; the second token is
 * left out.
 */
export function grouped(
  tokens: readonly NativeToken[],
  nameOf: (rest: string[]) => string,
  groupOf: (first: string) => string,
  output: string,
  diagnostics: Diagnostic[],
): Array<{ group: string; tokens: Named[] }> {
  const groups = new Map<string, Map<string, NativeToken>>()
  for (const token of tokens) {
    const [first, ...rest] = token.path
    const group = rest.length === 0 ? '' : groupOf(first)
    const name = nameOf(rest.length === 0 ? [first] : rest)
    if (name === '' || name === '_' || group === '_') {
      diagnostics.push(nameless(output, token))
      continue
    }
    const names = groups.get(group) ?? new Map<string, NativeToken>()
    groups.set(group, names)
    const taken = names.get(name)
    if (taken) {
      diagnostics.push(collision(output, name, taken, token))
      continue
    }
    names.set(name, token)
  }
  return [...groups].map(([group, names]) => ({
    group,
    tokens: [...names].map(([name, token]) => ({ name, token })),
  }))
}

/** Tokens named from their whole path, the second of two with one name left out. */
export function flat(
  tokens: readonly NativeToken[],
  nameOf: (path: string[]) => string,
  output: string,
  diagnostics: Diagnostic[],
): Named[] {
  const names = new Map<string, NativeToken>()
  for (const token of tokens) {
    const name = nameOf(token.path)
    if (name === '' || name === '_') {
      diagnostics.push(nameless(output, token))
      continue
    }
    const taken = names.get(name)
    if (taken) {
      diagnostics.push(collision(output, name, taken, token))
      continue
    }
    names.set(name, token)
  }
  return [...names].map(([name, token]) => ({ name, token }))
}

function nameless(output: string, token: NativeToken): Diagnostic {
  return {
    severity: 'warning',
    code: 'native-name-empty',
    message: `${output}: "${nameToDot(token.path)}" has no letters or digits to make a name of; it is left out.`,
  }
}

function collision(output: string, name: string, kept: NativeToken, left: NativeToken): Diagnostic {
  return {
    // A warning, not an error: an error would stop `dta build` from writing the web outputs too.
    severity: 'warning',
    code: 'native-name-collision',
    message: `${output}: "${nameToDot(kept.path)}" and "${nameToDot(left.path)}" both become "${name}"; "${nameToDot(left.path)}" is left out. Rename one of them.`,
  }
}

/** Numbers as code writes them: never an exponent, at most four decimals, no trailing zeros. */
export function number(value: number): string {
  const text = value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 4 })
  return text === '-0' ? '0' : text
}

/** The alias chain for a comment: `Colors.Brand.Primary → Colors.Blue.500`. */
export const chainText = (token: NativeToken) => token.chain.join(' → ')
