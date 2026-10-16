import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { startFigmaFake, type FigmaFake } from '@dta/testkit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../config/load.js'
import { runCli } from '../index.js'
import { recording } from './test-support.js'

const KEY = 'abcdefghij0123456789AB'
const ENTER = ''
const DOWN = '\u001b[B'
const SPACE = ' '

let dir: string
let fake: FigmaFake | undefined
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-init-')))
  // The generated config imports 'design-token-authority', which a real project has installed.
  const pkg = path.join(dir, 'node_modules', 'design-token-authority')
  fs.mkdirSync(pkg, { recursive: true })
  fs.writeFileSync(
    path.join(pkg, 'package.json'),
    JSON.stringify({ name: 'design-token-authority', type: 'module', exports: './index.js' }),
  )
  fs.writeFileSync(path.join(pkg, 'index.js'), 'export const defineConfig = (config) => config\n')
})
afterEach(async () => {
  delete process.env.DTA_FIGMA_API_URL
  delete process.env.FIGMA_FILE_KEY
  delete process.env.FIGMA_PERSONAL_ACCESS_TOKEN
  await fake?.close()
  fake = undefined
  fs.rmSync(dir, { recursive: true, force: true })
})

// eslint-disable-next-line no-control-regex
const plain = (text: string) => text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')

/**
 * Runs `dta init`, typing each answer once its question is on screen. `steps` pairs a part
 * of the question with the keys that answer it (followed by Enter).
 */
async function init(steps: Array<[question: string, keys: string]>, args: string[] = ['init']) {
  let stdout = ''
  const input = new PassThrough()
  let next = 0
  const exited = runCli(args, {
    cwd: dir,
    stdout: (text) => {
      stdout += text
      const step = steps[next]
      if (step && plain(stdout).includes(step[0])) {
        next += 1
        // Give the prompt a moment to start reading.
        setTimeout(() => input.write(`${step[1]}\r`), 50)
      }
    },
    stderr: () => undefined,
    input,
    openFile: (file) => void opened.push(file),
  })
  const opened: string[] = []
  const exitCode = await Promise.race([
    exited,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Wizard stalled at step ${next}/${steps.length}:\n${plain(stdout).slice(-600)}`,
            ),
          ),
        12_000,
      ),
    ),
  ])
  return { exitCode, stdout: plain(stdout), answered: next, opened }
}

const read = (file: string) => fs.readFileSync(path.join(dir, file), 'utf8')
const exists = (file: string) => fs.existsSync(path.join(dir, file))

describe('dta init', () => {
  it('refuses to overwrite an existing config', async () => {
    fs.writeFileSync(path.join(dir, 'dta.config.ts'), 'export default {}')
    const { exitCode, stdout } = await init([])
    expect(exitCode).toBe(2)
    expect(stdout).toContain('Config file already exists')
    expect(read('dta.config.ts')).toBe('export default {}')
  })

  it('is cancelled cleanly without writing anything', async () => {
    const { exitCode, stdout } = await init([['Which Figma plan', '\u0003']])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Setup cancelled.')
    expect(exists('dta.config.ts')).toBe(false)
  })

  describe('Enterprise plan', () => {
    beforeEach(async () => {
      fake = await startFigmaFake({ files: { [KEY]: recording() as never }, token: 'secret' })
      process.env.DTA_FIGMA_API_URL = fake.url
    })

    const answers: Array<[string, string]> = [
      ['Which Figma plan', ENTER],
      ['Figma file key or URL', `https://www.figma.com/design/${KEY}/My-File`],
      ['Figma Personal Access Token', 'secret'],
      ['Which collections should be included', ENTER],
      ['Use these brand names?', ENTER],
      ['Which formats should dta generate?', `${SPACE}${DOWN}${DOWN}${SPACE}`],
    ]

    it('discovers the file, writes a valid config and the env files', async () => {
      const { exitCode, stdout } = await init([...answers, ['Run dta pull now?', 'n']])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('Found 3 variable collections')
      expect(stdout).toContain('Detected brands')
      expect(stdout).toContain('Created dta.config.ts')

      const content = read('dta.config.ts')
      expect(content).toContain('process.env.FIGMA_FILE_KEY!')
      expect(content).toContain("brands: ['BrandA', 'BrandB']")
      expect(content).toContain('css: {')
      expect(content).toContain('version: 4')

      expect(read('.env')).toBe(`FIGMA_FILE_KEY=${KEY}\nFIGMA_PERSONAL_ACCESS_TOKEN=secret\n`)
      expect(read('.env.example')).toContain('FIGMA_FILE_KEY=')
    })

    it('generates a config that passes the config schema', async () => {
      await init([...answers, ['Run dta pull now?', 'n']])
      process.env.FIGMA_FILE_KEY = KEY
      process.env.FIGMA_PERSONAL_ACCESS_TOKEN = 'secret'
      const { config } = await loadConfig({ cwd: dir })
      expect(config.figma.fileKey).toBe(KEY)
      expect(config.brands).toEqual(['BrandA', 'BrandB'])
      expect(config.collections).toEqual(['Primitives', 'Brand(Alias)', 'ScreenType'])
      expect(config.outputs?.css?.outDir).toBe('build/css')
      expect(config.outputs?.tailwind?.version).toBe(4)
    })

    it('updates an existing .env instead of replacing it', async () => {
      fs.writeFileSync(path.join(dir, '.env'), 'OTHER=1\nFIGMA_FILE_KEY=old\n')
      await init([...answers, ['Run dta pull now?', 'n']])
      expect(read('.env')).toBe(
        `OTHER=1\nFIGMA_FILE_KEY=${KEY}\n\nFIGMA_PERSONAL_ACCESS_TOKEN=secret\n`.replace(
          '\n\n',
          '\n',
        ),
      )
    })

    it('rejects a value that is not a file key and asks again', async () => {
      const { exitCode } = await init([
        ['Which Figma plan', ENTER],
        ['Figma file key or URL', 'nope'],
        ['Could not extract a file key', '\u007f\u007f\u007f\u007f' + KEY],
        ['Figma Personal Access Token', 'secret'],
        ['Which collections should be included', ENTER],
        ['Use these brand names?', ENTER],
        ['Which formats should dta generate?', ENTER],
        ['Run dta pull now?', 'n'],
      ])
      expect(exitCode).toBe(0)
      expect(read('.env')).toContain(`FIGMA_FILE_KEY=${KEY}`)
    })

    it('carries on without discovery when Figma rejects the token', async () => {
      const { exitCode, stdout } = await init([
        ['Which Figma plan', ENTER],
        ['Figma file key or URL', KEY],
        ['Figma Personal Access Token', 'wrong'],
        ['Collection names (comma-separated', 'Primitives, Brand'],
        ['Which formats should dta generate?', ENTER],
        ['Run dta pull now?', 'n'],
      ])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('Continuing without autodiscovery')
      expect(read('dta.config.ts')).toContain("collections: ['Primitives', 'Brand']")
    })

    it('pulls and builds when asked to, without opening anything', async () => {
      process.env.FIGMA_FILE_KEY = KEY
      process.env.FIGMA_PERSONAL_ACCESS_TOKEN = 'secret'
      const { exitCode, stdout, opened } = await init([
        ['Which Figma plan', ENTER],
        ['Figma file key or URL', KEY],
        ['Figma Personal Access Token', 'secret'],
        ['Which collections should be included', ENTER],
        ['Use these brand names?', ENTER],
        ['Which formats should dta generate?', `${SPACE}`],
        ['Run dta pull now?', ENTER],
        ['Run dta build now?', ENTER],
      ])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('Tokens written to tokens/')
      expect(exists('tokens/Primitives.Value.json')).toBe(true)
      expect(exists('build/css/base.css')).toBe(true)
      expect(opened).toEqual([])
    })
  })

  describe('other plans', () => {
    const tokenHaus = JSON.stringify({
      $extensions: { 'com.figma': { modes: {} } },
      Colors: { brand: { $type: 'color', $value: { Light: '#ffffff', Dark: '#000000' } } },
    })

    it('discovers an exported file and writes a file-based config', async () => {
      fs.writeFileSync(path.join(dir, 'export.json'), tokenHaus)
      const { exitCode, stdout } = await init([
        ['Which Figma plan', DOWN],
        ['Path to exported token JSON file', 'export.json'],
        ['Which collections should be included', ENTER],
        ['Brand names (comma-separated, or blank to skip)', ENTER],
        ['Which formats should dta generate?', ENTER],
        ['Run dta pull --from-file export.json now?', 'n'],
      ])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('Found 1 collection in tokenhaus export')
      expect(exists('.env')).toBe(false)

      const { config } = await loadConfig({ cwd: dir })
      expect(config.figma.source).toBe('file')
      expect(config.collections).toEqual(['Colors'])
      expect(config.brands).toEqual(['Dark', 'Light'])
    })

    it('imports the exported file when asked to', async () => {
      fs.writeFileSync(path.join(dir, 'export.json'), tokenHaus)
      const { exitCode } = await init([
        ['Which Figma plan', DOWN],
        ['Path to exported token JSON file', 'export.json'],
        ['Which collections should be included', ENTER],
        ['Brand names (comma-separated, or blank to skip)', ENTER],
        ['Which formats should dta generate?', ENTER],
        ['Run dta pull --from-file export.json now?', ENTER],
        ['Run dta build now?', 'n'],
      ])
      expect(exitCode).toBe(0)
      expect(exists('tokens/Colors.Light.json')).toBe(true)
      expect(exists('tokens/Colors.Dark.json')).toBe(true)
    })

    it('explains the next step when no file is given', async () => {
      const { exitCode, stdout } = await init([
        ['Which Figma plan', DOWN],
        ['Path to exported token JSON file', ENTER],
        ['Collection names (comma-separated', ENTER],
        ['Which formats should dta generate?', ENTER],
      ])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('dta pull --from-file <exported.json>')
      expect(read('dta.config.ts')).toContain("source: 'file'")
      const { config } = await loadConfig({ cwd: dir })
      expect(config.figma.source).toBe('file')
    })

    it('carries on when the file does not exist', async () => {
      const { exitCode, stdout } = await init([
        ['Which Figma plan', DOWN],
        ['Path to exported token JSON file', 'missing.json'],
        ['Collection names (comma-separated', ENTER],
        ['Which formats should dta generate?', ENTER],
        ['Run dta pull --from-file missing.json now?', 'n'],
      ])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('File not found')
    })
  })
})
