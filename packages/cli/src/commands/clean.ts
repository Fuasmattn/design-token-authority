import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { listTokenFiles } from '../io/token-dir.js'
import { banner, createUi } from '../ui.js'

/** Where `dta build` writes when nothing else is configured. */
const DEFAULT_OUTPUT_DIRS = [
  'output/css',
  'output/js',
  'output/tailwind',
  'output/ios',
  'output/android',
]

const inside = (root: string, target: string) =>
  target !== root && target.startsWith(root + path.sep)

/** Removes `dir` if it is empty, and then its empty parents, never leaving `root`. */
function removeEmptyParents(root: string, dir: string): string[] {
  const removed: string[] = []
  let current = path.dirname(dir)
  while (inside(root, current) && fs.readdirSync(current).length === 0) {
    fs.rmdirSync(current)
    removed.push(current)
    current = path.dirname(current)
  }
  return removed
}

export async function runClean(context: CommandContext): Promise<number> {
  const ui = createUi(context.stdout)
  const config = context.config
  const root = path.resolve(context.cwd)
  const relative = (target: string) => path.relative(root, target).split(path.sep).join('/')
  ui.intro(banner('clean'))

  const removed: string[] = []
  const tokensDir = config?.tokens.dir ?? 'tokens'

  const tokensPath = path.resolve(root, tokensDir)
  if (fs.existsSync(tokensPath) && fs.statSync(tokensPath).isDirectory()) {
    // The files dta reads: per-mode and .tokens files, resolver documents and their folders.
    const files = listTokenFiles(tokensPath)
    for (const name of files) {
      fs.rmSync(path.join(tokensPath, name))
      removed.push(`${tokensDir}/${name}`)
    }
    const folders = new Set<string>()
    for (const file of files) {
      for (let dir = path.posix.dirname(file); dir !== '.'; dir = path.posix.dirname(dir))
        folders.add(dir)
    }
    for (const parent of [...folders].sort().reverse()) {
      const folder = path.join(tokensPath, parent)
      if (fs.existsSync(folder) && fs.readdirSync(folder).length === 0) fs.rmdirSync(folder)
    }
    if (context.options.verbose && files.length > 0) {
      ui.log.message(`Removed ${files.length} token file(s) from ${tokensDir}/`)
    }
  }

  // Only the folders the build writes to: the configured ones and the defaults. A folder
  // outside the project is never touched, and neither is a parent that holds other files.
  const configured = [
    config?.outputs?.css?.outDir,
    config?.outputs?.tailwind?.outDir,
    config?.outputs?.ios?.outDir,
    config?.outputs?.android?.outDir,
  ].filter((dir): dir is string => Boolean(dir))
  const targets = new Set(
    [...configured, ...DEFAULT_OUTPUT_DIRS].map((dir) => path.resolve(root, dir)),
  )

  for (const target of [...targets].sort()) {
    if (!inside(root, target)) {
      ui.log.warn(`Skipping "${relative(target) || target}": it is outside the project.`)
      continue
    }
    if (!fs.existsSync(target)) continue
    fs.rmSync(target, { recursive: true, force: true })
    removed.push(`${relative(target)}/`)
    for (const parent of removeEmptyParents(root, target)) removed.push(`${relative(parent)}/`)
  }

  if (removed.length > 0) ui.note(removed.map((item) => pc.dim(item)).join('\n'), 'Removed')
  else ui.log.message('Nothing to clean.')

  ui.outro('Clean complete!')
  return 0
}
