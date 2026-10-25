import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolvePage, serveStatic, type StaticServer } from './static-server.js'

let root: string
let server: StaticServer
const put = (file: string, content = '') => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), content)
}

beforeAll(async () => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-static-')))
  put('index.html', 'home')
  put('about.html', 'about')
  put('docs/index.html', 'docs')
  put('feed.xml', 'feed')
  fs.mkdirSync(path.join(root, 'empty'))
  server = await serveStatic(root)
})
afterAll(async () => {
  await server.close()
  fs.rmSync(root, { recursive: true, force: true })
})

describe('resolvePage (TICKET-148)', () => {
  it('finds a page as a file, as <page>.html or as <page>/index.html', () => {
    expect(resolvePage(root, '/')).toBe(path.join(root, 'index.html'))
    expect(resolvePage(root, '/about')).toBe(path.join(root, 'about.html'))
    expect(resolvePage(root, '/docs')).toBe(path.join(root, 'docs', 'index.html'))
    expect(resolvePage(root, '/docs/')).toBe(path.join(root, 'docs', 'index.html'))
    expect(resolvePage(root, '/feed.xml')).toBe(path.join(root, 'feed.xml'))
    expect(resolvePage(root, '/about?tab=1#team')).toBe(path.join(root, 'about.html'))
  })

  it('finds nothing for a missing page, a folder without index.html, or a path outside', () => {
    expect(resolvePage(root, '/missing')).toBeNull()
    expect(resolvePage(root, '/empty')).toBeNull()
    expect(resolvePage(root, '/../etc/passwd')).toBeNull()
  })
})

describe('serveStatic', () => {
  it('serves what resolvePage finds, so the pages dta diff lists are the pages it renders', async () => {
    for (const [url, body] of [
      ['/', 'home'],
      ['/about', 'about'],
      ['/docs', 'docs'],
      ['/docs/', 'docs'],
    ]) {
      const response = await fetch(`${server.url}${url}`)
      expect(response.status, url).toBe(200)
      expect(await response.text(), url).toBe(body)
    }
    expect((await fetch(`${server.url}/about`)).headers.get('content-type')).toContain('text/html')
    expect((await fetch(`${server.url}/missing`)).status).toBe(404)
  })
})
