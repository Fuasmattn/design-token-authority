import { describe, expect, it } from 'vitest'
import { diffConfigSchema, extractPublishUrl } from './index.js'

describe('extractPublishUrl', () => {
  it('reads the last non-empty line by default', () => {
    const stdout = 'Uploading 42 files\nDone.\nhttps://dta-diff-abc.vercel.app/\n\n'
    expect(extractPublishUrl(stdout)).toBe('https://dta-diff-abc.vercel.app')
  })

  it('rejects anything that is not an http(s) URL', () => {
    expect(extractPublishUrl('Done.')).toBeNull()
    expect(extractPublishUrl('')).toBeNull()
    expect(extractPublishUrl('ftp://host/x')).toBeNull()
    expect(extractPublishUrl('https://a b')).toBeNull()
  })

  it('follows a JSON path into the printed JSON', () => {
    const json = JSON.stringify({ deployment: { url: 'https://x.example.com/r/1' } })
    expect(extractPublishUrl(json, '$.deployment.url')).toBe('https://x.example.com/r/1')
    expect(extractPublishUrl(`log line\n${json}`, '$.deployment.url')).toBe(
      'https://x.example.com/r/1',
    )
    expect(extractPublishUrl(json, '$.missing.url')).toBeNull()
  })

  it('uses the first group of a regular expression', () => {
    expect(extractPublishUrl('Preview: https://p.example.com (ready)', 'Preview: (\\S+)')).toBe(
      'https://p.example.com',
    )
    expect(extractPublishUrl('see https://p.example.com', 'https://\\S+')).toBe(
      'https://p.example.com',
    )
    expect(extractPublishUrl('x', '(')).toBeNull()
  })
})

describe('diff.publish config', () => {
  it('takes a command, or a command with a URL pattern', () => {
    expect(diffConfigSchema.parse({ outDir: 'dist', publish: 'sh publish.sh' }).publish).toBe(
      'sh publish.sh',
    )
    expect(
      diffConfigSchema.parse({
        outDir: 'dist',
        publish: { command: 'vercel deploy', url: '$.url' },
      }).publish,
    ).toEqual({ command: 'vercel deploy', url: '$.url' })
    expect(diffConfigSchema.safeParse({ outDir: 'dist', publish: { url: '$.url' } }).success).toBe(
      false,
    )
  })
})
