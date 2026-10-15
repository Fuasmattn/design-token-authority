import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { captureScenario, startFigmaFake, type FigmaFake } from './index.js'

const FILE_KEY = 'TESTFILEKEY'
const TOKEN = 'test-token'

const recording = {
  status: 200,
  error: false,
  meta: {
    variableCollections: {
      'VariableCollectionId:1:1': { id: 'VariableCollectionId:1:1', name: 'Primitives' },
    },
    variables: {},
  },
} as never

let fake: FigmaFake

beforeEach(async () => {
  fake = await startFigmaFake({ files: { [FILE_KEY]: recording }, token: TOKEN })
})

afterEach(async () => {
  await fake.close()
})

const get = (route: string, token: string | null = TOKEN) =>
  fetch(`${fake.url}${route}`, { headers: token === null ? {} : { 'X-Figma-Token': token } })

const post = (route: string, body: unknown, token: string | null = TOKEN) =>
  fetch(`${fake.url}${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token === null ? {} : { 'X-Figma-Token': token }),
    },
    body: JSON.stringify(body),
  })

describe('GET /v1/files/:key/variables/local', () => {
  it('replays the recorded response for the file key', async () => {
    const response = await get(`/v1/files/${FILE_KEY}/variables/local`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(recording)
  })

  it('answers 404 for a file key it has no recording for', async () => {
    const response = await get('/v1/files/OTHER/variables/local')
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ status: 404, error: true })
  })

  it('answers 403 when the token is missing or wrong', async () => {
    for (const token of [null, 'wrong']) {
      const response = await get(`/v1/files/${FILE_KEY}/variables/local`, token)
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ status: 403, error: true })
    }
  })

  it('accepts any token when none is configured', async () => {
    const open = await startFigmaFake({ files: { [FILE_KEY]: recording } })
    try {
      const response = await fetch(`${open.url}/v1/files/${FILE_KEY}/variables/local`)
      expect(response.status).toBe(200)
    } finally {
      await open.close()
    }
  })
})

describe('POST /v1/files/:key/variables', () => {
  const payload = {
    variableCollections: [{ action: 'CREATE', id: 'tmp-c1', name: 'New', initialModeId: 'tmp-m1' }],
    variableModes: [
      { action: 'CREATE', id: 'tmp-m2', name: 'Dark', variableCollectionId: 'tmp-c1' },
    ],
    variables: [
      { action: 'CREATE', id: 'tmp-v1', name: 'a', variableCollectionId: 'tmp-c1' },
      { action: 'UPDATE', id: 'VariableID:1:5', name: 'b' },
    ],
    variableModeValues: [{ variableId: 'tmp-v1', modeId: 'tmp-m1', value: 1 }],
  }

  it('maps every created id to a new real id and leaves updates alone', async () => {
    const response = await post(`/v1/files/${FILE_KEY}/variables`, payload)
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      status: number
      error: boolean
      meta: { tempIdToRealId: Record<string, string> }
    }
    expect(body).toMatchObject({ status: 200, error: false })
    const map = body.meta.tempIdToRealId
    expect(Object.keys(map).sort()).toEqual(['tmp-c1', 'tmp-m1', 'tmp-m2', 'tmp-v1'])
    expect(new Set(Object.values(map)).size).toBe(4)
    expect(map['tmp-v1']).not.toBe('tmp-v1')
  })

  it('records the payload so a test can assert on it', async () => {
    await post(`/v1/files/${FILE_KEY}/variables`, payload)
    expect(fake.requests).toHaveLength(1)
    expect(fake.requests[0]).toEqual({
      method: 'POST',
      path: `/v1/files/${FILE_KEY}/variables`,
      fileKey: FILE_KEY,
      token: TOKEN,
      body: payload,
    })
  })

  it('does not record or accept a request with a wrong token', async () => {
    const response = await post(`/v1/files/${FILE_KEY}/variables`, payload, 'wrong')
    expect(response.status).toBe(403)
    expect(fake.requests.filter((r) => r.method === 'POST')).toEqual([])
  })

  it('answers 400 for a body that is not JSON', async () => {
    const response = await fetch(`${fake.url}/v1/files/${FILE_KEY}/variables`, {
      method: 'POST',
      headers: { 'X-Figma-Token': TOKEN },
      body: '{ nope',
    })
    expect(response.status).toBe(400)
  })
})

describe('requests and shutdown', () => {
  it('records reads too, in order, without a body', async () => {
    await get(`/v1/files/${FILE_KEY}/variables/local`)
    await post(`/v1/files/${FILE_KEY}/variables`, {})
    expect(fake.requests.map((r) => r.method)).toEqual(['GET', 'POST'])
    expect(fake.requests[0]).toMatchObject({ fileKey: FILE_KEY, token: TOKEN, body: undefined })
  })

  it('answers 404 for unknown routes', async () => {
    expect((await get('/v1/me')).status).toBe(404)
  })

  it('stops listening when closed', async () => {
    await fake.close()
    await expect(get(`/v1/files/${FILE_KEY}/variables/local`)).rejects.toThrow()
    fake = await startFigmaFake({ files: {} }) // so afterEach has something to close
  })
})

describe('redirecting a CLI to the fake', () => {
  let tmp: string

  beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'testkit-figma-')))
    fs.mkdirSync(path.join(tmp, 'fixture'))
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  const script = `
    require('https').get(
      { hostname: 'api.figma.com', path: '/v1/files/${FILE_KEY}/variables/local', headers: { 'X-Figma-Token': '${TOKEN}' } },
      (res) => { let data = ''; res.on('data', (c) => (data += c)); res.on('end', () => console.log(res.statusCode, data.length > 0)) },
    ).on('error', (e) => { console.log('error', e.code); process.exit(1) })
  `

  const run = (figmaApiUrl?: string) =>
    captureScenario({
      fixtureDir: path.join(tmp, 'fixture'),
      scenario: { name: 'redirect', args: [] },
      cli: { command: process.execPath, args: ['-e', script, '--'] },
      repoRoot: path.join(tmp, 'repo'),
      figmaApiUrl,
    })

  it('sends requests for api.figma.com to the fake', async () => {
    const result = await run(fake.url)
    expect(result.stdout).toBe('200 true\n')
    expect(fake.requests).toHaveLength(1)
    expect(fake.requests[0]).toMatchObject({ method: 'GET', fileKey: FILE_KEY, token: TOKEN })
  })

  it('leaves other hosts alone', async () => {
    const other = `
      require('https').get({ hostname: 'localhost', port: 1, path: '/' })
        .on('error', (e) => console.log(e.code))
    `
    const result = await captureScenario({
      fixtureDir: path.join(tmp, 'fixture'),
      scenario: { name: 'other-host', args: [] },
      cli: { command: process.execPath, args: ['-e', other, '--'] },
      repoRoot: path.join(tmp, 'repo'),
      figmaApiUrl: fake.url,
    })
    expect(result.stdout).toBe('ECONNREFUSED\n')
    expect(fake.requests).toEqual([])
  })
})
