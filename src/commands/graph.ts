/**
 * TICKET-017: `dtf graph` command.
 *
 * Builds and visualizes the token alias dependency graph.
 * Detects circular references, dangling aliases, and orphaned tokens.
 *
 * Output formats:
 *   --format console  (default) — summary table in the terminal
 *   --format dot      — Graphviz DOT format
 *   --format markdown — Markdown table
 *   --format html     — Interactive HTML visualization (opens in browser)
 */

import * as fs from 'fs'
import * as path from 'path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { Config } from '../config/index.js'
import {
  readTokenFilesForGraph,
  buildGraph,
  computeStats,
  formatConsoleReport,
  formatDotGraph,
  formatMarkdownReport,
  generateHtmlVisualization,
} from '../graph.js'

export interface GraphOptions {
  verbose?: boolean
  format?: 'console' | 'dot' | 'markdown' | 'html'
  output?: string
}

export async function runGraph(config: Config, options: GraphOptions): Promise<void> {
  const tokensDir = config.tokens?.dir ?? 'tokens'
  const format = options.format ?? 'console'

  p.intro(pc.bgCyan(pc.black(' dtf graph ')))

  // Validate tokens dir exists
  if (!fs.existsSync(tokensDir)) {
    p.log.error(
      `Tokens directory "${tokensDir}" not found.\n` +
        pc.dim('Run ') +
        pc.cyan('dtf pull') +
        pc.dim(' to export tokens from Figma first.'),
    )
    process.exit(1)
  }

  const s = p.spinner()
  s.start('Reading token files...')

  const nodes = readTokenFilesForGraph(tokensDir)

  s.message('Building dependency graph...')

  const graph = buildGraph(nodes)
  const stats = computeStats(graph)

  s.stop('Graph built')

  // Summary always shown (except DOT which should be pipe-friendly)
  if (format !== 'dot') {
    p.log.message(
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

  switch (format) {
    case 'console': {
      const report = formatConsoleReport(graph, stats)
      console.log('\n' + report)
      break
    }

    case 'dot': {
      const dot = formatDotGraph(graph)
      if (options.output) {
        fs.writeFileSync(options.output, dot, 'utf-8')
        p.log.success(`DOT file written to ${pc.cyan(options.output)}`)
      } else {
        console.log(dot)
      }
      break
    }

    case 'markdown': {
      const md = formatMarkdownReport(graph, stats)
      if (options.output) {
        fs.writeFileSync(options.output, md, 'utf-8')
        p.log.success(`Markdown report written to ${pc.cyan(options.output)}`)
      } else {
        console.log('\n' + md)
      }
      break
    }

    case 'html': {
      const html = generateHtmlVisualization(graph, stats)
      const outFile = options.output ?? path.join(tokensDir, '..', 'token-graph.html')
      fs.writeFileSync(outFile, html, 'utf-8')
      p.log.success(`HTML visualization written to ${pc.cyan(outFile)}`)

      // Try to open in browser
      const { exec } = await import('child_process')
      const openCmd =
        process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
      exec(`${openCmd} "${outFile}"`)

      break
    }
  }

  // Show warnings for issues
  if (stats.danglingAliases > 0) {
    p.log.warn(
      pc.yellow(`${stats.danglingAliases} dangling alias(es) found`) +
        pc.dim(" — these reference tokens that don't exist"),
    )
  }
  if (stats.circularRefs > 0) {
    p.log.error(
      pc.red(`${stats.circularRefs} circular reference(s) detected`) +
        pc.dim(' — these will cause infinite loops during resolution'),
    )
  }

  p.outro(format === 'html' ? 'Opening visualization in browser...' : 'Done!')
}
