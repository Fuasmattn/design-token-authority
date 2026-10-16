import fs from 'node:fs'
import path from 'node:path'
import type { TokenFileInput } from '@dta/core'

/** The tokens directory is missing or unreadable. */
export class TokenDirError extends Error {
  constructor(readonly directory: string) {
    super(
      `Tokens directory "${directory}" not found.\nRun dta pull to export tokens from Figma first.`,
    )
    this.name = 'TokenDirError'
  }
}

/**
 * Reads the `*.json` token files of a directory (relative paths resolve against `cwd`),
 * sorted by name. Blank files are skipped, as in the legacy CLI.
 */
export function readTokenDir(directory: string, cwd: string): TokenFileInput[] {
  const absolute = path.resolve(cwd, directory)
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    throw new TokenDirError(directory)
  }
  return fs
    .readdirSync(absolute)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => ({
      fileName,
      content: fs.readFileSync(path.join(absolute, fileName), 'utf8'),
    }))
    .filter((file) => file.content.trim() !== '')
}
