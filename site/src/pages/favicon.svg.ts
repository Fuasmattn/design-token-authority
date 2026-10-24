import type { APIRoute } from 'astro'
import { markSvg, svgResponse } from '../lib/brand-mark'

/** The favicon: the DTA mark in the light theme, from the tokens (TICKET-144). */
export const GET: APIRoute = () => svgResponse(markSvg('Light'))
