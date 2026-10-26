import fs from 'node:fs'
import path from 'node:path'
import type { TokenModel } from '@dta/core'
import type { Config } from '../config/schema.js'
import { packageVersion } from '../version.js'
import { CONTEXT_MARKER, renderDesignMd, updateAgentsMd } from './render.js'

/** The context file when neither `--out` nor `context.out` names one. */
export const DEFAULT_CONTEXT_FILE = 'DESIGN.md'
const AGENTS_FILE = 'AGENTS.md'

export interface ContextFile {
  /** Relative to the project, with forward slashes. */
  path: string
  content: string
  /** The content on disk, null when the file does not exist. */
  existing: string | null
}

/** The context file and `AGENTS.md` as `dta context` would write them, next to what is on disk. */
export function planContext(
  cwd: string,
  model: TokenModel,
  config: Config | null,
  out: string,
): { design: ContextFile; agents: ContextFile } {
  const read = (file: string) => {
    const absolute = path.resolve(cwd, file)
    return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null
  }
  const designPath = path.relative(cwd, path.resolve(cwd, out)).split(path.sep).join('/')
  const agentsExisting = read(AGENTS_FILE)
  return {
    design: {
      path: designPath,
      content: renderDesignMd(model, config, { version: packageVersion() }),
      existing: read(designPath),
    },
    agents: {
      path: AGENTS_FILE,
      content: updateAgentsMd(agentsExisting, designPath),
      existing: agentsExisting,
    },
  }
}

export class ContextConflictError extends Error {}

/** Writes the files that changed; returns their paths. Refuses to overwrite a foreign file. */
export function writeContext(cwd: string, plan: ReturnType<typeof planContext>): string[] {
  const { design, agents } = plan
  if (design.existing !== null && !design.existing.includes(CONTEXT_MARKER)) {
    throw new ContextConflictError(
      `${design.path} exists and was not written by dta context, so it is left as it is. Move it, or write the context elsewhere with --out (or context.out in the config).`,
    )
  }
  const written: string[] = []
  for (const file of [design, agents]) {
    if (file.existing === file.content) continue
    const absolute = path.resolve(cwd, file.path)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, file.content)
    written.push(file.path)
  }
  return written
}
