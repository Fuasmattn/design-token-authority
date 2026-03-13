/**
 * TICKET-008: Config file loader.
 *
 * Loads and validates a dtf.config.ts file at runtime.
 * The config file is a TypeScript module that default-exports a Config object.
 * We use dynamic import() so tsx handles the TS compilation transparently.
 */

import * as path from 'path'
import * as fs from 'fs'
import { Config, ConfigValidationError, validateConfig } from './schema.js'
import { brightRed } from '../utils.js'

export const DEFAULT_CONFIG_PATH = './dtf.config.ts'

/**
 * Resolve the config file path and load + validate it.
 *
 * @param configPath - Path to the config file (absolute or relative to cwd).
 *                     Defaults to `./dtf.config.ts`.
 * @returns The validated Config object.
 * @throws ConfigValidationError if validation fails.
 * @throws Error if the file does not exist or cannot be imported.
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  const resolved = path.resolve(configPath ?? DEFAULT_CONFIG_PATH)

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Config file not found: ${resolved}\n` +
        'Run "dtf init" to create one, or use --config to specify a path.',
    )
  }

  let module: Record<string, unknown>
  try {
    // Dynamic import works for both .ts (via tsx) and .js files.
    // We use a file:// URL to ensure ESM compatibility on all platforms.
    module = (await import(`file://${resolved}`)) as Record<string, unknown>
  } catch (err) {
    throw new Error(
      `Failed to load config file: ${resolved}\n` +
        `${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const raw = module.default ?? module
  try {
    return validateConfig(raw)
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      console.error(brightRed(`\nInvalid configuration in ${resolved}:`))
      console.error(brightRed(`  ${err.message}\n`))
    }
    throw err
  }
}
