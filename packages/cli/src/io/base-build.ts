import fs from 'node:fs'
import path from 'node:path'
import { installCommand, lockfileIn, type PackageManager } from './detect.js'
import { gitOutput } from './diff-base.js'
import { CommandFailedError, runCommand } from './run-command.js'
import type { BaseWorktree } from './worktree.js'

/** The base could not be built: the command and its output (TICKET-127). */
export class BaseBuildError extends Error {
  constructor(readonly failure: CommandFailedError) {
    super(failure.message)
    this.name = 'BaseBuildError'
  }
}

/** The nearest lockfile from `dir` up to `root`: its folder (relative to root) and manager. */
function findLockfile(
  root: string,
  dir: string,
): { folder: string; file: string; manager: PackageManager } | null {
  for (let current = dir; ; current = path.dirname(current)) {
    const lock = lockfileIn(current)
    if (lock) return { folder: path.relative(root, current), ...lock }
    if (current === root || path.dirname(current) === current) return null
  }
}

/** Every `node_modules` folder of the head's checkout (not those inside one), relative to root. */
function nodeModulesFolders(root: string): string[] {
  const found: string[] = []
  const walk = (dir: string, depth: number) => {
    if (depth > 6) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.name === 'node_modules') found.push(path.relative(root, full))
      else walk(full, depth + 1)
    }
  }
  walk(root, 0)
  return found
}

/**
 * A real `node_modules` folder in the worktree whose packages link to the head's installed ones,
 * so the base's own caches (`.cache`, `.vite`) stay in the worktree. A workspace package (a link
 * into the repository, not into node_modules) links to the base's copy of it instead: the base
 * renders its own code.
 */
function linkPackages(headRoot: string, baseRoot: string, folder: string) {
  const link = (from: string, to: string) => {
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.symlinkSync(from, to, 'junction')
  }
  const visit = (relative: string) => {
    const headDir = path.join(headRoot, relative)
    fs.mkdirSync(path.join(baseRoot, relative), { recursive: true })
    for (const entry of fs.readdirSync(headDir, { withFileTypes: true })) {
      const name = entry.name
      // Caches and the package manager's own bookkeeping; .bin links resolve through the packages.
      if (name.startsWith('.') && name !== '.bin' && name !== '.pnpm') continue
      const from = path.join(headDir, name)
      const to = path.join(baseRoot, relative, name)
      if (name.startsWith('@') && entry.isDirectory() && !entry.isSymbolicLink()) {
        visit(path.join(relative, name))
        continue
      }
      let real = from
      try {
        real = fs.realpathSync(from)
      } catch {
        continue // a broken link
      }
      const inRepo = !path.relative(headRoot, real).startsWith('..')
      const isWorkspace =
        entry.isSymbolicLink() && inRepo && !real.split(path.sep).includes('node_modules')
      link(isWorkspace ? path.join(baseRoot, path.relative(headRoot, real)) : from, to)
    }
  }
  visit(folder)
}

export type BasePreparation = 'setup' | 'reused' | 'installed' | 'nothing to install'

export interface BuildBaseOptions {
  /** The project folder of the head (where `dta diff` runs). */
  cwd: string
  worktree: BaseWorktree
  setup?: string
  build?: string
  /** Runs a command (tests replace it). */
  run?: (command: string, cwd: string) => string
  log?: (text: string) => void
}

/**
 * Prepares and builds the base in its worktree (TICKET-127). `setup` always wins. Without it:
 * when the lockfile is byte-identical to the head's, the head's `node_modules` folders are linked
 * in (falling back to a clean install when the build then fails); otherwise the lockfile's clean
 * install runs (`npm ci`, `pnpm install --frozen-lockfile`, …). A build that still fails throws
 * BaseBuildError, so the run stops instead of counting every story as added.
 */
export function buildBase(options: BuildBaseOptions): BasePreparation {
  const run = options.run ?? runCommand
  const log = options.log ?? (() => undefined)
  const { worktree } = options
  const build = () => {
    if (options.build) run(options.build, worktree.projectDir)
  }
  const attempt = (step: () => void) => {
    try {
      step()
    } catch (error) {
      if (error instanceof CommandFailedError) throw new BaseBuildError(error)
      throw error
    }
  }

  if (options.setup) {
    attempt(() => run(options.setup as string, worktree.root))
    attempt(build)
    return 'setup'
  }

  const headRoot = gitOutput(options.cwd, ['rev-parse', '--show-toplevel'])?.trim()
  const lock = headRoot ? findLockfile(headRoot, path.resolve(options.cwd)) : null
  if (!headRoot || !lock) {
    attempt(build)
    return 'nothing to install'
  }
  const headLock = path.join(headRoot, lock.folder, lock.file)
  const baseFolder = path.join(worktree.root, lock.folder)
  const baseLock = path.join(baseFolder, lock.file)
  const install = () => {
    const command = installCommand(lock.manager, baseFolder)
    log(`Installing the base: ${command}`)
    run(command, baseFolder)
  }

  const identical =
    fs.existsSync(baseLock) && fs.readFileSync(baseLock).equals(fs.readFileSync(headLock))
  const folders = identical ? nodeModulesFolders(headRoot) : []
  if (folders.length === 0) {
    attempt(() => {
      if (fs.existsSync(baseLock)) install()
      build()
    })
    return fs.existsSync(baseLock) ? 'installed' : 'nothing to install'
  }

  const links: string[] = []
  for (const folder of folders) {
    const target = path.join(worktree.root, folder)
    if (!fs.existsSync(path.dirname(target)) || fs.existsSync(target)) continue
    linkPackages(headRoot, worktree.root, folder)
    links.push(target)
  }
  log(`Reusing the head's node_modules: the lockfile did not change`)
  try {
    build()
    return 'reused'
  } catch (error) {
    if (!(error instanceof CommandFailedError)) throw error
    // Linked packages do not fit every setup (native builds, pnpm's store): install cleanly.
    log('The base did not build with the linked node_modules; installing instead.')
    for (const link of links) fs.rmSync(link, { recursive: true, force: true })
    attempt(() => {
      install()
      build()
    })
    return 'installed'
  }
}
