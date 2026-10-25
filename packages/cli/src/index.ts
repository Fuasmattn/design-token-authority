import type { ConfigInput } from './config/schema.js'

export { COMMAND_NAMES, commandReference } from './commands.js'
export type { CommandArgument, CommandOption, CommandReference } from './commands.js'
export { ConfigError, loadConfig } from './config/load.js'
export type {
  ConfigErrorCode,
  ConfigIssue,
  LoadConfigOptions,
  LoadedConfig,
} from './config/load.js'
export { configJsonSchema } from './config/schema.js'
export type { Config, ConfigInput } from './config/schema.js'
export { runCli } from './run.js'
export { actionRef, renderDiffWorkflows } from './init/diff-workflows.js'
export type { WorkflowFile, WorkflowOptions } from './init/diff-workflows.js'
export { auditJsonSchema } from './audit-schema.js'
export { tokenJsonSchema } from './token-schema.js'
export type { CliIo } from './run.js'

/** Identity helper that gives `dta.config.ts` autocomplete and type checking. */
export function defineConfig(config: ConfigInput): ConfigInput {
  return config
}
