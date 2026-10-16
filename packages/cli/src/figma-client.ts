import { createFigmaClient, FigmaApiError } from '@dta/figma'
import type { FigmaClient } from '@dta/figma'

/**
 * The Figma client for a command. `DTA_FIGMA_API_URL` points it at another server
 * (a proxy, or the fake used by the tests); by default it talks to api.figma.com.
 */
export function figmaClientFor(token: string): FigmaClient {
  return createFigmaClient({ token, baseUrl: process.env.DTA_FIGMA_API_URL || undefined })
}

/** A message for the person at the terminal; hints at the way out for the common failures. */
export function describeFigmaError(error: unknown): string | null {
  if (!(error instanceof FigmaApiError)) return null
  if (error.status === 403) {
    return (
      `${error.message}\n` +
      'The Variables REST API needs an Enterprise plan and a token with the file_variables:read scope.\n' +
      'On other plans, export the variables with a plugin and use "dta pull --from-file <export.json>".'
    )
  }
  return error.message
}
