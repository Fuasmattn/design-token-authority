import type { PostVariablesRequestBody } from '@figma/rest-api-spec'
import type { z } from 'zod'
import { FigmaApiError, type FigmaApiIssue } from './errors.js'
import {
  LocalVariablesResponseSchema,
  PostVariablesResponseSchema,
  type LocalVariablesResponse,
  type PostVariablesResult,
} from './schemas.js'

export interface FigmaClientOptions {
  /** Figma personal access token. Never included in errors or logs. */
  token: string
  /** Defaults to `https://api.figma.com`. Point it at a fake in tests. */
  baseUrl?: string
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
}

export interface FigmaClient {
  getLocalVariables(fileKey: string): Promise<LocalVariablesResponse>
  postVariables(fileKey: string, payload: PostVariablesRequestBody): Promise<PostVariablesResult>
}

function issuesOf(error: z.ZodError): FigmaApiIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
  }))
}

function invalidResponse(what: string, issues: FigmaApiIssue[]): FigmaApiError {
  const shown = issues
    .slice(0, 5)
    .map((i) => `${i.path}: ${i.message}`)
    .join('; ')
  const more = issues.length > 5 ? ` (and ${issues.length - 5} more)` : ''
  return new FigmaApiError('invalid-response', `${what} has an unexpected shape: ${shown}${more}`, {
    issues,
  })
}

/**
 * Validate a raw "local variables" response (from the API, a recording or a cache).
 * Returns data typed by the schema; throws `FigmaApiError` (`invalid-response`) otherwise.
 */
export function parseVariablesResponse(raw: unknown): LocalVariablesResponse {
  const result = LocalVariablesResponseSchema.safeParse(raw)
  if (!result.success) throw invalidResponse('Figma variables response', issuesOf(result.error))
  return result.data
}

export function createFigmaClient(options: FigmaClientOptions): FigmaClient {
  const base = (options.baseUrl ?? 'https://api.figma.com').replace(/\/+$/, '')
  const doFetch = options.fetch ?? fetch

  async function request(method: 'GET' | 'POST', url: string, body?: unknown): Promise<unknown> {
    let response: Response
    try {
      response = await doFetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          'X-Figma-Token': options.token,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (error) {
      const reason =
        error instanceof Error
          ? ((error.cause as Error | undefined)?.message ?? error.message)
          : 'unknown error'
      throw new FigmaApiError('network-error', `Could not reach Figma at ${base}: ${reason}`)
    }

    const text = await response.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      if (response.ok) {
        throw new FigmaApiError('invalid-response', 'Figma returned a response that is not JSON.')
      }
    }

    if (!response.ok) {
      const detail = (json as { message?: unknown; err?: unknown } | undefined) ?? {}
      const message = String(
        detail.message ?? detail.err ?? response.statusText ?? 'request failed',
      )
      throw new FigmaApiError('http-error', `Figma API responded ${response.status}: ${message}`, {
        status: response.status,
      })
    }
    return json
  }

  const fileUrl = (fileKey: string, suffix: string) =>
    `${base}/v1/files/${encodeURIComponent(fileKey)}/variables${suffix}`

  return {
    async getLocalVariables(fileKey) {
      return parseVariablesResponse(await request('GET', fileUrl(fileKey, '/local')))
    },
    async postVariables(fileKey, payload) {
      const result = PostVariablesResponseSchema.safeParse(
        await request('POST', fileUrl(fileKey, ''), payload),
      )
      if (!result.success) throw invalidResponse('Figma write response', issuesOf(result.error))
      return result.data
    },
  }
}
