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

  if (Object.keys(result.suggestedLayers).length > 0) {
    const sl = result.suggestedLayers
    const lines: string[] = []
    if (sl.primitives) lines.push(`${pc.cyan('primitives')}  ${pc.dim('\u2192')}  ${sl.primitives}`)
    if (sl.brand) lines.push(`${pc.cyan('brand')}       ${pc.dim('\u2192')}  ${sl.brand}`)
    if (sl.dimension) lines.push(`${pc.cyan('dimension')}   ${pc.dim('\u2192')}  ${sl.dimension}`)
    p.note(lines.join('\n'), 'Suggested layer mapping')
  }

  if (result.suggestedBrands.length > 0) {
    p.note(result.suggestedBrands.join(', '), 'Detected brands')
  }

  p.outro('Analysis complete!')
}
