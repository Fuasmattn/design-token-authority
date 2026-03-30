/**
 * `dta clean` command.
 *
 * Removes all token JSON files and build output directories so the project
 * can be rebuilt from scratch.
 */

import fs from 'node:fs'
import path from 'node:path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { Config } from '../config/index.js'
import { banner } from '../theme.js'

export interface CleanOptions {
  verbose?: boolean
}

export async function runClean(config: Config, options: CleanOptions): Promise<void> {
  p.intro(banner('clean'))

  const removed: string[] = []
  const tokensDir = config.tokens?.dir ?? 'tokens'

  // Remove token JSON files
  if (fs.existsSync(tokensDir)) {
    const files = fs.readdirSync(tokensDir).filter((f) => f.endsWith('.json'))
    for (const f of files) {
      fs.rmSync(path.join(tokensDir, f))
      removed.push(`${tokensDir}/${f}`)
    }
    if (options.verbose && files.length > 0) {
      p.log.message(`Removed ${files.length} token file(s) from ${tokensDir}/`)
    }
  }

  // Collect output directories to remove
  const outputDirs = new Set<string>()

  // Add configured output dirs
  if (config.outputs?.css?.outDir) outputDirs.add(config.outputs.css.outDir)
  if (config.outputs?.tailwind?.outDir) outputDirs.add(config.outputs.tailwind.outDir)
  if (config.outputs?.ios?.outDir) outputDirs.add(config.outputs.ios.outDir)
  if (config.outputs?.android?.outDir) outputDirs.add(config.outputs.android.outDir)

  // Always include default output root and its subdirs
  for (const dir of ['output', 'output/css', 'output/js', 'output/tailwind', 'output/docs']) {
    outputDirs.add(dir)
  }

  // Remove the top-level output directory (covers all subdirs at once)
  // Then remove any configured dirs that live outside of output/
  const topLevelDirs = new Set<string>()
  for (const dir of outputDirs) {
    const top = dir.split('/')[0]
    topLevelDirs.add(top)
  }

  for (const dir of topLevelDirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      removed.push(`${dir}/`)
    }
  }

  if (removed.length > 0) {
    p.note(removed.map((t) => pc.dim(t)).join('\n'), 'Removed')
  } else {
    p.log.message('Nothing to clean.')
  }

  p.outro('Clean complete!')
}
