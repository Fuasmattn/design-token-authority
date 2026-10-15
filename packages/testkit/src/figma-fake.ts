import http from 'node:http'
import type { AddressInfo } from 'node:net'
import type { GetLocalVariablesResponse, PostVariablesRequestBody } from '@figma/rest-api-spec'

export interface FigmaFakeOptions {
  /** Recorded `GET /v1/files/:key/variables/local` responses, by Figma file key. */
  files: Record<string, GetLocalVariablesResponse>
  /** If set, requests must carry this `X-Figma-Token`, otherwise they get a 403. */
  token?: string
}

/** One request the fake accepted. */
export interface RecordedRequest {
  method: 'GET' | 'POST'
  path: string
  fileKey: string
  token: string | undefined
  /** The parsed JSON body (POST only). */
  body: PostVariablesRequestBody | undefined
}

export interface FigmaFake {
  /** Base URL, e.g. `http://127.0.0.1:41234`. */
  url: string
  /** Accepted requests in arrival order (rejected ones are not recorded). */
  readonly requests: readonly RecordedRequest[]
  close(): Promise<void>
}

const ROUTE = /^\/v1\/files\/([^/]+)\/variables(\/local)?$/

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(text),
  })
  res.end(text)
}

const fail = (res: http.ServerResponse, status: number, message: string) =>
  send(res, status, { status, error: true, message })

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

/** Ids of everything a POST creates; the real Figma answers with a temp-id -> real-id map. */
function createdIds(payload: PostVariablesRequestBody): string[] {
  const ids: string[] = []
  const add = (id: string | undefined) => {
    if (id) ids.push(id)
  }
  for (const collection of payload.variableCollections ?? []) {
    if (collection.action !== 'CREATE') continue
    add(collection.id)
    if ('initialModeId' in collection) add(collection.initialModeId)
  }
  for (const mode of payload.variableModes ?? []) if (mode.action === 'CREATE') add(mode.id)
  for (const variable of payload.variables ?? []) if (variable.action === 'CREATE') add(variable.id)
  return ids
}

/**
 * Start a fake of the parts of the Figma Variables REST API that DTA uses.
 * It replays recorded reads and records writes; it does not apply them, so a push
 * is verified by asserting on `requests`, not by reading the result back.
 */
export async function startFigmaFake(options: FigmaFakeOptions): Promise<FigmaFake> {
  const requests: RecordedRequest[] = []
  let counter = 0

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake')
    const route = ROUTE.exec(url.pathname)
    const method = req.method
    const isRead = method === 'GET' && route?.[2] === '/local'
    const isWrite = method === 'POST' && route !== null && route[2] === undefined
    if (!route || (!isRead && !isWrite)) return fail(res, 404, 'Not found')

    const token = req.headers['x-figma-token']
    const tokenValue = Array.isArray(token) ? token[0] : token
    if (options.token !== undefined && tokenValue !== options.token) {
      return fail(res, 403, 'Invalid token')
    }

    const fileKey = decodeURIComponent(route[1])
    if (isRead) {
      const recording = options.files[fileKey]
      if (!recording) return fail(res, 404, 'Not found')
      requests.push({
        method: 'GET',
        path: url.pathname,
        fileKey,
        token: tokenValue,
        body: undefined,
      })
      return send(res, 200, recording)
    }

    let payload: PostVariablesRequestBody
    try {
      payload = JSON.parse(await readBody(req)) as PostVariablesRequestBody
    } catch {
      return fail(res, 400, 'Request body is not valid JSON')
    }
    requests.push({ method: 'POST', path: url.pathname, fileKey, token: tokenValue, body: payload })

    const tempIdToRealId: Record<string, string> = {}
    for (const id of createdIds(payload)) tempIdToRealId[id] = `fake:${++counter}`
    return send(res, 200, { status: 200, error: false, meta: { tempIdToRealId } })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  }
}
