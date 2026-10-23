import { isTokenFileName } from '@dta/core'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { TokenFileInput } from '@dta/core'
import type { DiffHead } from '@dta/visual-diff'
import { readTokenDir } from './token-dir.js'

/** The base of `dta diff` could not be found or read. */
export class DiffBaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DiffBaseError'
  }
}

export interface DiffBase {
  files: TokenFileInput[]
  /** How the base was chosen, for reports, e.g. `merge base with origin/main (1a2b3c4)`. */
  label: string
  /** The commit, when the base came from git (a directory base has none). */
  sha?: string
}

/** A git command's output, or null when it fails (no repository, unknown ref, …). */
export function gitOutput(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 256 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

const git = gitOutput

const shortSha = (sha: string) => sha.slice(0, 7)

/** `origin/HEAD`'s target, else the first of the usual default branch names that exists. */
export function defaultBranch(cwd: string): string | null {
  const head = git(cwd, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
  if (head?.trim()) return head.trim()
  for (const candidate of ['origin/main', 'main', 'origin/master', 'master']) {
    if (git(cwd, ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`])) return candidate
  }
  return null
}

/**
 * Reads the token files of `tokensDir` (relative to `cwd`) as they are at a commit, without
 * checking anything out. A missing directory at that commit means "no tokens yet".
 */
function readTokensAtCommit(cwd: string, sha: string, tokensDir: string): TokenFileInput[] {
  const prefix = (git(cwd, ['rev-parse', '--show-prefix']) ?? '').trim()
  const dir = path.posix.normalize(path.posix.join(prefix, tokensDir.split(path.sep).join('/')))
  const list = () =>
    (git(cwd, ['ls-tree', '-z', '-r', '--full-tree', '--name-only', sha, '--', `${dir}/`]) ?? '')
      .split('\0')
      .filter(Boolean)
      .map((entry) => (entry.startsWith(`${dir}/`) ? entry.slice(dir.length + 1) : entry))
  // As readTokenDir: with a resolver document (at any depth), the files in folders below are
  // read too.
  const all = list()
  const nested = all.some((name) => name.endsWith('.resolver.json'))
  return (nested ? all : all.filter((name) => !name.includes('/')))
    .filter((name) => {
      const base = name.split('/').pop() ?? ''
      return isTokenFileName(base) || base.endsWith('.resolver.json')
    })
    .sort()
    .map((fileName) => {
      const content = git(cwd, ['show', `${sha}:${dir}/${fileName}`])
      if (content === null) throw new DiffBaseError(`Could not read ${dir}/${fileName} at ${sha}.`)
      return { fileName, content }
    })
    .filter((file) => file.content.trim() !== '')
}

/**
 * Finds the base token files for `dta diff`: a directory of token files, a git ref, or (when
 * nothing is given) the merge base of `HEAD` and the default branch.
 */
export function resolveDiffBase(cwd: string, tokensDir: string, base?: string): DiffBase {
  if (base !== undefined) {
    const asDir = path.resolve(cwd, base)
    if (fs.existsSync(asDir) && fs.statSync(asDir).isDirectory()) {
      return { files: readTokenDir(base, cwd), label: base }
    }
  }

  if (git(cwd, ['rev-parse', '--show-toplevel']) === null) {
    throw new DiffBaseError(
      base === undefined
        ? 'Not inside a git repository, so there is no default base. Pass --base <dir>.'
        : `"${base}" is not a directory, and this is not a git repository.`,
    )
  }

  if (base !== undefined) {
    const sha = git(cwd, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`])?.trim()
    if (!sha) throw new DiffBaseError(`"${base}" is neither a directory nor a git ref.`)
    return {
      files: readTokensAtCommit(cwd, sha, tokensDir),
      label: `${base} (${shortSha(sha)})`,
      sha,
    }
  }

  const branch = defaultBranch(cwd)
  if (!branch) {
    throw new DiffBaseError(
      'Could not find the default branch (origin/HEAD, main or master). Pass --base <ref|dir>.',
    )
  }
  const sha = git(cwd, ['merge-base', 'HEAD', branch])?.trim()
  if (!sha) throw new DiffBaseError(`HEAD has no merge base with ${branch}. Pass --base <ref|dir>.`)
  return {
    files: readTokensAtCommit(cwd, sha, tokensDir),
    label: `merge base with ${branch} (${shortSha(sha)})`,
    sha,
  }
}

/**
 * The checkout `dta diff` renders as "with this change" (TICKET-123): the branch (if any), the
 * commit and whether the repository has uncommitted changes, tracked or untracked (not ignored),
 * anywhere in the repository. Outside git, or before the first commit, there is none.
 */
export function resolveDiffHead(cwd: string): DiffHead | undefined {
  const sha = git(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'])?.trim()
  if (!sha) return undefined
  const ref = git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'])?.trim()
  const status = git(cwd, ['status', '--porcelain', '--untracked-files=normal'])
  return { ...(ref ? { ref } : {}), sha, uncommitted: Boolean(status?.trim()) }
}
