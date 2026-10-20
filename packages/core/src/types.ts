/** A token's path inside its collection, e.g. `['Colors', 'Brand', 'Primary']`. */
export type TokenName = string[]

export type TokenType = 'color' | 'number' | 'string' | 'boolean'

/** Raw value as written in the token file; an alias is the string `{Group.Token}`. */
export type TokenValue = string | number | boolean

export interface Token {
  name: TokenName
  type: TokenType
  /** One value per mode of the collection. A mode may be missing. */
  values: Record<string, TokenValue>
  description?: string
  /** The `$extensions` object (including `com.figma`), kept as written. */
  extensions?: Record<string, unknown>
}

/**
 * The file a mode was read from. It lets `serializeTokenFiles` reproduce the original
 * content (key order, unknown fields, formatting). Treat it as opaque.
 */
export interface FileSource {
  fileName: string
  tree: Record<string, unknown>
  indent: string
  trailingNewline: boolean
}

export interface Collection {
  name: string
  /** Mode names, sorted. */
  modes: string[]
  tokens: Token[]
  /** Opaque, by mode. Absent for modes that were created in memory. */
  sources: Record<string, FileSource>
}

export interface TokenModel {
  collections: Collection[]
}

export interface TokenFileInput {
  /** Base file name, `{Collection}.{Mode}.json`. */
  fileName: string
  content: string
}

export type DiagnosticSeverity = 'error' | 'warning'

/**
 * A page of DTA's documentation a diagnostic points to. Each surface renders it its own way:
 * the CLI prints the repository path (`DOC_PATHS`), the website links its own page.
 */
export type DocId = 'token-files' | 'lint-rules'

export interface Diagnostic {
  severity: DiagnosticSeverity
  /** Stable machine-readable code, e.g. `invalid-json`, `missing-type`. */
  code: string
  /** What is wrong, without the pointer to the docs (that is `docs`). */
  message: string
  file?: string
  /** Token path the problem is about. */
  path?: string[]
  /** The documentation that explains it; `formatDiagnostic` adds "See …". */
  docs?: DocId
}

export interface ParseResult {
  model: TokenModel
  diagnostics: Diagnostic[]
}
