import type { APIRoute } from 'astro'
import { storiesManifest } from '../../examples/registry'

/** The stories `dta diff` captures (versioned shape, see registry.ts). */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(storiesManifest(), null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json' },
  })
