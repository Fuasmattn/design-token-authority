import { afterEach, describe, expect, it } from 'vitest'
import {
  createSandbox,
  fixtureTokens,
  recording,
  withTokens,
  type Sandbox,
} from './test-support.js'

let sandbox: Sandbox
afterEach(() => sandbox.close())

const ORPHAN = 'VariableID:9:9'

/** The brand-ab recording with one variable the token files do not have. */
function withOrphan() {
  const response = recording()
  const primitives = Object.values(
    response.meta.variableCollections as Record<
      string,
      { name: string; id: string; variableIds: string[] }
    >,
  ).find((collection) => collection.name === 'Primitives')!
  primitives.variableIds.push(ORPHAN)
  response.meta.variables[ORPHAN] = {
    id: ORPHAN,
    name: 'Colors/Foundation/Old',
    key: 'old',
    variableCollectionId: primitives.id,
    resolvedType: 'COLOR',
    valuesByMode: { '1:0': { r: 0.2, g: 0.3333, b: 0.8314, a: 1 } },
    remote: false,
    description: '',
    hiddenFromPublishing: false,
    scopes: ['ALL_SCOPES'],
    codeSyntax: {},
  }
  return response
}

async function project(response: unknown = withOrphan()) {
  sandbox = await createSandbox({ recording: response })
  withTokens(sandbox, fixtureTokens())
}

const posts = () => sandbox.fake!.requests.filter((request) => request.method === 'POST')

describe('dta prune (TICKET-021)', () => {
  it('says so when every variable has its token, and sends nothing', async () => {
    await project(recording())
    const { exitCode, stdout } = await sandbox.run(['prune'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('No orphaned variables')
    expect(posts()).toHaveLength(0)
  })

  it('--dry-run lists the orphans with their values and deletes nothing', async () => {
    await project()
    const { exitCode, stdout } = await sandbox.run(['prune', '--dry-run'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('1 variable in Figma without a token')
    expect(stdout).toMatch(/Primitives\s+Colors\.Foundation\.Old\s+#3355d4/)
    expect(stdout).toContain('Dry run: nothing was deleted.')
    expect(posts()).toHaveLength(0)
  })

  it('--force deletes the orphans, and only them', async () => {
    await project()
    const { exitCode, stdout } = await sandbox.run(['prune', '--force'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain(
      'Figma does not tell DTA whether components or frames use these variables',
    )
    expect(stdout).toContain('Deleted 1 variable')
    expect(posts().map((post) => post.body)).toEqual([
      { variables: [{ action: 'DELETE', id: ORPHAN }] },
    ])
  })

  it('asks for the typed phrase before deleting', { timeout: 15_000 }, async () => {
    await project()
    const { exitCode, stdout } = await sandbox.run(['prune'], ['delete variables from figma'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('To confirm, type: delete variables from figma')
    expect(posts()).toHaveLength(1)
  })

  it('never prunes against an empty tokens folder', async () => {
    sandbox = await createSandbox({ recording: withOrphan() })
    sandbox.write('tokens/.keep', '')
    const { exitCode, stdout } = await sandbox.run(['prune', '--force'])
    expect(exitCode).toBe(2)
    expect(stdout).toContain('nothing to compare with')
    expect(posts()).toHaveLength(0)
  })

  it('stops when the parser skipped an entry: its variable would look orphaned', async () => {
    sandbox = await createSandbox({ recording: withOrphan() })
    const tokens = fixtureTokens()
    const file = Object.keys(tokens).find((name) => name.startsWith('Primitives'))!
    const tree = JSON.parse(tokens[file])
    tree.Colors.Foundation.Loose = '#ffffff' // neither a token nor a group: skipped with a warning
    withTokens(sandbox, { ...tokens, [file]: JSON.stringify(tree) })
    const { exitCode, stdout } = await sandbox.run(['prune', '--force'])
    expect(exitCode).toBe(1)
    expect(stdout).toContain('not read as tokens')
    expect(posts()).toHaveLength(0)
  })

  it('looks only at the collections in `collections`', async () => {
    sandbox = await createSandbox({
      recording: withOrphan(),
      config: {
        figma: { fileKey: 'KEY', personalAccessToken: 'secret' },
        collections: ['Brand(Alias)', 'ScreenType'],
      },
    })
    withTokens(sandbox, fixtureTokens())
    const { exitCode, stdout } = await sandbox.run(['prune', '--dry-run'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('The Figma collection "Primitives" is not in the token files')
    expect(stdout).toContain('No orphaned variables')
  })

  it('needs the Figma API', async () => {
    sandbox = await createSandbox({ config: { figma: { source: 'file' } } })
    withTokens(sandbox, fixtureTokens())
    const { exitCode, stdout } = await sandbox.run(['prune', '--dry-run'])
    expect(exitCode).toBe(2)
    expect(stdout).toContain('Figma API credentials are required for prune')
  })
})
