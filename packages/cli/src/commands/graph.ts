import fs from 'node:fs'
import path from 'node:path'
import { analyzeGraph, parseTokenFiles } from '@dta/core'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { formatDiagnostic, hasErrors } from '../io/diagnostics.js'
import { readTokenDir, TokenDirError } from '../io/token-dir.js'
import { inLegacyOrder } from '../graph/shared.js'
import { formatConsoleReport } from '../graph/console.js'
import { formatDotGraph } from '../graph/dot.js'
import { generateHtmlVisualization } from '../graph/html.js'
import { formatMarkdownReport } from '../graph/markdown.js'
import { banner, createUi, filePath } from '../ui.js'

const FORMATS = ['console', 'dot', 'markdown', 'html'] as const
type Format = (typeof FORMATS)[number]

export async function runGraph(context: CommandContext): Promise<number> {
  const ui = createUi(context.stdout)
  const tokensDir = context.config?.tokens.dir ?? 'tokens'
  const requested = String(context.options.format ?? 'console')
  const output = typeof context.options.output === 'string' ? context.options.output : undefined
  ui.intro(banner('graph'))

  if (!FORMATS.includes(requested as Format)) {
    ui.log.error(`Unknown format "${requested}". Use one of: ${FORMATS.join(', ')}.`)
    return 1
  }
  const format = requested as Format

  let files
  try {
    files = readTokenDir(tokensDir, context.cwd)
  } catch (error) {
    if (error instanceof TokenDirError) {
      ui.log.error(error.message)
      return 1
    }
    throw error
  }

  const spinner = ui.spinner()
  spinner.start('Reading token files...')
  const { model, diagnostics } = parseTokenFiles(files)
  spinner.message('Building dependency graph...')
  const graph = inLegacyOrder(analyzeGraph(model))
  spinner.stop('Graph built')

  if (hasErrors(diagnostics)) {
    for (const diagnostic of diagnostics) ui.log.error(formatDiagnostic(diagnostic))
    return 1
  }

  const stats = graph.stats
  if (format !== 'dot') {
    ui.log.message(
      pc.dim('Tokens: ') +
        stats.totalTokens.toLocaleString() +
        pc.dim(' | Aliases: ') +
        stats.aliasTokens.toLocaleString() +
        ` (${stats.aliasPercentage}%)` +
        pc.dim(' | Max depth: ') +
        stats.maxChainDepth +
        pc.dim(' | Issues: ') +
        (stats.danglingAliases + stats.circularRefs > 0
          ? pc.yellow(String(stats.danglingAliases + stats.circularRefs))
          : pc.green('0')),
    )
  }

  const write = (file: string, content: string) => {
    const target = path.resolve(context.cwd, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content, 'utf8')
  }

  switch (format) {
    case 'console':
      context.stdout('\n' + formatConsoleReport(graph) + '\n')
      break
    case 'dot': {
      const dot = formatDotGraph(graph)
      if (output) {
        write(output, dot)
        ui.log.success(`DOT file written to ${filePath(output)}`)
      } else {
        context.stdout(dot + '\n')
      }
      break
    }
    case 'markdown': {
      const markdown = formatMarkdownReport(graph)
      if (output) {
        write(output, markdown)
        ui.log.success(`Markdown report written to ${filePath(output)}`)
      } else {
        context.stdout('\n' + markdown + '\n')
      }
      break
    }
    case 'html': {
      const target = output ?? path.join(tokensDir, '..', 'token-graph.html')
      write(target, generateHtmlVisualization(graph))
      ui.log.success(`HTML visualization written to ${filePath(target)}`)
      context.openFile(path.resolve(context.cwd, target))
      break
    }
  }

  if (stats.danglingAliases > 0) {
    ui.log.warn(
      pc.yellow(`${stats.danglingAliases} dangling alias(es) found`) +
        pc.dim(" — these reference tokens that don't exist"),
    )
  }
  if (stats.circularRefs > 0) {
    ui.log.error(
      pc.red(`${stats.circularRefs} circular reference(s) detected`) +
        pc.dim(' — these will cause infinite loops during resolution'),
    )
  }

  ui.outro(format === 'html' ? 'Opening visualization in browser...' : 'Done!')
  return 0
}
