import type { Diagnostic, TokenFileInput } from '@dta/core'

/**
 * A converter from one third-party export format to DTA's per-mode token files.
 * Adapters are best effort and independent: each lives in one file and is listed in
 * `adapters/index.ts`. Removing an adapter means deleting its file and that list entry.
 */
export interface Adapter {
  /** Stable name returned as `format` by `importPluginExport`. */
  format: string
  /** True when the (already JSON-object) input looks like this format. */
  detect(data: Record<string, unknown>): boolean
  /** Per-mode files plus the problems found while converting. */
  convert(data: Record<string, unknown>): { files: TokenFileInput[]; diagnostics: Diagnostic[] }
}
