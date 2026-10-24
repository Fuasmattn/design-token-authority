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
 * The token files of a directory (an absolute path), relative to it and sorted: `*.json` and
 * `*.tokens` files, and DTCG resolver documents (`*.resolver.json`). When there is a resolver
 * document (in the directory or a folder below), the files in the folders below count too (as
 * `folder/file.json`), since it may name them.
 */
export function listTokenFiles(absolute: string): string[] {
  const all: string[] = []
  const walk = (folder: string, prefix: string) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules')
          walk(path.join(folder, entry.name), `${name}/`)
      } else if (isTokenFileName(entry.name) || entry.name.endsWith('.resolver.json')) {
        all.push(name)
      }
    }
  }
  walk(absolute, '')
  const nested = all.some((name) => name.endsWith('.resolver.json'))
  return (nested ? all : all.filter((name) => !name.includes('/'))).sort()
}

/**
 * Reads the token files of a directory (relative paths resolve against `cwd`): the files
 * {@link listTokenFiles} lists. Blank files are skipped, as in the v1 CLI.
 */
export function readTokenDir(directory: string, cwd: string): TokenFileInput[] {
  const absolute = path.resolve(cwd, directory)
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    throw new TokenDirError(directory)
  }
  return listTokenFiles(absolute)
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
