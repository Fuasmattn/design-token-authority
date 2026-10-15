export type FigmaApiErrorCode = 'http-error' | 'network-error' | 'invalid-response'

export interface FigmaApiIssue {
  /** Dot path of the offending field, e.g. `meta.variables.VariableID:1:2.resolvedType`. */
  path: string
  message: string
}

/**
 * Anything that goes wrong talking to Figma. The message never contains the access token.
 */
export class FigmaApiError extends Error {
  readonly code: FigmaApiErrorCode
  /** HTTP status, for `http-error`. */
  readonly status?: number
  /** What failed validation, for `invalid-response`. */
  readonly issues?: FigmaApiIssue[]

  constructor(
    code: FigmaApiErrorCode,
    message: string,
    details: { status?: number; issues?: FigmaApiIssue[] } = {},
  ) {
    super(message)
    this.name = 'FigmaApiError'
    this.code = code
    this.status = details.status
    this.issues = details.issues
  }
}
