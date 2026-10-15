import { parseTokenFiles } from '@dta/core'
import type { Diagnostic, TokenModel } from '@dta/core'
import { z } from 'zod'
import { adapters } from './adapters/index.js'

/** Where the supported input formats are described. */
const FORMAT_DOCS = 'docs/token-files/input-format.md'

export type ImportFormat = string

export interface ImportResult {
  /** The adapter that recognised the input, `dtcg-per-mode` for DTA's own format, or `unknown`. */
  format: ImportFormat
  /** Empty when the input was not converted (see `diagnostics`). */
  model: TokenModel
  diagnostics: Diagnostic[]
}

const JsonObject = z.record(z.string(), z.unknown())

const emptyModel = (): TokenModel => ({ collections: [] })

function hasPerModeTokens(data: Record<string, unknown>): boolean {
  for (const value of Object.values(data)) {
    if (!JsonObject.safeParse(value).success) continue
    const object = value as Record<string, unknown>
    if ('$type' in object && '$value' in object) {
      return typeof object.$value !== 'object' || object.$value === null
    }
    if (hasPerModeTokens(object)) return true
  }
  return false
}

/**
 * Names the format of parsed JSON: an adapter's format, `dtcg-per-mode` (DTA's own format:
 * tokens with scalar values) or `unknown`. Never throws.
 */
export function detectFormat(json: unknown): ImportFormat {
  const parsed = JsonObject.safeParse(json)
  if (!parsed.success) return 'unknown'
  const adapter = adapters.find((candidate) => candidate.detect(parsed.data))
  if (adapter) return adapter.format
  return hasPerModeTokens(parsed.data) ? 'dtcg-per-mode' : 'unknown'
}

/**
 * Reads the JSON export of a third-party tool (for example a Figma plugin) into a token
 * model. The input is validated here, so a wrong shape becomes a diagnostic, never an
 * exception. Files already in DTA's per-mode format are not converted: they are read with
 * `parseTokenFiles`, which needs their `{Collection}.{Mode}.json` file names.
 */
export function importPluginExport(json: unknown): ImportResult {
  const parsed = JsonObject.safeParse(json)
  if (!parsed.success || Array.isArray(json)) {
    return {
      format: 'unknown',
      model: emptyModel(),
      diagnostics: [
        {
          severity: 'error',
          code: 'invalid-export',
          message: `Expected the export to be a JSON object, but got ${json === null ? 'null' : Array.isArray(json) ? 'an array' : typeof json}. See ${FORMAT_DOCS}.`,
        },
      ],
    }
  }

  const adapter = adapters.find((candidate) => candidate.detect(parsed.data))
  if (!adapter) {
    if (hasPerModeTokens(parsed.data)) {
      return {
        format: 'dtcg-per-mode',
        model: emptyModel(),
        diagnostics: [
          {
            severity: 'error',
            code: 'native-format',
            message: `This is already DTA's per-mode format and needs no conversion. Save it as {Collection}.{Mode}.json in your tokens directory. See ${FORMAT_DOCS}.`,
          },
        ],
      }
    }
    return {
      format: 'unknown',
      model: emptyModel(),
      diagnostics: [
        {
          severity: 'error',
          code: 'unknown-format',
          message: `Could not recognise the export format. Supported: ${adapters.map((a) => a.format).join(', ')}, and DTA's own per-mode files. See ${FORMAT_DOCS}.`,
        },
      ],
    }
  }

  const converted = adapter.convert(parsed.data)
  const { model, diagnostics } = parseTokenFiles(converted.files)
  return { format: adapter.format, model, diagnostics: [...converted.diagnostics, ...diagnostics] }
}
