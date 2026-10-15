import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startFigmaFake, type FigmaFake } from '@dta/testkit'
import type { GetLocalVariablesResponse } from '@figma/rest-api-spec'
import { createFigmaClient, FigmaApiError, parseVariablesResponse } from './index.js'
import type { LocalVariablesResponse } from './index.js'

const recordingPath = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'test',
  'recordings',
  'brand-ab',
  'variables-local.json',
)
const recording = JSON.parse(fs.readFileSync(recordingPath, 'utf-8')) as GetLocalVariablesResponse

// Compile-time guarantee: whatever the official Figma type allows, our schema type accepts.
const _compatible: LocalVariablesResponse = recording
void _compatible

const FILE_KEY = 'TESTFILEKEY-brand-ab'
const TOKEN = 'secret-test-token'

let fake: FigmaFake | undefined
afterEach(async () => {
  await fake?.close()
  fake = undefined
})

async function start(files: Record<string, unknown> = { [FILE_KEY]: recording }, token = TOKEN) {
  fake = await startFigmaFake({ files: files as never, token })
  return createFigmaClient({ token: TOKEN, baseUrl: fake.url })
}

async function failure(promise: Promise<unknown>): Promise<FigmaApiError> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(FigmaApiError)
    return error as FigmaApiError
  }
  throw new Error('expected the call to reject')
}

describe('getLocalVariables', () => {
  it('returns the validated variables of a file and sends the token', async () => {
    const client = await start()
    const response = await client.getLocalVariables(FILE_KEY)
    expect(Object.keys(response.meta.variableCollections)).toHaveLength(3)
    expect(Object.keys(response.meta.variables)).toHaveLength(42)
    expect(fake!.requests).toEqual([
      expect.objectContaining({ method: 'GET', fileKey: FILE_KEY, token: TOKEN }),
    ])
  })

  it('url-encodes the file key', async () => {
    const client = await start({ 'a b/c': recording })
    await client.getLocalVariables('a b/c')
    expect(fake!.requests[0].fileKey).toBe('a b/c')
  })
})

describe('getLocalVariables: failures are typed and never leak the token', () => {
  it('reports a rejected token as an http error with Figma’s message', async () => {
    fake = await startFigmaFake({ files: { [FILE_KEY]: recording }, token: 'something-else' })
    const error = await failure(
      createFigmaClient({ token: TOKEN, baseUrl: fake.url }).getLocalVariables(FILE_KEY),
    )
    expect(error).toMatchObject({
      code: 'http-error',
      status: 403,
      message: expect.stringContaining('Invalid token'),
    })
    expect(error.message).not.toContain(TOKEN)
  })

  it('reports an unknown file as a 404', async () => {
    const client = await start()
    const error = await failure(client.getLocalVariables('nope'))
    expect(error).toMatchObject({ code: 'http-error', status: 404 })
  })

  it('reports an unreachable server as a network error', async () => {
    const client = await start()
    const url = fake!.url
    await fake!.close()
    fake = undefined
    const error = await failure(
      createFigmaClient({ token: TOKEN, baseUrl: url }).getLocalVariables(FILE_KEY),
    )
    expect(error.code).toBe('network-error')
    expect(error.message).not.toContain(TOKEN)
    void client
  })

  it('reports a body that is not JSON as an invalid response', async () => {
    const server = http.createServer((_req, res) => res.end('<html>oops</html>'))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as { port: number }
    try {
      const error = await failure(
        createFigmaClient({ token: TOKEN, baseUrl: `http://127.0.0.1:${port}` }).getLocalVariables(
          'k',
        ),
      )
      expect(error.code).toBe('invalid-response')
    } finally {
      server.closeAllConnections()
      server.close()
    }
  })

  it('rejects a response with the wrong shape and names the failing paths', async () => {
    const broken = structuredClone(recording) as unknown as {
      meta: { variables: Record<string, { resolvedType: string; valuesByMode: unknown }> }
    }
    const [id] = Object.keys(broken.meta.variables)
    broken.meta.variables[id].resolvedType = 'DATE'
    broken.meta.variables[id].valuesByMode = { '1:0': { nonsense: true } }
    const client = await start({ [FILE_KEY]: broken })
    const error = await failure(client.getLocalVariables(FILE_KEY))
    expect(error.code).toBe('invalid-response')
    expect(error.issues?.map((i) => i.path)).toEqual(
      expect.arrayContaining([`meta.variables.${id}.resolvedType`]),
    )
    expect(error.message).toContain(`meta.variables.${id}`)
  })

  it('rejects a response without meta', async () => {
    const client = await start({ [FILE_KEY]: { status: 200, error: false } })
    const error = await failure(client.getLocalVariables(FILE_KEY))
    expect(error.issues?.[0].path).toBe('meta')
  })
})

describe('parseVariablesResponse', () => {
  it('accepts the recorded response and returns data usable as the Figma type', () => {
    const parsed: LocalVariablesResponse = parseVariablesResponse(recording)
    // Compile-time: the validated type is what the rest of the package works with.
    expect(parsed.meta.variableCollections).toBeDefined()
  })

  it('ignores fields it does not read', () => {
    const extended = structuredClone(recording) as unknown as Record<string, unknown>
    extended.somethingNew = { a: 1 }
    expect(() => parseVariablesResponse(extended)).not.toThrow()
  })

  it.each([null, undefined, 42, 'text', [], {}])('rejects %j with a FigmaApiError', (input) => {
    try {
      parseVariablesResponse(input)
      throw new Error('expected a rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(FigmaApiError)
      expect((error as FigmaApiError).code).toBe('invalid-response')
    }
  })
})

describe('postVariables', () => {
  it('sends the payload and returns the temp-id map', async () => {
    const client = await start()
    const payload = {
      variableCollections: [
        { action: 'CREATE' as const, id: 'tmp-collection', name: 'New', initialModeId: 'tmp-mode' },
      ],
    }
    const result = await client.postVariables(FILE_KEY, payload)
    expect(result.meta.tempIdToRealId).toEqual({
      'tmp-collection': expect.any(String),
      'tmp-mode': expect.any(String),
    })
    expect(fake!.requests).toEqual([
      expect.objectContaining({ method: 'POST', fileKey: FILE_KEY, token: TOKEN, body: payload }),
    ])
  })

  it('reports a rejected write as an http error', async () => {
    fake = await startFigmaFake({ files: { [FILE_KEY]: recording }, token: 'other' })
    const error = await failure(
      createFigmaClient({ token: TOKEN, baseUrl: fake.url }).postVariables(FILE_KEY, {}),
    )
    expect(error).toMatchObject({ code: 'http-error', status: 403 })
  })
})

describe('createFigmaClient', () => {
  beforeEach(() => {
    fake = undefined
  })

  it('uses https://api.figma.com unless told otherwise', async () => {
    let requested = ''
    const client = createFigmaClient({
      token: TOKEN,
      fetch: async (url) => {
        requested = String(url)
        return new Response(JSON.stringify(recording), { status: 200 })
      },
    })
    await client.getLocalVariables(FILE_KEY)
    expect(requested).toBe(`https://api.figma.com/v1/files/${FILE_KEY}/variables/local`)
  })
})
