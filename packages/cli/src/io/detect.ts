import fs from 'node:fs'
import path from 'node:path'
import { defaultBranch, gitOutput } from './diff-base.js'

/**
 * A detected setting and where it came from ("pnpm-lock.yaml"), or null with why it was not
 * found. Detection never guesses: what is not in the project's files is reported as not found.
 */
export type Found<T> = { value: T; source: string } | { value: null; source: string }

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export interface ProjectDetection {
  /** The project's Storybook: its build script and output folder. */
  storybook: Found<{ script: string | null; outDir: string }>
  packageManager: Found<PackageManager>
  /** Node version as written (`22`, `>=20`, `v22.11.0`). */
  node: Found<string>
  /** The command that builds the static output `dta diff` renders. */
  build: Found<string>
  /** Whether that build script already runs `dta build` (then init does not add it, TICKET-145). */
  buildRunsDta: boolean
  /** The command that installs the dependencies exactly as the lockfile pins them. */
  install: Found<string>
  /**
   * Where the lockfile is, relative to the project folder (`.`, or `../..` in a workspace
   * package): the install runs there. Absent when there is no lockfile.
   */
  lockfile: Found<{ file: string; dir: string }>
  /** The pnpm version from packageManager in package.json, when pnpm is the manager and says. */
  pnpmVersion: string | null
  git: {
    host: Found<'github' | 'other'>
    /** The default branch, as `dta diff` finds its base (`main`, from origin/HEAD). */
    defaultBranch: Found<string>
  }
}

const LOCKFILES: ReadonlyArray<[string, PackageManager]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
]

interface PackageJson {
  packageManager?: unknown
  engines?: { node?: unknown }
  scripts?: Record<string, unknown>
}

function readPackageJson(cwd: string): PackageJson | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'))
    return typeof parsed === 'object' && parsed !== null ? (parsed as PackageJson) : null
  } catch {
    return null
  }
}

const exists = (cwd: string, file: string) => fs.existsSync(path.join(cwd, file))
const notFound = <T>(source: string): Found<T> => ({ value: null, source })

/** The command that runs a package.json script with a package manager. */
export function runScript(manager: PackageManager, script: string): string {
  return manager === 'npm' ? `npm run ${script}` : `${manager} run ${script}`
}

/** The install command that keeps the lockfile as it is (a clean, reproducible install). */
export function installCommand(manager: PackageManager, cwd?: string): string {
  if (manager === 'npm') return 'npm ci'
  if (manager === 'pnpm') return 'pnpm install --frozen-lockfile'
  if (manager === 'bun') return 'bun install --frozen-lockfile'
  // Yarn 2+ (a .yarnrc.yml) renamed the flag.
  return cwd && exists(cwd, '.yarnrc.yml')
    ? 'yarn install --immutable'
    : 'yarn install --frozen-lockfile'
}

/**
 * The folders from the project up to the repository root (or the project alone outside git):
 * a workspace package finds the lockfile and the Node version at the root.
 */
function upToRoot(cwd: string): string[] {
  const root = gitOutput(cwd, ['rev-parse', '--show-toplevel'])?.trim()
  const folders = [path.resolve(cwd)]
  if (!root) return folders
  let current = folders[0]
  while (current !== path.resolve(root) && path.dirname(current) !== current) {
    current = path.dirname(current)
    folders.push(current)
  }
  return folders
}

/** `pnpm-lock.yaml`, or `../../pnpm-lock.yaml` from a workspace package. */
const shown = (cwd: string, folder: string, file: string) =>
  path.relative(cwd, path.join(folder, file)).split(path.sep).join('/')

function detectLockfile(cwd: string, folders: string[]) {
  for (const folder of folders) {
    for (const [file, manager] of LOCKFILES) {
      if (fs.existsSync(path.join(folder, file))) {
        const dir = path.relative(cwd, folder).split(path.sep).join('/') || '.'
        return { file, manager, dir, source: shown(cwd, folder, file) }
      }
    }
  }
  return null
}

function packageManagerField(folders: string[]): { name: string; version: string } | null {
  for (const folder of folders) {
    const pkg = readPackageJson(folder)
    if (typeof pkg?.packageManager === 'string') {
      const [name, version = ''] = pkg.packageManager.split('@')
      return { name, version: version.split('+')[0] }
    }
  }
  return null
}

function detectPackageManager(
  lock: ReturnType<typeof detectLockfile>,
  field: ReturnType<typeof packageManagerField>,
): Found<PackageManager> {
  if (lock) return { value: lock.manager, source: lock.source }
  const name = field?.name
  if (name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun')
    return { value: name, source: 'packageManager in package.json' }
  return notFound('no lockfile and no packageManager in package.json')
}

function detectNode(cwd: string, folders: string[], pkg: PackageJson | null): Found<string> {
  for (const folder of folders) {
    for (const file of ['.nvmrc', '.node-version']) {
      if (!fs.existsSync(path.join(folder, file))) continue
      const version = fs.readFileSync(path.join(folder, file), 'utf8').trim()
      if (version) return { value: version, source: shown(cwd, folder, file) }
    }
  }
  const engines = pkg?.engines?.node
  if (typeof engines === 'string' && engines.trim())
    return { value: engines.trim(), source: 'engines.node in package.json' }
  return notFound('no .nvmrc, .node-version or engines.node')
}

/** `-o out` or `--output-dir out` in a `storybook build` command, else Storybook's default. */
function storybookOutDir(script: string): string {
  const match = /(?:^|\s)(?:-o|--output-dir)(?:\s+|=)(["']?)([^\s"']+)\1/.exec(script)
  return match ? match[2] : 'storybook-static'
}

function detectStorybook(
  cwd: string,
  pkg: PackageJson | null,
): Found<{ script: string | null; outDir: string }> {
  const scripts = Object.entries(pkg?.scripts ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  )
  // The conventional name first, then a script that runs `storybook build` (also through npx or
  // a version: `npx storybook@8 build`, `sb build`); not one that only names the script.
  const entry =
    scripts.find(([name]) => name === 'build-storybook') ??
    scripts.find(([, command]) =>
      /(?:^|&&|;|\|\||\s)(?:npx\s+|pnpm\s+(?:exec\s+)?|yarn\s+)?(?:storybook(?:@\S+)?|sb)\s+build\b/.test(
        command,
      ),
    )
  if (entry) {
    const [name, command] = entry as [string, string]
    return {
      value: { script: name, outDir: storybookOutDir(command) },
      source: `the "${name}" script in package.json`,
    }
  }
  if (exists(cwd, '.storybook'))
    return {
      value: { script: null, outDir: 'storybook-static' },
      source: '.storybook/ (no build script)',
    }
  return notFound('no .storybook/ folder and no Storybook build script')
}

function detectGit(cwd: string): ProjectDetection['git'] {
  const url = gitOutput(cwd, ['remote', 'get-url', 'origin'])?.trim()
  const host: Found<'github' | 'other'> = url
    ? { value: /github\.com[:/]/.test(url) ? 'github' : 'other', source: 'the origin remote' }
    : notFound(
        gitOutput(cwd, ['rev-parse', '--git-dir']) === null
          ? 'not a git repository'
          : 'no origin remote',
      )
  const branch = defaultBranch(cwd)
  const defaultBranchFound: Found<string> = branch
    ? {
        value: branch.replace(/^origin\//, ''),
        source: branch.startsWith('origin/') ? 'the origin remote' : 'the local branches',
      }
    : notFound('no origin/HEAD, main or master')
  return { host, defaultBranch: defaultBranchFound }
}

/** `dta build` in a script, also through npx, pnpm, yarn or bunx, or as design-token-authority. */
const RUNS_DTA_BUILD =
  /(?:^|&&|;|\|\||\s)(?:npx\s+|pnpm\s+(?:exec\s+)?|yarn\s+|bunx\s+)?(?:dta|design-token-authority)(?:@\S+)?\s+build\b/

/**
 * What `dta init` and `dta diff --check` need to know about a project, read from its files and
 * git metadata only: no network, no installs (TICKET-126).
 */
export function detectProject(cwd: string): ProjectDetection {
  const pkg = readPackageJson(cwd)
  const folders = upToRoot(cwd)
  const lock = detectLockfile(cwd, folders)
  const field = packageManagerField(folders)
  const packageManager = detectPackageManager(lock, field)
  const storybook = detectStorybook(cwd, pkg)
  const manager = packageManager.value
  const scripts = pkg?.scripts ?? {}

  let build: Found<string>
  let buildScript: string | null = null
  if (!manager) build = notFound('no package manager found')
  else if (storybook.value?.script) {
    build = { value: runScript(manager, storybook.value.script), source: storybook.source }
    const script = scripts[storybook.value.script]
    buildScript = typeof script === 'string' ? script : null
  } else if (typeof scripts.build === 'string') {
    build = { value: runScript(manager, 'build'), source: 'the "build" script in package.json' }
    buildScript = scripts.build
  } else build = notFound('no Storybook build script and no "build" script')

  return {
    storybook,
    packageManager,
    node: detectNode(cwd, folders, pkg),
    build,
    buildRunsDta: buildScript !== null && RUNS_DTA_BUILD.test(buildScript),
    install: manager
      ? {
          value: installCommand(manager, lock ? path.join(cwd, lock.dir) : cwd),
          source: packageManager.source,
        }
      : notFound('no package manager found'),
    lockfile: lock
      ? { value: { file: lock.file, dir: lock.dir }, source: lock.source }
      : notFound('no lockfile'),
    pnpmVersion:
      manager === 'pnpm' && field?.name === 'pnpm' && field.version ? field.version : null,
    git: detectGit(cwd),
  }
}

/** `pnpm, from pnpm-lock.yaml` / `not found (no lockfile …)`: how init prints a result. */
export function describeFound<T>(found: Found<T>, show: (value: T) => string = String): string {
  return found.value === null
    ? `not found (${found.source})`
    : `${show(found.value)}, from ${found.source}`
}
