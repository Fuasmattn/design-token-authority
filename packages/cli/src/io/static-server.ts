import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
}

export interface StaticServer {
  url: string
  close(): Promise<void>
}

const isFile = (file: string) => fs.existsSync(file) && fs.statSync(file).isFile()

/**
 * The file a page URL is served from, as static hosts do: the file itself, `<page>.html`, or
 * `<page>/index.html` (`/` and `/docs/` only the last). Null when there is none, or when the
 * path leads outside `root`. The one rule for `dta diff --list` and the server that renders the
 * pages (TICKET-148), so a page that is listed is a page that renders.
 */
export function resolvePage(root: string, url: string): string | null {
  const base = path.resolve(root)
  const pathname = decodeURIComponent(url.split(/[?#]/)[0])
  const target = path.join(base, pathname)
  if (target !== base && !target.startsWith(base + path.sep)) return null
  const candidates =
    pathname.endsWith('/') || target === base
      ? [path.join(target, 'index.html')]
      : [target, `${target}.html`, path.join(target, 'index.html')]
  return candidates.find(isFile) ?? null
}

/** Serves a folder of static files on a free localhost port, pages found by resolvePage. */
export async function serveStatic(root: string): Promise<StaticServer> {
  const base = path.resolve(root)
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    const file = resolvePage(base, pathname)
    if (!file) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    })
    fs.createReadStream(file).pipe(response)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
