import { afterEach, describe, expect, it } from 'vitest'
import { createSandbox, fixtureTokens, recording, type Sandbox } from './test-support.js'

let sandbox: Sandbox
afterEach(() => sandbox.close())

describe('dta pull (Figma API)', () => {
  it('writes one token file per collection and mode', async () => {
    sandbox = await createSandbox({ recording: recording() })
    const { exitCode, stdout } = await sandbox.run(['pull'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Received 6 token files from Figma')
    expect(stdout).toContain('Tokens written to tokens/')
    for (const name of Object.keys(fixtureTokens()))
      expect(sandbox.exists(`tokens/${name}`)).toBe(true)
  })

  it('reproduces the fixture tokens, and leaves unchanged files byte for byte as they were', async () => {
    sandbox = await createSandbox({ recording: recording() })
    const tokens = fixtureTokens()
    for (const [name, content] of Object.entries(tokens)) sandbox.write(`tokens/${name}`, content)
    await sandbox.run(['pull'])
    for (const [name, content] of Object.entries(tokens)) {
      expect(sandbox.read(`tokens/${name}`), name).toBe(content)
    }
  })

  it('writes to --output instead of the configured folder', async () => {
    sandbox = await createSandbox({ recording: recording() })
    await sandbox.run(['pull', '-o', 'elsewhere'])
    expect(sandbox.exists('elsewhere/Primitives.Value.json')).toBe(true)
    expect(sandbox.exists('tokens')).toBe(false)
  })

  it('strips emoji from file names when configured', async () => {
    const response = recording()
    const first = Object.values(response.meta.variableCollections)[0] as { name: string }
    first.name = '🎨 Colors'
    sandbox = await createSandbox({
      recording: response,
      config: {
        figma: { fileKey: 'KEY', personalAccessToken: 'secret' },
        tokens: { stripEmojis: true },
      },
    })
    await sandbox.run(['pull'])
    expect(sandbox.exists('tokens/Colors.Value.json')).toBe(true)
  })

  it('needs credentials: exit 2, Figma is not called', async () => {
    sandbox = await createSandbox({ recording: recording(), config: { figma: {} } })
    const { exitCode, stdout } = await sandbox.run(['pull'])
    expect(exitCode).toBe(2)
    expect(stdout).toContain('Figma API credentials are required for API-based pull.')
    expect(sandbox.fake!.requests).toHaveLength(0)
  })

  it('explains a rejected token and writes nothing', async () => {
    sandbox = await createSandbox({ recording: recording(), token: 'wrong' })
    const { exitCode, stdout } = await sandbox.run(['pull'])
    expect(exitCode).toBe(1)
    expect(stdout).toContain('--from-file')
    expect(stdout).not.toContain('wrong')
    expect(sandbox.exists('tokens/Primitives.Value.json')).toBe(false)
  })
})

describe('dta pull --from-file', () => {
  const tokenHaus = JSON.stringify({
    $extensions: { 'com.figma': { modes: {} } },
    Colors: {
      brand: { $type: 'color', $value: { Light: '#ffffff', Dark: '#000000' } },
    },
  })

  it('converts a tokenHaus export into per-mode files', async () => {
    sandbox = await createSandbox()
    sandbox.write('export.json', tokenHaus)
    const { exitCode, stdout } = await sandbox.run(['pull', '--from-file', 'export.json'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Converted tokenhaus export into 2 token files')
    expect(sandbox.read('tokens/Colors.Light.json')).toContain('#ffffff')
    expect(sandbox.exists('tokens/Colors.Dark.json')).toBe(true)
  })

  it('copies a per-mode file as it is', async () => {
    sandbox = await createSandbox()
    const content = '{"a":{"$type":"number","$value":1}}'
    sandbox.write('Base.Value.json', content)
    const { exitCode, stdout } = await sandbox.run([
      'pull',
      '--from-file',
      'Base.Value.json',
      '-o',
      'out',
    ])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Detected DTCG per-mode format')
    expect(sandbox.read('out/Base.Value.json')).toBe(content)
  })

  it('exits with 2 for a missing file, invalid JSON and an unknown format', async () => {
    sandbox = await createSandbox()
    expect((await sandbox.run(['pull', '--from-file', 'nope.json'])).exitCode).toBe(2)
    sandbox.write('broken.json', '{ nope')
    const broken = await sandbox.run(['pull', '--from-file', 'broken.json'])
    expect(broken.exitCode).toBe(2)
    expect(broken.stdout).toContain('Could not parse JSON')
    sandbox.write('other.json', '{"hello":"world"}')
    const unknown = await sandbox.run(['pull', '--from-file', 'other.json'])
    expect(unknown.exitCode).toBe(2)
    expect(unknown.stdout).toContain('Could not recognise the export format')
  })
})
