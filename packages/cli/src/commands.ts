import type { Readable } from 'node:stream'
import type { Config } from './config/schema.js'
import { runAnalyze } from './commands/analyze.js'
import { runBuild } from './commands/build.js'
import { runClean } from './commands/clean.js'
import { runDiff } from './commands/diff.js'
import { runGraph } from './commands/graph.js'
import { runInit } from './commands/init.js'
import { runLint } from './commands/lint.js'
import { runPull } from './commands/pull.js'
import { runPush } from './commands/push.js'

export interface CommandOption {
  flags: string
  description: string
  defaultValue?: string
}

export interface CommandContext {
  cwd: string
  /** Validated project config, or `null` for commands that do not need one. */
  config: Config | null
  options: Record<string, unknown>
  stdout: (text: string) => void
  stderr: (text: string) => void
  /** Opens a file in the default application (a browser for HTML). */
  openFile: (file: string) => void
  /** Where prompts read their answers from. */
  input: Readable
}

export interface CommandDefinition {
  name: string
  description: string
  options: readonly CommandOption[]
  /** Whether the project config is loaded (and validated) before the command runs. */
  needsConfig: boolean
  /** Implementation; returns the exit code. */
  run: (context: CommandContext) => Promise<number>
}

const CONFIG: CommandOption = { flags: '-c, --config <path>', description: 'Path to config file' }
const VERBOSE: CommandOption = { flags: '-v, --verbose', description: 'Enable verbose logging' }

/** Every command of the CLI, with its options. */
export const COMMANDS: readonly CommandDefinition[] = [
  {
    name: 'pull',
    description: 'Export variables from Figma to local token JSON files',
    needsConfig: true,
    run: runPull,
    options: [
      {
        flags: '-o, --output <dir>',
        description: 'Output directory (overrides config tokens.dir)',
      },
      {
        flags: '--from-file <path>',
        description: 'Import from a plugin-exported JSON file instead of the Figma API',
      },
      CONFIG,
      VERBOSE,
    ],
  },
  {
    name: 'push',
    description: 'Push local token JSON files to Figma',
    needsConfig: true,
    run: runPush,
    options: [
      { flags: '--dry-run', description: 'Show what would change without modifying Figma' },
      {
        flags: '--format <format>',
        description: 'Diff output format: console, markdown, json',
        defaultValue: 'console',
      },
      { flags: '--skip-lint', description: 'Skip lint check before pushing' },
      {
        flags: '-y, --yes',
        description: 'Skip confirmation prompt (use in CI/automation)',
      },
      CONFIG,
      VERBOSE,
    ],
  },
  {
    name: 'build',
    description: 'Generate CSS, JS, and other outputs from local token files',
    needsConfig: true,
    run: runBuild,
    options: [CONFIG, VERBOSE],
  },
  {
    name: 'analyze',
    description: 'Analyze Figma file structure and infer layer roles',
    needsConfig: true,
    run: runAnalyze,
    options: [CONFIG, VERBOSE],
  },
  {
    name: 'graph',
    description: 'Build and visualize the token alias dependency graph',
    run: runGraph,
    needsConfig: true,
    options: [
      {
        flags: '-f, --format <format>',
        description: 'Output format: console, dot, markdown, html',
        defaultValue: 'console',
      },
      { flags: '-o, --output <path>', description: 'Write output to file instead of stdout' },
      CONFIG,
      VERBOSE,
    ],
  },
  {
    name: 'clean',
    description: 'Remove all token files and build output',
    needsConfig: true,
    run: runClean,
    options: [CONFIG, VERBOSE],
  },
  {
    name: 'lint',
    description: 'Validate token files against linting rules',
    needsConfig: true,
    run: runLint,
    options: [
      { flags: '--fix', description: 'Auto-fix violations where possible' },
      CONFIG,
      VERBOSE,
    ],
  },
  {
    name: 'diff',
    description: 'Compare the tokens with a base (directory, git ref, or merge base with main)',
    needsConfig: true,
    run: runDiff,
    options: [
      {
        flags: '--base <ref|dir>',
        description: 'Base to compare with (default: merge base of HEAD and the default branch)',
      },
      { flags: '--tokens-only', description: 'Only compare token values, no screenshots' },
      { flags: '--list', description: 'List the stories dta diff would render, then exit' },
      {
        flags: '--report <dir>',
        description: 'Folder for screenshots and results (default: .dta/diff)',
      },
      {
        flags: '--publish <command>',
        description:
          'Publish hook: runs on the report folder and prints its public URL (overrides diff.publish)',
      },
      {
        flags: '--from-report',
        description: 'Publish the report folder of an earlier run instead of rendering again',
      },
      {
        flags: '-f, --format <format>',
        description: 'Output format: console, markdown, json',
        defaultValue: 'console',
      },
      { flags: '-o, --out <file>', description: 'Write the markdown or JSON report to a file' },
      {
        flags: '--fail-on-change',
        description:
          'Exit with code 1 when something needs a look: unexplained story changes above the threshold, explained ones to review, new or removed stories (token changes without stories: any change)',
      },
      CONFIG,
      VERBOSE,
    ],
  },

  {
    name: 'init',
    description: 'Create a new dta.config.ts in the current directory',
    needsConfig: false,
    run: runInit,
    options: [VERBOSE],
  },
]

export const COMMAND_NAMES: readonly string[] = COMMANDS.map((command) => command.name)

/** What the reference documents about a command: its name, description and options. */
export interface CommandReference {
  name: string
  description: string
  options: readonly CommandOption[]
}

/** Every command with its options, without the implementations (for generated docs). */
export function commandReference(): CommandReference[] {
  return COMMANDS.map(({ name, description, options }) => ({ name, description, options }))
}
