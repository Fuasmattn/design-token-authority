export { createFigmaClient, parseVariablesResponse } from './client.js'
export type { FigmaClient, FigmaClientOptions } from './client.js'
export { variablesToModel } from './export.js'
export type { ExportOptions, ExportResult } from './export.js'
export { FigmaApiError } from './errors.js'
export type { FigmaApiErrorCode, FigmaApiIssue } from './errors.js'
export type {
  LocalVariable,
  LocalVariableCollection,
  LocalVariablesResponse,
  PostVariablesResult,
} from './schemas.js'
