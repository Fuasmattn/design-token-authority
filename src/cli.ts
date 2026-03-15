#!/usr/bin/env node

/**
 * TICKET-007: CLI entrypoint for design-token-farm (alias: dtf).
 *
 * Subcommands: pull, push, build, init, analyze
 * Global flags: --config, --verbose
 */

import 'dotenv/config'
import { Command } from 'commander'
import { loadConfig, ConfigValidationError } from './config/index.js'
import { runPull } from './commands/pull.js'
import { runPush } from './commands/push.js'
import { runBuild } from './commands/build.js'
import { runInit } from './commands/init.js'
import { runAnalyze } from './commands/analyze.js'
import { runGraph } from './commands/graph.js'
import { brightRed } from './utils.js'

// ---------------------------------------------------------------------------
// ASCII logo
// ---------------------------------------------------------------------------

const LOGO = `
   {\u00b7}      Design Token Farm
  { \u25c8 }     ~~~~~~~~~~~~~~~~~~~~
   {\u00b7}      Sync Figma variables
    |       to code, and back.
   _|_
  |___|
`

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function handleError(err: unknown): never {
  if (err instanceof ConfigValidationError) {
    console.error(brightRed(`\nValidation error: ${err.message}`))
    process.exit(2)
  }
  if (err instanceof Error) {
    console.error(brightRed(`\nError: ${err.message}`))
    if (process.env.DEBUG) {
      console.error(err.stack)
    }
  } else {
    console.error(brightRed(`\nUnexpected error: ${err}`))
  }
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

const program = new Command()

program
  .name('design-token-farm')
  .description('Design Token Farm — sync Figma variables to code, and back.')
  .version('0.1.0')
  .addHelpText('before', LOGO)

// ---- pull ----

program
  .command('pull')
  .description('Export variables from Figma to local token JSON files')
  .option('-o, --output <dir>', 'Output directory (overrides config tokens.dir)')
  .option('--from-file <path>', 'Import from a plugin-exported JSON file instead of the Figma API')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (opts) => {
    try {
      const config = await loadConfig(opts.config)
      await runPull(config, {
        output: opts.output,
        fromFile: opts.fromFile,
        verbose: opts.verbose,
      })
    } catch (err) {
      handleError(err)
    }
  })

// ---- push ----

program
  .command('push')
  .description('Push local token JSON files to Figma')
  .option('--dry-run', 'Show what would change without modifying Figma')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (opts) => {
    try {
      const config = await loadConfig(opts.config)
      await runPush(config, { dryRun: opts.dryRun, verbose: opts.verbose })
    } catch (err) {
      handleError(err)
    }
  })

// ---- build ----

program
  .command('build')
  .description('Generate CSS, JS, and other outputs from local token files')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (opts) => {
    try {
      const config = await loadConfig(opts.config)
      await runBuild(config, { verbose: opts.verbose })
    } catch (err) {
      handleError(err)
    }
  })

// ---- analyze ----

program
  .command('analyze')
  .description('Analyze Figma file structure and infer layer roles')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (opts) => {
    try {
      const config = await loadConfig(opts.config)
      await runAnalyze(config, { verbose: opts.verbose })
    } catch (err) {
      handleError(err)
    }
  })

// ---- graph ----

program
  .command('graph')
  .description('Build and visualize the token alias dependency graph')
  .option('-f, --format <format>', 'Output format: console, dot, markdown, html', 'console')
  .option('-o, --output <path>', 'Write output to file instead of stdout')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (opts) => {
    try {
      const config = await loadConfig(opts.config)
      await runGraph(config, { format: opts.format, output: opts.output, verbose: opts.verbose })
    } catch (err) {
      handleError(err)
    }
  })

// ---- init ----

program
  .command('init')
  .description('Create a new dtf.config.ts in the current directory')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (opts) => {
    try {
      await runInit({ verbose: opts.verbose })
    } catch (err) {
      handleError(err)
    }
  })

program.parse()
