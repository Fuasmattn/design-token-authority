/**
 * TICKET-014: `dtf analyze` command.
 *
 * Fetches variable collections from Figma and runs structure autodiscovery.
 * Outputs a table of inferred layer roles and a suggested config block.
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { Config } from '../config/index.js'
import FigmaApi from '../figma_api.js'
import { analyzeCollections, formatAnalysisReport } from '../analyze.js'

export interface AnalyzeOptions {
  verbose?: boolean
}

export async function runAnalyze(config: Config, options: AnalyzeOptions): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' dtf analyze ')))

  if (options.verbose) {
    p.log.message(`${pc.dim('File:')} ${config.figma.fileKey}`)
  }

  if (!config.figma.personalAccessToken || !config.figma.fileKey) {
    p.log.error('Figma API credentials are required for analyze.')
    process.exit(2)
  }

  const api = new FigmaApi(config.figma.personalAccessToken)

  const s = p.spinner()
  s.start('Fetching variables from Figma...')

  const localVariables = await api.getLocalVariables(config.figma.fileKey)
  const result = analyzeCollections(localVariables)

  const count = result.collections.length
  s.stop(`Found ${count} variable collection${count !== 1 ? 's' : ''}`)

  if (count === 0) {
    p.log.warn('No local variable collections found in this file.')
    p.outro('Nothing to analyze.')
    return
  }

  p.log.info(formatAnalysisReport(result))

  if (result.suggestedCollections.length > 0) {
    p.note(result.suggestedCollections.join(', '), 'Discovered collections')
  }

  if (result.suggestedBrands.length > 0) {
    p.note(result.suggestedBrands.join(', '), 'Detected brands')
  }

  p.outro('Analysis complete!')
}
