import { analyzeStructure, LOW_CONFIDENCE } from '@dta/core'
import type { StructureAnalysis } from '@dta/core'
import { variablesToModel } from '@dta/figma'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { describeFigmaError, figmaClientFor } from '../figma-client.js'
import { banner, createUi } from '../ui.js'

const EXIT_NO_CREDENTIALS = 2

const padRight = (text: string, length: number) =>
  text.length >= length ? text : text + ' '.repeat(length - text.length)

export function formatStructureReport(result: StructureAnalysis): string {
  const rule = '─'.repeat(90)
  const lines: string[] = ['', 'Collection Analysis', rule]
  lines.push(
    [
      padRight('Collection', 30),
      padRight('Vars', 7),
      padRight('Alias%', 8),
      padRight('Modes', 7),
      padRight('Inferred Role', 16),
      padRight('Conf.', 6),
    ].join(''),
    rule,
  )

  for (const c of result.collections) {
    const warning = c.confidence < LOW_CONFIDENCE ? ' ⚠' : ''
    lines.push(
      [
        padRight(c.name, 30),
        padRight(String(c.variableCount), 7),
        padRight(`${Math.round(c.aliasRatio * 100)}%`, 8),
        padRight(String(c.modeCount), 7),
        padRight(c.inferredRole, 16),
        padRight(c.confidence.toFixed(2), 6),
      ].join('') + warning,
    )
  }
  lines.push(rule)

  for (const c of result.collections) {
    for (const note of c.notes) lines.push(`⚠ "${c.name}" — ${note}`)
  }

  if (result.suggestedCollections.length > 0) {
    lines.push('', 'Suggested config:')
    lines.push(`  collections: [${result.suggestedCollections.map((c) => `'${c}'`).join(', ')}]`)
    if (result.suggestedBrands.length > 0) {
      lines.push(`  brands: [${result.suggestedBrands.map((b) => `'${b}'`).join(', ')}]`)
    }
  }
  lines.push('')
  return lines.join('\n')
}

export async function runAnalyze(context: CommandContext): Promise<number> {
  const ui = createUi(context.stdout)
  const figma = context.config?.figma
  ui.intro(banner('analyze'))

  if (context.options.verbose) ui.log.message(`${pc.dim('File:')} ${figma?.fileKey}`)

  if (!figma?.personalAccessToken || !figma.fileKey) {
    ui.log.error('Figma API credentials are required for analyze.')
    return EXIT_NO_CREDENTIALS
  }

  const spinner = ui.spinner()
  spinner.start('Fetching variables from Figma...')
  let analysis: StructureAnalysis
  try {
    const response = await figmaClientFor(figma.personalAccessToken).getLocalVariables(
      figma.fileKey,
    )
    analysis = analyzeStructure(variablesToModel(response).model)
  } catch (error) {
    spinner.stop('Could not fetch variables from Figma')
    const message = describeFigmaError(error)
    if (message === null) throw error
    ui.log.error(message)
    return 1
  }

  const total = analysis.collections.length
  spinner.stop(`Found ${pc.bold(String(total))} variable collection${total === 1 ? '' : 's'}`)

  if (total === 0) {
    ui.log.warn('No local variable collections found in this file.')
    ui.outro('Nothing to analyze.')
    return 0
  }

  ui.log.info(formatStructureReport(analysis))
  if (analysis.suggestedCollections.length > 0) {
    ui.note(analysis.suggestedCollections.join(', '), 'Discovered collections')
  }
  if (analysis.suggestedBrands.length > 0) {
    ui.note(analysis.suggestedBrands.join(', '), 'Detected brands')
  }
  ui.outro('Analysis complete!')
  return 0
}
