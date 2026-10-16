import type { Readable } from 'node:stream'
import { Command, CommanderError } from 'commander'
import { COMMANDS, type CommandDefinition } from './commands.js'
import { ConfigError, loadConfig } from './config/load.js'
import type { Config } from './config/schema.js'
import { openWithSystem } from './open.js'

/** Exit code for a command that exists in the legacy CLI but is not ported yet. */
const EXIT_NOT_PORTED = 3
/** Exit code for an invalid config (same as the legacy CLI). */
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

  if (!definition.run) {
    io.stderr(
      `dta-next: "${definition.name}" is not ported to the new CLI yet. ` +
        'Use the legacy "dta" CLI for now.\n',
    )
    return EXIT_NOT_PORTED
  }
  return definition.run({ ...io, config, options })
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
    .name('dta-next')
    .description('Design Token Authority — sync Figma variables to code, and back.')
    .exitOverride()
    .configureOutput({ writeOut: resolved.stdout, writeErr: resolved.stderr })

  for (const definition of COMMANDS) {
    const command = program.command(definition.name).description(definition.description)
    for (const option of definition.options) {
      command.option(option.flags, option.description, option.defaultValue)
    }
    command.action(async (options: Record<string, unknown>) => {
      exitCode = await execute(definition, options, resolved)
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
