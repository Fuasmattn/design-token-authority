import type { ConfigInput } from './config/schema.js'

export { COMMAND_NAMES } from './commands.js'
export { ConfigError, loadConfig } from './config/load.js'
export type {
  ConfigErrorCode,
  ConfigIssue,
  LoadConfigOptions,
  LoadedConfig,
} from './config/load.js'
export type { Config, ConfigInput } from './config/schema.js'
export { runCli } from './run.js'
export type { CliIo } from './run.js'

/** Identity helper that gives `dta.config.ts` autocomplete and type checking. */
export function defineConfig(config: ConfigInput): ConfigInput {
  return config
}
