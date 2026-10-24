import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { nameToDot, parseTokenFiles, type TokenModel } from '@dta/core'
import { parseVariablesResponse, planPrune } from './index.js'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')
const fixtureDir = path.join(repoRoot, 'test', 'fixtures', 'brand-ab', 'tokens')
const recording = () =>
  parseVariablesResponse(
    JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'test', 'recordings', 'brand-ab', 'variables-local.json'),
        'utf-8',
      ),
    ),
  )
const fixtureModel = (): TokenModel =>
  parseTokenFiles(
    fs.readdirSync(fixtureDir).map((fileName) => ({
      fileName,
      content: fs.readFileSync(path.join(fixtureDir, fileName), 'utf-8'),
    })),
  ).model

/** The fixture without some tokens, as if they were deleted from the token files. */
function without(...names: string[]): TokenModel {
  const model = fixtureModel()
  for (const collection of model.collections) {
    collection.tokens = collection.tokens.filter((token) => !names.includes(nameToDot(token.name)))
  }
  return model
}

const idOf = (name: string) =>
  Object.values(recording().meta.variables).find((v) => v.name === name.split('.').join('/'))?.id

describe('planPrune (TICKET-021)', () => {
  it('finds nothing when the token files and the Figma file match', () => {
    const plan = planPrune(fixtureModel(), recording())
    expect(plan.orphans).toEqual([])
    expect(plan.payload).toBeNull()
  })

  it('lists a variable whose token is gone, with its values per mode, and deletes it', () => {
    const plan = planPrune(without('Colors.Text.Muted'), recording())
    expect(plan.orphans).toEqual([
      {
        id: idOf('Colors.Text.Muted'),
        name: 'Colors.Text.Muted',
        collection: 'Brand(Alias)',
        values: [
          { mode: 'BrandA', value: '{Colors.Foundation.Gray.500}' },
          { mode: 'BrandB', value: '{Colors.Foundation.Gray.500}' },
        ],
      },
    ])
    expect(plan.payload).toEqual({
      variables: [{ action: 'DELETE', id: idOf('Colors.Text.Muted') }],
    })
  })

  it('keeps an orphan another variable still aliases, and names who', () => {
    const plan = planPrune(without('Colors.Foundation.Gray.500'), recording())
    expect(plan.orphans).toEqual([])
    expect(plan.kept.map((orphan) => [orphan.name, orphan.aliasedBy])).toEqual([
      ['Colors.Foundation.Gray.500', ['Colors.Text.Muted']],
    ])
    expect(plan.payload).toBeNull()
  })

  it('deletes an orphan aliased only by orphans, and keeps the chain behind a kept one', () => {
    expect(
      planPrune(
        without('Colors.Foundation.Gray.500', 'Colors.Text.Muted'),
        recording(),
      ).orphans.map((orphan) => orphan.name),
    ).toEqual(['Colors.Foundation.Gray.500', 'Colors.Text.Muted'].sort((a, b) => (a < b ? -1 : 1)))
    // Figma: a staying variable → Kept → Primitive; both stay.
    const response = recording()
    const variables = response.meta.variables
    const muted = idOf('Colors.Text.Muted') as string
    const gray = idOf('Colors.Foundation.Gray.500') as string
    const accent = idOf('Colors.Brand.Accent') as string
    for (const mode of Object.keys(variables[accent].valuesByMode)) {
      variables[accent].valuesByMode[mode] = { type: 'VARIABLE_ALIAS', id: muted }
    }
    const plan = planPrune(without('Colors.Foundation.Gray.500', 'Colors.Text.Muted'), response)
    expect(plan.orphans).toEqual([])
    expect(plan.kept.map((orphan) => orphan.id).sort()).toEqual([gray, muted].sort())
  })

  it('leaves collections alone that are not in the token files, and library variables', () => {
    const model = fixtureModel()
    model.collections = model.collections.filter((collection) => collection.name !== 'ScreenType')
    const plan = planPrune(model, recording())
    expect(plan.orphans).toEqual([])
    expect(plan.diagnostics.map((d) => d.message)).toEqual([
      expect.stringMatching(
        /^The Figma collection "ScreenType" is not in the token files \(or has no tokens there\), so its \d+ variables are left alone\.$/,
      ),
    ])
    const response = recording()
    const id = idOf('Colors.Text.Muted') as string
    response.meta.variables[id].remote = true
    expect(planPrune(without('Colors.Text.Muted'), response).orphans).toEqual([])
  })

  describe('guards (review)', () => {
    it('refuses when two Figma collections have one name', () => {
      const response = recording()
      const [first, second] = Object.values(response.meta.variableCollections)
      second.name = first.name
      const plan = planPrune(without('Colors.Text.Muted'), response)
      expect(plan.payload).toBeNull()
      expect(plan.diagnostics[0]).toMatchObject({ severity: 'error', code: 'duplicate-collection' })
    })

    it('leaves a collection alone whose token file is empty', () => {
      const model = fixtureModel()
      for (const collection of model.collections) {
        if (collection.name === 'Brand(Alias)') collection.tokens = []
      }
      const plan = planPrune(model, recording())
      expect(plan.orphans).toEqual([])
      expect(plan.diagnostics.map((d) => d.message).join('\n')).toContain(
        'The Figma collection "Brand(Alias)" is not in the token files (or has no tokens there)',
      )
    })

    it('leaves a collection alone that would lose more than half of it, unless allowBulk', () => {
      const model = fixtureModel()
      const screen = model.collections.find((c) => c.name === 'ScreenType')!
      const kept = screen.tokens.slice(0, 1)
      const names = screen.tokens.slice(1).map((token) => nameToDot(token.name))
      screen.tokens = kept
      const plan = planPrune(model, recording())
      expect(plan.orphans).toEqual([])
      expect(plan.bulk).toEqual([
        { collection: 'ScreenType', orphans: names.length, variables: names.length + 1 },
      ])
      expect(
        planPrune(model, recording(), { allowBulk: true })
          .orphans.map((o) => o.name)
          .sort(),
      ).toEqual(names.sort())
    })

    it('never deletes a variable Figma already deleted, nor counts it as aliasing', () => {
      const response = recording()
      const muted = idOf('Colors.Text.Muted') as string
      response.meta.variables[muted].deletedButReferenced = true
      // Gray.500 is aliased only by the deleted Text.Muted: an orphan once Gray.500 is gone locally.
      const plan = planPrune(without('Colors.Text.Muted', 'Colors.Foundation.Gray.500'), response)
      expect(plan.orphans.map((o) => o.name)).toEqual(['Colors.Foundation.Gray.500'])
    })

    it('matches a token file key with a dot to the Figma name with a slash', () => {
      const response = recording()
      const id = idOf('Dimensions.spacing.4') as string
      const model = fixtureModel()
      const primitives = model.collections.find((c) => c.name === 'Primitives')!
      const token = primitives.tokens.find((t) => nameToDot(t.name) === 'Dimensions.spacing.4')!
      token.name = ['Dimensions', 'spacing.4']
      expect(planPrune(model, response).orphans.map((o) => o.id)).not.toContain(id)
    })
  })
})
