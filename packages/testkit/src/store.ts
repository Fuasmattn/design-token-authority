import fs from 'node:fs'
import path from 'node:path'
import type { ScenarioResult } from './types.js'

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

/** Relative paths (forward slashes) of all files below `dir`, sorted. */
export function listFiles(dir: string, base: string = dir): string[] {
  const result: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) result.push(...listFiles(full, base))
    else result.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return result.sort()
}

/** Record a result in `dir`, replacing anything that was there before. */
export function writeSnapshot(dir: string, result: ScenarioResult): void {
  fs.rmSync(dir, { recursive: true, force: true })
  write(path.join(dir, 'stdout.txt'), result.stdout)
  if (result.stderr !== '') write(path.join(dir, 'stderr.txt'), result.stderr)
  write(path.join(dir, 'exit-code.txt'), `${result.exitCode}\n`)
  for (const [name, content] of Object.entries(result.files)) {
    write(path.join(dir, 'files', name), content)
  }
}

/** Read a recorded result, or `null` if nothing was recorded in `dir`. */
export function readSnapshot(dir: string): ScenarioResult | null {
  const exitCodeFile = path.join(dir, 'exit-code.txt')
  if (!fs.existsSync(exitCodeFile)) return null

  const readText = (name: string) => {
    const file = path.join(dir, name)
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : ''
  }
  const filesDir = path.join(dir, 'files')
  const files: Record<string, string> = {}
  if (fs.existsSync(filesDir)) {
    for (const name of listFiles(filesDir)) {
      files[name] = fs.readFileSync(path.join(filesDir, name), 'utf-8')
    }
  }
  return {
    stdout: readText('stdout.txt'),
    stderr: readText('stderr.txt'),
    exitCode: Number(fs.readFileSync(exitCodeFile, 'utf-8').trim()),
    files,
  }
}

/** Names of the fixture projects (sub-directories) in `fixturesDir`, sorted. */
export function listFixtures(fixturesDir: string): string[] {
  return fs
    .readdirSync(fixturesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}
