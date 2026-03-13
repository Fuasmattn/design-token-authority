/**
 * TICKET-007: `figma-tokens pull` command.
 *
 * Exports variables from Figma to local JSON token files.
 * Wraps the logic previously in sync_figma_to_tokens.ts.
 */

import * as fs from 'fs'
import { Config } from '../config/index.js'
import FigmaApi from '../figma_api.js'
import { tokenFilesFromLocalVariables } from '../token_export.js'
import { green } from '../utils.js'

export interface PullOptions {
  output?: string
  verbose?: boolean
}

export async function runPull(config: Config, options: PullOptions): Promise<void> {
  const outputDir = options.output ?? config.tokens?.dir ?? 'tokens'

  if (options.verbose) {
    console.log(`Pulling tokens from Figma file: ${config.figma.fileKey}`)
    console.log(`Output directory: ${outputDir}`)
  }

  const api = new FigmaApi(config.figma.personalAccessToken)
  const localVariables = await api.getLocalVariables(config.figma.fileKey)

  const tokensFiles = tokenFilesFromLocalVariables(localVariables)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  Object.entries(tokensFiles).forEach(([fileName, fileContent]) => {
    const trimmedFileName = fileName.replace(' ', '')
    fs.writeFileSync(`${outputDir}/${trimmedFileName}`, JSON.stringify(fileContent, null, 2))
    console.log(`  Wrote ${trimmedFileName}`)
  })

  console.log(green(`\nTokens have been written to ${outputDir}/`))
}
