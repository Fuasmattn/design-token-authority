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

const drifted = () => recording('variables-local.drifted.json')

async function project(response: unknown = drifted(), options: { config?: unknown } = {}) {
  sandbox = await createSandbox({ recording: response, ...options })
  withTokens(sandbox, fixtureTokens())
}

const posts = () => sandbox.fake!.requests.filter((request) => request.method === 'POST')

describe('dta push', () => {
  it('says so when Figma is already up to date, and sends nothing', async () => {
    await project(recording())
    const { exitCode, stdout } = await sandbox.run(['push'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Tokens are already up to date with the Figma file.')
    expect(posts()).toHaveLength(0)
  })

  it('--dry-run shows the diff and sends nothing', async () => {
    await project()
    const { exitCode, stdout } = await sandbox.run(['push', '--dry-run'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Summary: +1 added, ~2 modified')
    expect(stdout).toContain('Dry run')
    expect(posts()).toHaveLength(0)
  })

  it.each([
    ['markdown', '## Design Token Changes'],
    ['json', '"summary"'],
  ])('prints the diff as %s', async (format, expected) => {
    await project()
    const { stdout } = await sandbox.run(['push', '--dry-run', '--format', format])
    expect(stdout).toContain(expected)
  })

  it('--yes pushes without asking, and the payload deletes nothing', async () => {
    await project()
    const { exitCode, stdout } = await sandbox.run(['push', '--yes'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Figma file has been updated with the new tokens.')
    expect(posts()).toHaveLength(1)
    expect(JSON.stringify(posts()[0].body)).not.toContain('DELETE')
  })

  it('skipConfirmation in the config also skips the prompt', async () => {
    await project(drifted(), {
      config: {
        figma: { fileKey: 'KEY', personalAccessToken: 'secret' },
        push: { skipConfirmation: true },
      },
    })
    expect((await sandbox.run(['push'])).exitCode).toBe(0)
    expect(posts()).toHaveLength(1)
  })

  it(
    'asks for the typed phrase before pushing, and retries after a wrong answer',
    { timeout: 15_000 },
    async () => {
      await project()
      const { exitCode, stdout } = await sandbox.run(
        ['push'],
        ['no', '\u007f\u007fpush variables to figma'], // the wrong answer stays in the field: erase it first
      )
      expect(exitCode).toBe(0)
      expect(stdout).toContain('push variables to figma')
      expect(stdout).toContain('Type "push variables to figma" to confirm')
      expect(posts()).toHaveLength(1)
    },
  )

  it('does not push when the prompt is cancelled', async () => {
    await project()
    const { exitCode, stdout } = await sandbox.run(['push'], ['\u0003'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Push cancelled.')
    expect(posts()).toHaveLength(0)
  })

  it('is blocked by lint errors (exit 2) unless --skip-lint is given', async () => {
    await project()
    sandbox.write('tokens/Base.Mode 1.json', '{"A":{"$type":"number","$value":1}}')
    const blocked = await sandbox.run(['push', '--dry-run'])
    expect(blocked.exitCode).toBe(2)
    expect(blocked.stdout).toContain('[no-default-mode-names]')
    expect(blocked.stdout).toContain('--skip-lint')
    expect(sandbox.fake!.requests).toHaveLength(0)
    expect((await sandbox.run(['push', '--dry-run', '--skip-lint'])).exitCode).toBe(0)
  })

  it('shows lint warnings but goes on', async () => {
    await project(drifted(), {
      config: {
        figma: { fileKey: 'KEY', personalAccessToken: 'secret' },
        lint: { rules: { 'no-duplicate-values': {} } },
      },
    })
    const { exitCode, stdout } = await sandbox.run(['push', '--dry-run'])
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/\d+ lint warnings? found\./)
  })

  it('stops with the reason when a token cannot be pushed', async () => {
    await project()
    sandbox.write(
      'tokens/Primitives.Value.json',
      JSON.stringify({ Broken: { $type: 'color', $value: '{Does.Not.Exist}' } }),
    )
    const { exitCode, stdout } = await sandbox.run(['push', '--dry-run', '--skip-lint'])
    expect(exitCode).toBe(1)
    expect(stdout).toContain('unknown-alias-target')
  })

  it('needs credentials and a tokens folder (exit 2)', async () => {
    sandbox = await createSandbox({ recording: drifted(), config: { figma: {} } })
    const noFolder = await sandbox.run(['push'])
    expect(noFolder.exitCode).toBe(2)
    expect(noFolder.stdout).toContain('Tokens directory not found')
    withTokens(sandbox, fixtureTokens())
    const noCredentials = await sandbox.run(['push'])
    expect(noCredentials.exitCode).toBe(2)
    expect(noCredentials.stdout).toContain('Figma API credentials are required for push.')
  })

  it('explains a rejected token and never prints it', async () => {
    sandbox = await createSandbox({ recording: drifted(), token: 'wrong' })
    withTokens(sandbox, fixtureTokens())
    const { exitCode, stdout } = await sandbox.run(['push', '--yes'])
    expect(exitCode).toBe(1)
    expect(stdout).not.toContain('wrong')
    expect(posts()).toHaveLength(0)
  })

  it('rejects an unknown diff format', async () => {
    await project()
    const { exitCode } = await sandbox.run(['push', '--format', 'xml'])
    expect(exitCode).toBe(1)
  })
})
