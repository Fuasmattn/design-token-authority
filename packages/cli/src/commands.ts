import type { Config } from './config/schema.js'
import { runBuild } from './commands/build.js'
import { runLint } from './commands/lint.js'

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
}

export interface CommandDefinition {
  name: string
  description: string
  options: readonly CommandOption[]
  /** Whether the project config is loaded (and validated) before the command runs. */
  needsConfig: boolean
  /** Implementation; returns the exit code. Absent while the command is not ported yet. */
  run?: (context: CommandContext) => Promise<number>
}

const CONFIG: CommandOption = { flags: '-c, --config <path>', description: 'Path to config file' }
const VERBOSE: CommandOption = { flags: '-v, --verbose', description: 'Enable verbose logging' }

/**
 * Every command of the legacy CLI, with its options. A command is "not ported" until it
 * has a `run`; its snapshot scenarios stay on the pending list in `test/snapshots.test.ts`
 * until then.
 */
export const COMMANDS: readonly CommandDefinition[] = [
  {
    name: 'pull',
    description: 'Export variables from Figma to local token JSON files',
    needsConfig: true,
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
    options: [CONFIG, VERBOSE],
  },
  {
    name: 'graph',
    description: 'Build and visualize the token alias dependency graph',
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
    name: 'test:visual',
    description: 'Run visual regression tests against build output',
    needsConfig: false,
    options: [
      {
        flags: '--update-baseline',
        description: 'Update baseline screenshots after intentional changes',
      },
      VERBOSE,
    ],
  },
  {
    name: 'init',
    description: 'Create a new dta.config.ts in the current directory',
    needsConfig: false,
    options: [VERBOSE],
  },
]

export const COMMAND_NAMES: readonly string[] = COMMANDS.map((command) => command.name)
