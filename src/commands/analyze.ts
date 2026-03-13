/**
 * TICKET-014: `figma-tokens analyze` command.
 *
 * Fetches variable collections from Figma and runs structure autodiscovery.
 * Outputs a table of inferred layer roles and a suggested config block.
 */

import { Config } from '../config/index.js'
import FigmaApi from '../figma_api.js'
import { analyzeCollections, formatAnalysisReport } from '../analyze.js'
import { green } from '../utils.js'

export interface AnalyzeOptions {
  verbose?: boolean
}

export async function runAnalyze(config: Config, options: AnalyzeOptions): Promise<void> {
  if (options.verbose) {
    console.log(`Analyzing Figma file: ${config.figma.fileKey}`)
  }

  const api = new FigmaApi(config.figma.personalAccessToken)

  console.log('Fetching variables from Figma...')
  const localVariables = await api.getLocalVariables(config.figma.fileKey)

  const result = analyzeCollections(localVariables)

  console.log(formatAnalysisReport(result))

  if (result.collections.length === 0) {
    console.log('No local variable collections found in this file.')
    return
  }

  console.log(green('Analysis complete.'))
}
