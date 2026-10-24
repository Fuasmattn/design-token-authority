import type { APIRoute, GetStaticPaths } from 'astro'
import { MARK_FILES, markSvg, svgResponse } from '../../lib/brand-mark'

/** The DTA mark for light and dark backgrounds; the `dta diff` comment shows it (TICKET-144). */
export const getStaticPaths = (() =>
  Object.keys(MARK_FILES).map((mode) => ({ params: { mode } }))) satisfies GetStaticPaths

export const GET: APIRoute = ({ params }) =>
  svgResponse(markSvg(MARK_FILES[params.mode as keyof typeof MARK_FILES]))
