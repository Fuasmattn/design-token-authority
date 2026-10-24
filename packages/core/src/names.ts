import type { TokenName } from './types.js'

/** `['Colors','Brand','Primary']` → `Colors.Brand.Primary` (the form used in JSON aliases). */
export function nameToDot(name: TokenName): string {
  return name.join('.')
}

/** `['Colors','Brand','Primary']` → `Colors/Brand/Primary` (the form Figma uses). */
export function nameToSlash(name: TokenName): string {
  return name.join('/')
}
