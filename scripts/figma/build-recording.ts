/**
 * Build the fake-Figma recording for a fixture project.
 *
 * There is no live Figma file behind the fixtures, so the "recording" is synthesized from
 * the fixture's token files into the response shape of
 * `GET /v1/files/:key/variables/local` (see @figma/rest-api-spec). The round-trip tests in
 * packages/testkit/test/ prove it is faithful: `pull` against the fake reproduces the
 * fixture's tokens, and `push` of the unchanged tokens finds nothing to change.
 *
 *   pnpm figma:recording            rewrite test/recordings/brand-ab/variables-local.json
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GetLocalVariablesResponse } from '@figma/rest-api-spec'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Collections and modes in the order Figma would list them (file names sort alphabetically). */
const FIXTURES: Record<string, { collections: Record<string, string[]> }> = {
  'brand-ab': {
    collections: {
      Primitives: ['Value'],
      'Brand(Alias)': ['BrandA', 'BrandB'],
      ScreenType: ['Desktop', 'Tablet', 'Mobile'],
    },
  },
}

type Json = Record<string, unknown>
type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'

interface Leaf {
  name: string
  type: VariableType
  value: unknown
  description: string
  hiddenFromPublishing: boolean
  scopes: string[]
  codeSyntax: Json
}

const RESOLVED_TYPE: Record<string, VariableType> = {
  color: 'COLOR',
  number: 'FLOAT',
  string: 'STRING',
  boolean: 'BOOLEAN',
}

/** Walk a token tree and list its tokens with `/`-separated names. */
function leaves(tree: Json, prefix: string[] = []): Leaf[] {
  const result: Leaf[] = []
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith('$') || typeof node !== 'object' || node === null) continue
    const child = node as Json
    if ('$value' in child) {
      const figma = ((child.$extensions as Json | undefined)?.['com.figma'] ?? {}) as Json
      result.push({
        name: [...prefix, key].join('/'),
        type: RESOLVED_TYPE[child.$type as string],
        value: child.$value,
        description: (child.$description as string | undefined) ?? '',
        hiddenFromPublishing: (figma.hiddenFromPublishing as boolean | undefined) ?? false,
        scopes: (figma.scopes as string[] | undefined) ?? ['ALL_SCOPES'],
        codeSyntax: (figma.codeSyntax as Json | undefined) ?? {},
      })
    } else {
      result.push(...leaves(child, [...prefix, key]))
    }
  }
  return result
}

const key = (id: string) => createHash('sha1').update(id).digest('hex')

function color(hex: string) {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex)
  if (!match) throw new Error(`Unsupported color "${hex}"`)
  const channel = (i: number) => parseInt(match[1].slice(i, i + 2), 16) / 255
  return {
    r: channel(0),
    g: channel(2),
    b: channel(4),
    a: match[2] ? parseInt(match[2], 16) / 255 : 1,
  }
}

function build(fixture: string): GetLocalVariablesResponse {
  const { collections } = FIXTURES[fixture]
  const tokensDir = path.join(repoRoot, 'test', 'fixtures', fixture, 'tokens')

  // First pass: ids. Names are unique across collections (a documented project invariant).
  const variableIdByName = new Map<string, string>()
  const layout = Object.entries(collections).map(([name, modes], c) => {
    const collectionId = `VariableCollectionId:1:${c + 1}`
    const modeIds = modes.map((mode, m) => ({ modeId: `${c + 1}:${m}`, name: mode }))
    const firstMode = JSON.parse(
      fs.readFileSync(path.join(tokensDir, `${name}.${modes[0]}.json`), 'utf-8'),
    ) as Json
    const variables = leaves(firstMode).map((leaf, n) => {
      const id = `VariableID:${c + 1}:${n + 1}`
      if (variableIdByName.has(leaf.name)) throw new Error(`Duplicate variable name ${leaf.name}`)
      variableIdByName.set(leaf.name, id)
      return { id, leaf }
    })
    return { name, modes, collectionId, modeIds, variables }
  })

  // Second pass: values per mode.
  const variableCollections: Record<string, unknown> = {}
  const variables: Record<string, unknown> = {}
  for (const { name, modes, collectionId, modeIds, variables: vars } of layout) {
    variableCollections[collectionId] = {
      id: collectionId,
      name,
      key: key(collectionId),
      modes: modeIds,
      defaultModeId: modeIds[0].modeId,
      remote: false,
      hiddenFromPublishing: false,
      variableIds: vars.map((v) => v.id),
    }
    const byMode = modes.map(
      (mode) =>
        new Map(
          leaves(
            JSON.parse(
              fs.readFileSync(path.join(tokensDir, `${name}.${mode}.json`), 'utf-8'),
            ) as Json,
          ).map((leaf) => [leaf.name, leaf]),
        ),
    )
    for (const { id, leaf } of vars) {
      const valuesByMode: Record<string, unknown> = {}
      modeIds.forEach(({ modeId }, m) => {
        const raw = byMode[m].get(leaf.name)?.value
        const alias = typeof raw === 'string' ? /^\{(.+)\}$/.exec(raw) : null
        if (alias) {
          const target = variableIdByName.get(alias[1].replace(/\./g, '/'))
          if (!target) throw new Error(`${leaf.name}: alias ${raw} does not exist`)
          valuesByMode[modeId] = { type: 'VARIABLE_ALIAS', id: target }
        } else if (leaf.type === 'COLOR') {
          valuesByMode[modeId] = color(raw as string)
        } else {
          valuesByMode[modeId] = raw
        }
      })
      variables[id] = {
        id,
        name: leaf.name,
        key: key(id),
        variableCollectionId: collectionId,
        resolvedType: leaf.type,
        valuesByMode,
        remote: false,
        description: leaf.description,
        hiddenFromPublishing: leaf.hiddenFromPublishing,
        scopes: leaf.scopes,
        codeSyntax: leaf.codeSyntax,
      }
    }
  }

  return { status: 200, error: false, meta: { variableCollections, variables } } as never
}

for (const fixture of Object.keys(FIXTURES)) {
  const out = path.join(repoRoot, 'test', 'recordings', fixture, 'variables-local.json')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(build(fixture), null, 2) + '\n')
  console.log(`Wrote ${path.relative(repoRoot, out)}`)
}
