/**
 * TICKET-007: `dtf pull` command.
 *
 * Exports variables from Figma to local JSON token files.
 * Wraps the logic previously in sync_figma_to_tokens.ts.
 */

import * as fs from 'fs'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { Config } from '../config/index.js'
import FigmaApi from '../figma_api.js'
import { tokenFilesFromLocalVariables } from '../token_export.js'

export interface PullOptions {
  output?: string
  verbose?: boolean
}

export async function runPull(config: Config, options: PullOptions): Promise<void> {
  const outputDir = options.output ?? config.tokens?.dir ?? 'tokens'

  p.intro(pc.bgCyan(pc.black(' dtf pull ')))

  if (options.verbose) {
    p.log.message(
      `${pc.dim('File:')} ${config.figma.fileKey}\n${pc.dim('Output:')} ${outputDir}`,
    )
  }

  const s = p.spinner()
  s.start('Fetching variables from Figma...')

  const api = new FigmaApi(config.figma.personalAccessToken)
  const localVariables = await api.getLocalVariables(config.figma.fileKey)
  const tokensFiles = tokenFilesFromLocalVariables(localVariables)

  const fileCount = Object.keys(tokensFiles).length
  s.stop(`Received ${fileCount} token file${fileCount !== 1 ? 's' : ''} from Figma`)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  Object.entries(tokensFiles).forEach(([fileName, fileContent]) => {
    const trimmedFileName = fileName.replace(' ', '')
    fs.writeFileSync(`${outputDir}/${trimmedFileName}`, JSON.stringify(fileContent, null, 2))
    p.log.step(`Wrote ${pc.dim(trimmedFileName)}`)
  })

  p.outro(`Tokens written to ${pc.cyan(outputDir + '/')}`)
}
