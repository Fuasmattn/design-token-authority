import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { startFigmaFake, type FigmaFake } from '@dta/testkit'
import { runCli } from '../index.js'

const root = path.resolve(import.meta.dirname, '..', '..', '..', '..')

export const recording = (name = 'variables-local.json') =>
  JSON.parse(fs.readFileSync(path.join(root, 'test', 'recordings', 'brand-ab', name), 'utf8'))

export const fixtureTokens = (): Record<string, string> => {
  const dir = path.join(root, 'test', 'fixtures', 'brand-ab', 'tokens')
  return Object.fromEntries(
    fs.readdirSync(dir).map((name) => [name, fs.readFileSync(path.join(dir, name), 'utf8')]),
  )
}

/** A project folder, optionally with a fake Figma API behind `DTA_FIGMA_API_URL`. */
export interface Sandbox {
  dir: string
  fake: FigmaFake | undefined
  write(file: string, content: string): void
  read(file: string): string
  exists(file: string): boolean
  run(args: string[], answers?: string[]): Promise<{ exitCode: number; stdout: string }>
  close(): Promise<void>
}

export async function createSandbox(
  options: { recording?: unknown; token?: string; config?: unknown; fileKey?: string } = {},
): Promise<Sandbox> {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-cmd-')))
  const fake = options.recording
    ? await startFigmaFake({
        files: { [options.fileKey ?? 'KEY']: options.recording as never },
        token: 'secret',
      })
    : undefined
  if (fake) process.env.DTA_FIGMA_API_URL = fake.url
  const config = options.config ?? {
    figma: { fileKey: 'KEY', personalAccessToken: options.token ?? 'secret' },
  }
  fs.writeFileSync(path.join(dir, 'dta.config.json'), JSON.stringify(config))

  const sandbox: Sandbox = {
    dir,
    fake,
    write(file, content) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      fs.writeFileSync(path.join(dir, file), content)
    },
    read: (file) => fs.readFileSync(path.join(dir, file), 'utf8'),
    exists: (file) => fs.existsSync(path.join(dir, file)),
    async run(args, answers = []) {
      let stdout = ''
      const input = new PassThrough()
      // Answers are typed one at a time, after the prompt has had time to open.
      const timers = answers.map((answer, index) =>
        setTimeout(() => input.write(`${answer}\r`), 150 * (index + 1)),
      )
      try {
        const exitCode = await runCli(args, {
          cwd: dir,
          stdout: (text) => (stdout += text),
          stderr: () => undefined,
          input,
        })
        // eslint-disable-next-line no-control-regex
        return { exitCode, stdout: stdout.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '') }
      } finally {
        for (const timer of timers) clearTimeout(timer)
      }
    },
    async close() {
      delete process.env.DTA_FIGMA_API_URL
      await fake?.close()
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
  return sandbox
}

export function withTokens(sandbox: Sandbox, tokens: Record<string, string>, dir = 'tokens') {
  for (const [name, content] of Object.entries(tokens)) sandbox.write(`${dir}/${name}`, content)
}
