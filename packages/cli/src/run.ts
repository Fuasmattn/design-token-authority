import fs from 'node:fs'
import type { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { Command, CommanderError } from 'commander'
import { COMMAND_GROUPS, COMMANDS, type CommandDefinition } from './commands.js'
import { ConfigError, loadConfig } from './config/load.js'
import type { Config } from './config/schema.js'
import { openWithSystem } from './open.js'

/** The version of the published package (the repository root), `unknown` if it cannot be read. */
function packageVersion(): string {
  try {
    const file = fileURLToPath(new URL('../../../package.json', import.meta.url))
    const { version } = JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: string }
    return version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Exit code for an invalid config (same as the v1 CLI). */
const EXIT_INVALID_CONFIG = 2

export interface CliIo {
  /** Working directory (default: the process's). */
  cwd?: string
  stdout?: (text: string) => void
  stderr?: (text: string) => void
  /** Opens a file in the default application (default: the system's). */
  openFile?: (file: string) => void
  /** Where prompts read their answers from (default: standard input). */
  input?: Readable
}

async function execute(
  definition: CommandDefinition,
  options: Record<string, unknown>,
  args: string[],
  io: Required<CliIo>,
): Promise<number> {
  let config: Config | null = null
  if (definition.needsConfig) {
    try {
      const loaded = await loadConfig({
        cwd: io.cwd,
        configPath: typeof options.config === 'string' ? options.config : undefined,
      })
      config = loaded.config
    } catch (error) {
      if (error instanceof ConfigError) {
        io.stderr(`${error.message}\n`)
        return error.code === 'invalid' ? EXIT_INVALID_CONFIG : 1
      }
      throw error
    }
  }

  return definition.run({ ...io, config, options, args })
}

/**
 * Run the CLI with the given arguments (without the program name) and return the exit code.
 * Nothing is written to the process streams unless `io` is omitted, which keeps it testable.
 */
export async function runCli(argv: string[], io: CliIo = {}): Promise<number> {
  const resolved: Required<CliIo> = {
    cwd: io.cwd ?? process.cwd(),
    stdout: io.stdout ?? ((text) => void process.stdout.write(text)),
    stderr: io.stderr ?? ((text) => void process.stderr.write(text)),
    openFile: io.openFile ?? openWithSystem,
    input: io.input ?? process.stdin,
  }

  let exitCode = 0
  // exitOverride and configureOutput are copied to the subcommands created below.
  const program = new Command()
    .name('dta')
    .version(packageVersion())
    .description('Design Token Authority — sync Figma variables to code, and back.')
    .exitOverride()
    .configureOutput({ writeOut: resolved.stdout, writeErr: resolved.stderr })

  const groups = new Map<string, Command>()
  for (const definition of COMMANDS) {
    let parent = program
    if (definition.parent) {
      let group = groups.get(definition.parent)
      if (!group) {
        group = program.command(definition.parent).description(COMMAND_GROUPS[definition.parent])
        groups.set(definition.parent, group)
      }
      parent = group
    }
    const command = parent.command(definition.name).description(definition.description)
    for (const argument of definition.arguments ?? []) {
      command.argument(argument.name, argument.description)
    }
    for (const option of definition.options) {
      command.option(option.flags, option.description, option.defaultValue)
    }
    // Commander passes the positional arguments first, then the options and the command.
    command.action(async (...values: unknown[]) => {
      const options = values[values.length - 2] as Record<string, unknown>
      const args = values.slice(0, -2).map(String)
      exitCode = await execute(definition, options, args, resolved)
    })
  }

  try {
    await program.parseAsync(argv, { from: 'user' })
  } catch (error) {
    if (error instanceof CommanderError) return error.exitCode
    throw error
  }
  return exitCode
}
