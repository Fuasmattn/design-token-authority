import { toHex, type Collection, type Diagnostic, type Token, type TokenModel } from '@dta/core'
import type { LocalVariable, LocalVariablesResponse } from './schemas.js'

export interface ExportOptions {
  /**
   * A model parsed from the current token files. Its files are reused for collections and
   * modes that still exist, so untouched files serialize byte-identical.
   */
  existing?: TokenModel
}

export interface ExportResult {
  model: TokenModel
  diagnostics: Diagnostic[]
}

const TYPES = { BOOLEAN: 'boolean', COLOR: 'color', FLOAT: 'number', STRING: 'string' } as const

const dotName = (variableName: string) => variableName.split('/').join('.')

/**
 * Converts the local variables of a Figma file (a validated response) into a token model.
 * Collection and mode order follow Figma; remote variables are skipped. Problems with single
 * values (unknown alias target, value of the wrong kind, missing value) are diagnostics and
 * leave out only that value.
 */
export function variablesToModel(
  response: LocalVariablesResponse,
  options: ExportOptions = {},
): ExportResult {
  const { variables, variableCollections } = response.meta
  const diagnostics: Diagnostic[] = []
  const collections: Collection[] = []

  for (const figmaCollection of Object.values(variableCollections)) {
    if (figmaCollection.remote) continue
    const local = Object.values(variables).filter(
      (variable) => !variable.remote && variable.variableCollectionId === figmaCollection.id,
    )
    // Like legacy: a collection without local variables produces no files.
    if (local.length === 0) continue

    const modes: { id: string; name: string }[] = []
    for (const mode of figmaCollection.modes) {
      if (modes.some((m) => m.name === mode.name)) {
        diagnostics.push({
          severity: 'error',
          code: 'duplicate-mode-name',
          message: `Collection "${figmaCollection.name}" has two modes named "${mode.name}"; the second one is left out.`,
        })
        continue
      }
      modes.push({ id: mode.modeId, name: mode.name })
    }

    const tokens: Token[] = []
    for (const variable of local) {
      const token: Token = {
        name: variable.name.split('/'),
        type: TYPES[variable.resolvedType],
        values: {},
        description: variable.description,
        extensions: {
          'com.figma': {
            hiddenFromPublishing: variable.hiddenFromPublishing,
            scopes: variable.scopes,
            codeSyntax: variable.codeSyntax,
          },
        },
      }
      for (const mode of modes) {
        const value = valueOf(
          variable,
          mode.id,
          mode.name,
          figmaCollection.name,
          variables,
          diagnostics,
        )
        if (value !== undefined) token.values[mode.name] = value
      }
      tokens.push(token)
    }

    const previous = options.existing?.collections.find((c) => c.name === figmaCollection.name)
    const sources: Collection['sources'] = {}
    for (const mode of modes) {
      if (previous?.sources[mode.name]) sources[mode.name] = previous.sources[mode.name]
    }
    collections.push({
      name: figmaCollection.name,
      modes: modes.map((m) => m.name),
      tokens,
      sources,
    })
  }

  return { model: { collections }, diagnostics }
}

function valueOf(
  variable: LocalVariable,
  modeId: string,
  modeName: string,
  collectionName: string,
  variables: LocalVariablesResponse['meta']['variables'],
  diagnostics: Diagnostic[],
): string | number | boolean | undefined {
  const where = `"${variable.name}" in mode "${modeName}" of "${collectionName}"`
  const path = variable.name.split('/')
  const skip = (code: string, message: string): undefined => {
    diagnostics.push({
      severity: 'warning',
      code,
      message: `${message} The value is left out.`,
      path,
    })
    return undefined
  }

  const value = variable.valuesByMode[modeId]
  if (value === undefined) return skip('missing-value', `Variable ${where} has no value.`)

  if (typeof value === 'object' && 'type' in value) {
    const target = variables[value.id]
    if (!target) {
      return skip(
        'unresolved-alias',
        `Variable ${where} aliases the unknown variable id "${value.id}".`,
      )
    }
    return `{${dotName(target.name)}}`
  }

  const expected = variable.resolvedType
  if (typeof value === 'object') {
    if (expected !== 'COLOR') {
      return skip('invalid-value', `Variable ${where} is ${expected} but holds a color.`)
    }
    return toHex(value)
  }
  const kind = typeof value
  const ok =
    (expected === 'FLOAT' && kind === 'number') ||
    (expected === 'STRING' && kind === 'string') ||
    (expected === 'BOOLEAN' && kind === 'boolean')
  if (!ok) return skip('invalid-value', `Variable ${where} is ${expected} but holds a ${kind}.`)
  return value
}
