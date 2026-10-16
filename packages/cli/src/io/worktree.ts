import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface BaseWorktree {
  /** Root of the temporary checkout. */
  root: string
  /** The project folder inside it (same place relative to the repo as `cwd`). */
  projectDir: string
  remove(): void
}

const git = (cwd: string, args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/**
 * Checks out `sha` in a temporary git worktree, leaving the working tree of `cwd` untouched.
 * Call `remove()` when done (also after failures).
 */
export function createBaseWorktree(cwd: string, sha: string): BaseWorktree {
  const prefix = git(cwd, ['rev-parse', '--show-prefix'])
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dta-diff-base-'))
  git(cwd, ['worktree', 'add', '--detach', '--force', root, sha])
  return {
    root,
    projectDir: path.join(root, prefix),
    remove() {
      try {
        git(cwd, ['worktree', 'remove', '--force', root])
      } catch {
        fs.rmSync(root, { recursive: true, force: true })
        try {
          git(cwd, ['worktree', 'prune'])
        } catch {
          // nothing left to clean up
        }
      }
    },
  }
}
