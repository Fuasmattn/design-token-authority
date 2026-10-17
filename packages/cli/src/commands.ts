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
import { runSkillAdd } from './commands/skill.js'
import { runTokenFind, runTokenGet, runTokenList } from './commands/token.js'

export interface CommandOption {
  flags: string
  description: string
  defaultValue?: string
}

export interface CommandArgument {
  /** Commander syntax: `<name>` (required) or `[name]` (optional). */
  name: string
  description: string
}

export interface CommandContext {
  cwd: string
  /** Positional arguments, in the order the definition declares them. */
  args: string[]
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
  /** Group command this one belongs to (`token` for `dta token get`). */
  parent?: keyof typeof COMMAND_GROUPS
  description: string
  arguments?: readonly CommandArgument[]
  options: readonly CommandOption[]
  /** Whether the project config is loaded (and validated) before the command runs. */
  needsConfig: boolean
  /** Implementation; returns the exit code. */
  run: (context: CommandContext) => Promise<number>
}

/** Commands that only group subcommands. */
export const COMMAND_GROUPS = {
  token: 'Look up tokens: what a token resolves to, which tokens have a value, which exist',
  skill: 'Install the DTA skill that teaches coding agents the token workflow',
} as const

const CONFIG: CommandOption = { flags: '-c, --config <path>', description: 'Path to config file' }
const VERBOSE: CommandOption = { flags: '-v, --verbose', description: 'Enable verbose logging' }
const FORMAT_JSON: CommandOption = {
  flags: '-f, --format <format>',
  description: 'Output format: console, json',
  defaultValue: 'console',
}

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
    name: 'get',
    parent: 'token',
    description:
      'Show a token: type, collection, value and alias chain per brand or mode, and its names in CSS and Tailwind',
    needsConfig: true,
    run: runTokenGet,
    arguments: [{ name: '<name>', description: 'Token name in dot form, e.g. color.action.bg' }],
    options: [
      {
        flags: '-m, --mode <collection=mode...>',
        description: 'Read in these modes only, e.g. --mode Brand=BrandB (repeatable)',
      },
      FORMAT_JSON,
      CONFIG,
      VERBOSE,
    ],
  },
  {
    name: 'find',
    parent: 'token',
    description:
      'Find the tokens that resolve to a value, aliases (semantic and component tokens) first',
    needsConfig: true,
    run: runTokenFind,
    arguments: [
      {
        name: '<value>',
        description: 'A colour (#2f55d4, rgb(47 85 212)), number, string or boolean',
      },
    ],
    options: [
      {
        flags: '-t, --type <type>',
        description: 'Only tokens of this type: color, number, string, boolean',
      },
      { flags: '--near', description: 'Colours: also match colours within about 2% per channel' },
      FORMAT_JSON,
      CONFIG,
      VERBOSE,
    ],
  },
  {
    name: 'list',
    parent: 'token',
    description: 'List tokens with type and collection, sorted by name',
    needsConfig: true,
    run: runTokenList,
    options: [
      { flags: '--collection <name>', description: 'Only tokens of this collection' },
      {
        flags: '-t, --type <type>',
        description: 'Only tokens of this type: color, number, string, boolean',
      },
      {
        flags: '--match <glob>',
        description: 'Only names matching the glob: * within a segment, ** across segments',
      },
      FORMAT_JSON,
      CONFIG,
      VERBOSE,
    ],
  },

  {
    name: 'add',
    parent: 'skill',
    description:
      'Write the DTA skill for coding agents (SKILL.md: look tokens up, lint, build, diff, never push)',
    needsConfig: false,
    run: runSkillAdd,
    options: [
      {
        flags: '--dir <path>',
        description: 'Folder to write SKILL.md to (other agents than Claude Code)',
        defaultValue: '.claude/skills/dta',
      },
      {
        flags: '--check',
        description: 'Exit 1 when the installed skill is missing or out of date',
      },
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

/** Full command names as typed after `dta`: `build`, `token get`, … */
export const commandPath = (command: Pick<CommandDefinition, 'name' | 'parent'>) =>
  command.parent ? `${command.parent} ${command.name}` : command.name

export const COMMAND_NAMES: readonly string[] = COMMANDS.map(commandPath)

/** What the reference documents about a command: its full name, description, arguments and options. */
export interface CommandReference {
  /** As typed after `dta`, e.g. `token get`. */
  name: string
  description: string
  arguments: readonly CommandArgument[]
  options: readonly CommandOption[]
}

/** Every command with its arguments and options, without the implementations (for generated docs). */
export function commandReference(): CommandReference[] {
  return COMMANDS.map((command) => ({
    name: commandPath(command),
    description: command.description,
    arguments: command.arguments ?? [],
    options: command.options,
  }))
}
