import fs from 'node:fs'
import path from 'node:path'
import { isTokenFileName } from '@dta/core'
import type { ParseOptions, TokenFileInput } from '@dta/core'
import type { Config } from '../config/schema.js'

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
 * Reads the token files of a directory (relative paths resolve against `cwd`), sorted by name:
 * `*.json` and `*.tokens` files, and DTCG resolver documents (`*.resolver.json`). When there is a
 * resolver document, the files in the folders below are read too (as `folder/file.json`), since
 * it may name them. Blank files are skipped, as in the v1 CLI.
 */
export function readTokenDir(directory: string, cwd: string): TokenFileInput[] {
  const absolute = path.resolve(cwd, directory)
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    throw new TokenDirError(directory)
  }
  const top = fs.readdirSync(absolute)
  const nested = top.some((name) => name.endsWith('.resolver.json'))
  const names: string[] = []
  const walk = (folder: string, prefix: string) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`
      if (entry.isDirectory()) {
        if (nested && !entry.name.startsWith('.') && entry.name !== 'node_modules')
          walk(path.join(folder, entry.name), `${name}/`)
      } else if (isTokenFileName(entry.name) || entry.name.endsWith('.resolver.json')) {
        names.push(name)
      }
    }
  }
  walk(absolute, '')
  return names
    .sort()
    .map((fileName) => ({
      fileName,
      content: fs.readFileSync(path.join(absolute, fileName), 'utf8'),
    }))
    .filter((file) => file.content.trim() !== '')
}

/** What `parseTokenFiles` needs from the config: the resolver document and modifier inputs. */
export function tokenParseOptions(config: Config | null | undefined): ParseOptions {
  return {
    ...(config?.tokens.resolver ? { resolver: config.tokens.resolver } : {}),
    ...(config?.modifiers ? { modifiers: config.modifiers } : {}),
  }
}
