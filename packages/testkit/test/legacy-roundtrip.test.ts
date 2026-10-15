/**
 * Proves the Figma recording is faithful, using the frozen legacy CLI as the judge:
 *  - `pull` against the fake reproduces the fixture's token files;
 *  - `push` of unchanged tokens finds nothing to change;
 *  - `push` of an edited token sends the expected payload.
 * Everything runs against the fake; no network, no Figma credentials.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { GetLocalVariablesResponse } from '@figma/rest-api-spec'
import { captureScenario, startFigmaFake, type CliCommand, type FigmaFake } from '../src/index.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const fixtureTokens = path.join(repoRoot, 'test', 'fixtures', 'brand-ab', 'tokens')
const recording = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, 'test', 'recordings', 'brand-ab', 'variables-local.json'),
    'utf-8',
  ),
) as GetLocalVariablesResponse

const FILE_KEY = 'TESTFILEKEY-brand-ab'
const TOKEN = 'fake-token'
const legacyCli: CliCommand = {
  command: process.execPath,
  args: [
    '--import',
    pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href,
    path.join(repoRoot, 'src', 'cli.ts'),
  ],
}

let fake: FigmaFake
let tmp: string

beforeAll(async () => {
  fake = await startFigmaFake({ files: { [FILE_KEY]: recording }, token: TOKEN })
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'figma-roundtrip-')))
})

afterAll(async () => {
  await fake.close()
  fs.rmSync(tmp, { recursive: true, force: true })
})

function project(name: string, withTokens: boolean): string {
  const dir = path.join(tmp, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'dta.config.ts'),
    `export default {
  figma: { fileKey: '${FILE_KEY}', personalAccessToken: '${TOKEN}', source: 'api' },
  tokens: { dir: 'tokens' },
}
`,
  )
  if (withTokens) fs.cpSync(fixtureTokens, path.join(dir, 'tokens'), { recursive: true })
  return dir
}

/** Legacy export always writes `$description`; the fixtures omit empty ones. */
function withoutEmptyDescriptions(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutEmptyDescriptions)
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key, value]) => !(key === '$description' && value === ''))
        .map(([key, value]) => [key, withoutEmptyDescriptions(value)]),
    )
  }
  return node
}

describe('legacy pull against the recording', () => {
  it('reproduces the fixture token files', async () => {
    const result = await captureScenario({
      fixtureDir: project('pull', false),
      scenario: { name: 'pull', args: ['pull'] },
      cli: legacyCli,
      repoRoot,
      figmaApiUrl: fake.url,
    })
    expect(result.exitCode, result.stdout + result.stderr).toBe(0)

    const pulled = Object.keys(result.files)
      .filter((f) => f.startsWith('tokens/'))
      .sort()
    const expected = fs
      .readdirSync(fixtureTokens)
      .sort()
      .map((f) => `tokens/${f}`)
    expect(pulled).toEqual(expected)
    for (const file of pulled) {
      const fixture = JSON.parse(
        fs.readFileSync(path.join(repoRoot, 'test', 'fixtures', 'brand-ab', file), 'utf-8'),
      )
      expect(withoutEmptyDescriptions(JSON.parse(result.files[file])), file).toEqual(
        withoutEmptyDescriptions(fixture),
      )
    }
    expect(fake.requests.some((r) => r.method === 'GET' && r.fileKey === FILE_KEY)).toBe(true)
  })
})

describe('legacy push against the recording', () => {
  it('has nothing to change when tokens equal the recording', async () => {
    const before = fake.requests.length
    const result = await captureScenario({
      fixtureDir: project('push-unchanged', true),
      scenario: { name: 'push', args: ['push', '--yes', '--skip-lint'] },
      cli: legacyCli,
      repoRoot,
      figmaApiUrl: fake.url,
    })
    expect(result.exitCode, result.stdout + result.stderr).toBe(0)
    expect(fake.requests.slice(before).filter((r) => r.method === 'POST')).toEqual([])
  })

  it('sends the changed variable as the payload', async () => {
    const dir = project('push-changed', true)
    const file = path.join(dir, 'tokens', 'Primitives.Value.json')
    const tokens = JSON.parse(fs.readFileSync(file, 'utf-8'))
    const group = tokens.Colors.Foundation.Blue
    const [name] = Object.keys(group).filter((k) => !k.startsWith('$'))
    group[name].$value = '#010203'
    fs.writeFileSync(file, JSON.stringify(tokens, null, 2) + '\n')

    const before = fake.requests.length
    const result = await captureScenario({
      fixtureDir: dir,
      scenario: { name: 'push', args: ['push', '--yes', '--skip-lint'] },
      cli: legacyCli,
      repoRoot,
      figmaApiUrl: fake.url,
    })
    expect(result.exitCode, result.stdout + result.stderr).toBe(0)

    const posts = fake.requests.slice(before).filter((r) => r.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0].token).toBe(TOKEN)
    // Legacy omits the alpha channel when it is 1.
    expect(posts[0].body?.variableModeValues).toEqual([
      {
        variableId: 'VariableID:1:1',
        modeId: '1:0',
        value: { r: 1 / 255, g: 2 / 255, b: 3 / 255 },
      },
    ])
    expect(posts[0].body?.variables ?? []).toEqual([])
  })
})
