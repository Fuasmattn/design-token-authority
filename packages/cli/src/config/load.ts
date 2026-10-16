import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { z } from 'zod'
import { configSchema, type Config } from './schema.js'

const CANDIDATES = [
  'dta.config.ts',
  'dta.config.mts',
  'dta.config.js',
  'dta.config.mjs',
  'dta.config.json',
] as const

export interface ConfigIssue {
  /** Dotted path of the offending field, e.g. `outputs.css.outDir` or `brands[0]`. */
  path: string
  message: string
}

export type ConfigErrorCode = 'not-found' | 'multiple-files' | 'unreadable' | 'invalid'

/** Why a config could not be used. `invalid` carries one issue per offending field. */
export class ConfigError extends Error {
  constructor(
    readonly code: ConfigErrorCode,
    message: string,
    readonly issues: ConfigIssue[] = [],
  ) {
    super(message)
    this.name = 'ConfigError'
  }
}

export interface LoadedConfig {
  config: Config
  /** Absolute path of the file the config was read from. */
  filePath: string
}

export interface LoadConfigOptions {
  /** Directory to search and to resolve `configPath` against (default: the current directory). */
  cwd?: string
  /** Explicit config file (`--config`), absolute or relative to `cwd`. */
  configPath?: string
}

function formatPath(segments: ReadonlyArray<PropertyKey>): string {
  if (segments.length === 0) return 'config'
  return segments.reduce<string>((result, segment) => {
    if (typeof segment === 'number') return `${result}[${segment}]`
    return result === '' ? String(segment) : `${result}.${String(segment)}`
  }, '')
}

function toIssues(error: z.ZodError): ConfigIssue[] {
  return error.issues.map((issue) => ({ path: formatPath(issue.path), message: issue.message }))
}

function locate(cwd: string, configPath: string | undefined): string {
  if (configPath !== undefined) {
    const resolved = path.resolve(cwd, configPath)
    if (!fs.existsSync(resolved)) {
      throw new ConfigError('not-found', `Config file not found: ${resolved}`)
    }
    return resolved
  }

  const found = CANDIDATES.filter((name) => fs.existsSync(path.join(cwd, name)))
  if (found.length === 0) {
    throw new ConfigError(
      'not-found',
      `No config file found in ${cwd}.\n` +
        `Create one of ${CANDIDATES.join(', ')}, or pass --config <path>.`,
    )
  }
  if (found.length > 1) {
    throw new ConfigError(
      'multiple-files',
      `Found more than one config file in ${cwd}: ${found.join(', ')}.\n` +
        'Keep one of them, or choose with --config <path>.',
    )
  }
  return path.join(cwd, found[0])
}

/**
 * A config tsx compiled to CommonJS arrives as `{ default: { __esModule, default: config } }`;
 * an ES module as `{ default: config }`. Both become the latter.
 */
function unwrapInterop(module: Record<string, unknown>): Record<string, unknown> {
  const inner = module.default
  const nested =
    typeof inner === 'object' &&
    inner !== null &&
    ('__esModule' in inner || Object.prototype.toString.call(inner) === '[object Module]')
  if (nested) {
    // A module namespace inside the namespace: its own `default` is the config, if any.
    return 'default' in inner ? (inner as Record<string, unknown>) : {}
  }
  return module
}

async function readRaw(filePath: string): Promise<unknown> {
  const reason = (error: unknown) => (error instanceof Error ? error.message : String(error))

  if (filePath.endsWith('.json')) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (error) {
      throw new ConfigError('unreadable', `Could not read ${filePath}: ${reason(error)}`)
    }
  }

  // tsx's own import, scoped to this file: a `.ts` or `.js` config written with `export default`
  // must load in projects without "type": "module" too (a plain import there goes through the
  // CommonJS loader and fails on the ESM syntax).
  let module: Record<string, unknown>
  try {
    const { tsImport } = await import('tsx/esm/api')
    module = unwrapInterop(
      (await tsImport(pathToFileURL(filePath).href, import.meta.url)) as Record<string, unknown>,
    )
  } catch (error) {
    throw new ConfigError('unreadable', `Could not load ${filePath}: ${reason(error)}`)
  }
  if (!('default' in module)) {
    throw new ConfigError(
      'unreadable',
      `${filePath} must have a default export, e.g. "export default defineConfig({ … })".`,
    )
  }
  return module.default
}

/** Find, read and validate the project config. Throws {@link ConfigError} on any problem. */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<LoadedConfig> {
  const cwd = options.cwd ?? process.cwd()
  const filePath = locate(cwd, options.configPath)
  const raw = await readRaw(filePath)

  const result = configSchema.safeParse(raw)
  if (!result.success) {
    const issues = toIssues(result.error)
    const lines = issues.map((issue) => `  ${issue.path}: ${issue.message}`)
    throw new ConfigError(
      'invalid',
      `Invalid configuration in ${filePath}:\n${lines.join('\n')}`,
      issues,
    )
  }
  return { config: result.data, filePath }
}
