import {
  checkUniqueNames,
  colorsApproximatelyEqual,
  nameToDot,
  nameToSlash,
  parseAlias,
  parseColor,
  formatValue,
  referenceOf,
  resolve,
  toHex,
  toSrgb,
  type Collection,
  type ColorValue,
  type Diagnostic,
  type Token,
  type TokenModel,
  type TokenName,
  type TokenType,
  type TokenValue,
} from '@dta/core'
import type {
  PostVariablesRequestBody,
  VariableCodeSyntax,
  VariableScope,
} from '@figma/rest-api-spec'
import * as z from 'zod'
import type { LocalVariable, LocalVariableCollection, LocalVariablesResponse } from './schemas.js'

/** A value as it appears in token files: a raw value or an alias like `{Group.Token}`. */
export type ChangeValue = string | number | boolean

export type MetadataField = 'description' | 'hiddenFromPublishing' | 'scopes' | 'codeSyntax'

/** One thing a push would do. Only creations and updates exist: a push never deletes. */
export type Change =
  | { kind: 'create-collection'; collection: string }
  | { kind: 'create-mode'; collection: string; mode: string }
  | { kind: 'create-variable'; collection: string; name: TokenName; type: TokenType }
  | {
      kind: 'update-value'
      collection: string
      mode: string
      name: TokenName
      /** Undefined when the variable or mode did not exist in Figma. */
      from: ChangeValue | undefined
      to: ChangeValue
    }
  | {
      kind: 'update-metadata'
      collection: string
      name: TokenName
      fields: MetadataField[]
    }

export interface PushPlan {
  /** The request body for `postVariables`; null when there is nothing to do or errors block it. */
  payload: PostVariablesRequestBody | null
  changes: Change[]
  diagnostics: Diagnostic[]
}

const FigmaExtension = z.object({
  hiddenFromPublishing: z.boolean().optional(),
  scopes: z.array(z.string()).optional(),
  codeSyntax: z
    .object({
      WEB: z.string().optional(),
      ANDROID: z.string().optional(),
      iOS: z.string().optional(),
    })
    .optional(),
})

const RESOLVED_TYPE = {
  color: 'COLOR',
  number: 'FLOAT',
  string: 'STRING',
  boolean: 'BOOLEAN',
  // DTCG 2025.10 types Figma variables can hold: a px length, one font family.
  dimension: 'FLOAT',
  fontFamily: 'STRING',
} as const

const isPushable = (type: string): type is keyof typeof RESOLVED_TYPE => type in RESOLVED_TYPE

type FigmaValue = LocalVariable['valuesByMode'][string]
type NewValue = Exclude<FigmaValue, boolean | number | string> | ChangeValue

const sameSet = (a: string[], b: string[]) =>
  new Set(a).size === new Set(b).size && a.every((x) => new Set(b).has(x))

const sameCodeSyntax = (
  a: Record<string, string | undefined>,
  b: Record<string, string | undefined>,
) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every((key) => a[key] === b[key])

/** The token-file form of a value stored in Figma, for showing what changes. */
function displayValue(
  value: FigmaValue | undefined,
  variables: LocalVariablesResponse['meta']['variables'],
) {
  if (value === undefined) return undefined
  if (typeof value !== 'object') return value
  if ('type' in value) {
    const target = variables[value.id]
    return target ? `{${target.name.split('/').join('.')}}` : `{${value.id}}`
  }
  return toHex(value)
}

function sameValue(existing: FigmaValue | undefined, next: NewValue): boolean {
  if (existing === undefined) return false
  if (typeof existing !== 'object' || typeof next !== 'object') return existing === next
  if ('type' in existing) return 'type' in next && existing.id === next.id
  if ('type' in next) return false
  return colorsApproximatelyEqual(existing, next)
}

/**
 * Compares the token model with the local variables currently in Figma and returns what a
 * push would send (`payload`) and what it would change (`changes`). Nothing is sent here.
 *
 * Only creations and updates are planned: variables, modes and collections that exist in
 * Figma but not in the model are left alone. Any error diagnostic (duplicate names, unknown
 * alias targets, invalid values, type changes, remote variables) blocks the payload.
 */
export function planPush(model: TokenModel, figma: LocalVariablesResponse): PushPlan {
  const diagnostics: Diagnostic[] = [...checkUniqueNames(model)]
  const notPushable = new Set<string>()
  /** While the first pass looks for tokens to skip: no warnings yet. */
  let quiet = false
  const error = (code: string, message: string, path?: TokenName) =>
    diagnostics.push({ severity: 'error', code, message, ...(path ? { path } : {}) })

  const { variables, variableCollections } = figma.meta
  const collectionByName = new Map<string, LocalVariableCollection>()
  for (const collection of Object.values(variableCollections)) {
    if (collectionByName.has(collection.name)) {
      error(
        'duplicate-collection',
        `The Figma file has two collections named "${collection.name}".`,
      )
    }
    collectionByName.set(collection.name, collection)
  }
  const variableByCollectionAndName = new Map<string, Map<string, LocalVariable>>()
  for (const variable of Object.values(variables)) {
    const byName = variableByCollectionAndName.get(variable.variableCollectionId) ?? new Map()
    byName.set(variable.name, variable)
    variableByCollectionAndName.set(variable.variableCollectionId, byName)
  }
  const existingVariable = (collection: LocalVariableCollection | undefined, name: TokenName) =>
    collection ? variableByCollectionAndName.get(collection.id)?.get(nameToSlash(name)) : undefined

  // Variable ids by dot name: the real id when Figma has the variable, else its slash name
  // (which doubles as the temporary id in the payload).
  const modelIds = new Map<string, string>()
  for (const collection of model.collections) {
    const figmaCollection = collectionByName.get(collection.name)
    for (const token of collection.tokens) {
      const key = nameToDot(token.name)
      if (!modelIds.has(key)) {
        modelIds.set(
          key,
          existingVariable(figmaCollection, token.name)?.id ?? nameToSlash(token.name),
        )
      }
    }
  }
  const figmaIds = new Map<string, string>()
  for (const variable of Object.values(variables)) {
    const key = variable.name.split('/').join('.')
    if (!figmaIds.has(key)) figmaIds.set(key, variable.id)
  }

  const payload: Required<PostVariablesRequestBody> = {
    variableCollections: [],
    variableModes: [],
    variables: [],
    variableModeValues: [],
  }
  const changes: Change[] = []
  const createdCollections = new Set<string>()
  const createdVariables = new Set<string>()

  const toNewValue = (token: Token, raw: ChangeValue): NewValue | undefined => {
    const alias = parseAlias(raw)
    if (alias) {
      const id = modelIds.get(alias.join('.')) ?? figmaIds.get(alias.join('.'))
      if (!id) {
        error(
          'unknown-alias-target',
          `"${nameToDot(token.name)}" aliases "${alias.join('.')}", which does not exist in the token files or in Figma.`,
          token.name,
        )
        return undefined
      }
      return { type: 'VARIABLE_ALIAS', id }
    }
    if (token.type === 'color') {
      const parsed = typeof raw === 'string' ? parseColor(raw) : undefined
      if (!parsed?.ok) {
        error(
          'invalid-color',
          `"${nameToDot(token.name)}" has the value ${JSON.stringify(raw)}, which is not a color.`,
          token.name,
        )
        return undefined
      }
      return parsed.color
    }
    const numeric = token.type === 'number' || token.type === 'dimension'
    if (typeof raw !== typeof (numeric ? 0 : token.type === 'boolean' ? true : '')) {
      error(
        'invalid-value',
        `"${nameToDot(token.name)}" is ${token.type} but has the value ${JSON.stringify(raw)}.`,
        token.name,
      )
      return undefined
    }
    return raw
  }

  // Tokens that are not pushed, then (until nothing changes) the aliases that point at one, so
  // Figma never gets an alias to a variable it does not have.
  const skipped = new Map<string, { skip: string }>()
  const skippedNames = new Set<string>()
  quiet = true
  for (const collection of model.collections)
    for (const mode of collection.modes)
      for (const token of collection.tokens) {
        const raw = token.values[mode]
        if (raw === undefined) continue
        const result = pushValueOf(token, raw, collection, mode)
        if ('skip' in result) {
          skipped.set(`${nameToDot(token.name)}|${mode}`, result)
          skippedNames.add(nameToDot(token.name))
        }
      }
  quiet = false
  for (let changed = true; changed; ) {
    changed = false
    for (const collection of model.collections)
      for (const mode of collection.modes)
        for (const token of collection.tokens) {
          const key = `${nameToDot(token.name)}|${mode}`
          const reference = referenceOf(token.values[mode])
          if (skipped.has(key) || !reference || reference.part.length > 0) continue
          const target = reference.target.join('.')
          if (!skippedNames.has(target)) continue
          skipped.set(key, { skip: `aliases "${target}", which is not pushed` })
          skippedNames.add(nameToDot(token.name))
          changed = true
        }
  }

  for (const collection of model.collections) {
    planCollection(collection)
  }

  function planCollection(collection: Collection) {
    const figmaCollection = collectionByName.get(collection.name)
    const collectionId = figmaCollection ? figmaCollection.id : collection.name

    collection.modes.forEach((mode, index) => {
      const figmaMode = figmaCollection?.modes.find((m) => m.name === mode)
      const modeId = figmaMode ? figmaMode.modeId : mode

      if (!figmaCollection && !createdCollections.has(collection.name)) {
        createdCollections.add(collection.name)
        payload.variableCollections.push({
          action: 'CREATE',
          id: collectionId,
          name: collection.name,
          initialModeId: modeId,
        })
        // The collection comes with one mode; rename it and use it as the first mode.
        payload.variableModes.push({
          action: 'UPDATE',
          id: modeId,
          name: mode,
          variableCollectionId: collectionId,
        })
        changes.push({ kind: 'create-collection', collection: collection.name })
      } else if (!figmaMode && !(index === 0 && !figmaCollection)) {
        payload.variableModes.push({
          action: 'CREATE',
          id: modeId,
          name: mode,
          variableCollectionId: collectionId,
        })
        changes.push({ kind: 'create-mode', collection: collection.name, mode })
      }

      for (const token of collection.tokens) {
        const raw = token.values[mode]
        if (raw === undefined) continue
        const pushed =
          skipped.get(`${nameToDot(token.name)}|${mode}`) ??
          pushValueOf(token, raw, collection, mode)
        if ('skip' in pushed) {
          const key = `${collection.name}/${nameToDot(token.name)}`
          if (!notPushable.has(key)) {
            notPushable.add(key)
            diagnostics.push({
              severity: 'warning',
              code: 'not-pushable',
              message: `"${key}" ${pushed.skip}; it was not pushed.`,
              path: token.name,
            })
          }
          continue
        }
        planToken(
          collection,
          figmaCollection,
          collectionId,
          mode,
          figmaMode?.modeId,
          modeId,
          token,
          pushed.value,
        )
      }
    })
  }

  function pushValueOf(token: Token, raw: TokenValue, collection: Collection, mode: string) {
    return isPushable(token.type)
      ? pushValue(token, raw, collection, mode)
      : { skip: `is ${token.type}, which Figma variables cannot hold` }
  }

  /**
   * The value Figma gets for a DTCG 2025.10 value: colour objects as sRGB hex (with a warning
   * when clipped), px dimensions as numbers, one font family as text, a `$ref` to a token as an
   * alias, a `$ref` into a value as that part. Anything else is skipped, with the reason.
   */
  function pushValue(
    token: Token,
    raw: TokenValue,
    collection: Collection,
    mode: string,
  ): { value: ChangeValue } | { skip: string } {
    const reference = referenceOf(raw)
    if (reference?.kind === 'ref') {
      if (reference.part.length === 0) return { value: `{${reference.target.join('.')}}` }
      const resolved = resolve(model, token.name, { [collection.name]: mode })
      if (!resolved.ok)
        return { skip: `points with ${reference.text} at something that does not resolve` }
      return pushValue(token, resolved.value, collection, mode)
    }
    if (typeof raw !== 'object') {
      if (token.type === 'dimension' && typeof raw === 'string' && !parseAlias(raw)) {
        const px = /^(-?\d*\.?\d+)px$/.exec(raw.trim())
        return px
          ? { value: Number(px[1]) }
          : { skip: `is ${raw}; Figma holds lengths as px numbers` }
      }
      return { value: raw }
    }
    if (token.type === 'color' && 'colorSpace' in raw) {
      const { color, clipped } = toSrgb(raw as ColorValue)
      if (clipped && !quiet) {
        diagnostics.push({
          severity: 'warning',
          code: 'clipped-to-srgb',
          message: `"${collection.name}/${nameToDot(token.name)}" (${formatValue(raw)}) is outside sRGB; Figma gets ${toHex(color)}.`,
          path: token.name,
        })
      }
      return { value: toHex(color) }
    }
    if (token.type === 'dimension' && 'unit' in raw && 'value' in raw) {
      const { value, unit } = raw as { value: number; unit: string }
      return unit === 'px'
        ? { value }
        : { skip: `is ${value}${unit}; Figma holds lengths as px numbers` }
    }
    if (token.type === 'fontFamily' && Array.isArray(raw)) {
      return raw.length === 1 && typeof raw[0] === 'string'
        ? { value: raw[0] }
        : { skip: 'is a list of font families; a Figma variable holds one' }
    }
    return { skip: `has a value Figma variables cannot hold (${formatValue(raw)})` }
  }

  function planToken(
    collection: Collection,
    figmaCollection: LocalVariableCollection | undefined,
    collectionId: string,
    mode: string,
    figmaModeId: string | undefined,
    modeId: string,
    token: Token,
    raw: ChangeValue,
  ) {
    const variable = existingVariable(figmaCollection, token.name)
    const variableId = variable ? variable.id : nameToSlash(token.name)
    const where = `${collection.name}/${nameToDot(token.name)}`

    if (
      variable &&
      RESOLVED_TYPE[token.type as keyof typeof RESOLVED_TYPE] !== variable.resolvedType
    ) {
      error(
        'type-mismatch',
        `"${where}" is ${token.type} in the token files but ${variable.resolvedType} in Figma; Figma cannot change a variable's type.`,
        token.name,
      )
      return
    }

    const metadata = metadataDifferences(token, variable)
    const createKey = `${collectionId}|${variableId}`
    if (!variable && !createdVariables.has(createKey)) {
      createdVariables.add(createKey)
      payload.variables.push({
        action: 'CREATE',
        id: variableId,
        name: nameToSlash(token.name),
        variableCollectionId: collectionId,
        resolvedType: RESOLVED_TYPE[token.type as keyof typeof RESOLVED_TYPE],
        ...metadata.fields,
      })
      changes.push({
        kind: 'create-variable',
        collection: collection.name,
        name: token.name,
        type: token.type,
      })
    } else if (variable && metadata.names.length > 0) {
      if (variable.remote) {
        error(
          'remote-variable',
          `"${where}" is a remote variable and cannot be updated.`,
          token.name,
        )
        return
      }
      payload.variables.push({ action: 'UPDATE', id: variableId, ...metadata.fields })
      changes.push({
        kind: 'update-metadata',
        collection: collection.name,
        name: token.name,
        fields: metadata.names,
      })
    }

    const next = toNewValue(token, raw)
    if (next === undefined) return
    const existing = variable && figmaModeId ? variable.valuesByMode[figmaModeId] : undefined
    if (!sameValue(existing, next)) {
      payload.variableModeValues.push({ variableId, modeId, value: next })
      changes.push({
        kind: 'update-value',
        collection: collection.name,
        mode,
        name: token.name,
        from: displayValue(existing, variables),
        to: raw,
      })
    }
  }

  /** Writable properties the token sets and that differ from Figma (all of them for a new variable). */
  function metadataDifferences(token: Token, variable: LocalVariable | undefined) {
    const fields: {
      description?: string
      hiddenFromPublishing?: boolean
      scopes?: VariableScope[]
      codeSyntax?: VariableCodeSyntax
    } = {}
    const names: MetadataField[] = []

    if (
      token.description !== undefined &&
      (!variable || token.description !== variable.description)
    ) {
      fields.description = token.description
      names.push('description')
    }
    const raw = token.extensions?.['com.figma']
    if (raw !== undefined) {
      const parsed = FigmaExtension.safeParse(raw)
      if (!parsed.success) {
        diagnostics.push({
          severity: 'warning',
          code: 'invalid-metadata',
          message: `The com.figma extension of "${nameToDot(token.name)}" is malformed and was ignored.`,
          path: token.name,
        })
      } else {
        const ext = parsed.data
        if (
          ext.hiddenFromPublishing !== undefined &&
          (!variable || ext.hiddenFromPublishing !== variable.hiddenFromPublishing)
        ) {
          fields.hiddenFromPublishing = ext.hiddenFromPublishing
          names.push('hiddenFromPublishing')
        }
        if (ext.scopes && (!variable || !sameSet(ext.scopes, variable.scopes))) {
          fields.scopes = ext.scopes as VariableScope[]
          names.push('scopes')
        }
        if (ext.codeSyntax && (!variable || !sameCodeSyntax(ext.codeSyntax, variable.codeSyntax))) {
          fields.codeSyntax = ext.codeSyntax
          names.push('codeSyntax')
        }
      }
    }
    return { fields, names }
  }

  const blocked = diagnostics.some((d) => d.severity === 'error')
  if (blocked) return { payload: null, changes: [], diagnostics }
  return { payload: changes.length > 0 ? payload : null, changes, diagnostics }
}
