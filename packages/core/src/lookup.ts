import { nameToDot } from './names.js'
import type { Collection, Token, TokenModel } from './types.js'

export interface Located {
  token: Token
  collection: Collection
}

/** Internal: tokens by the dot form of their name. A name may appear in several collections. */
export function indexTokens(model: TokenModel): Map<string, Located[]> {
  const byName = new Map<string, Located[]>()
  for (const collection of model.collections) {
    for (const token of collection.tokens) {
      const key = nameToDot(token.name)
      const list = byName.get(key)
      if (list) list.push({ token, collection })
      else byName.set(key, [{ token, collection }])
    }
  }
  return byName
}
