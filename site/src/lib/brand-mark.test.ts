import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MARK_FILES, markColors, markSvg } from './brand-mark'

describe('the DTA mark as a file (TICKET-144)', () => {
  it('draws the favicon in the light theme: blueprint square, ink outline', () => {
    expect(markColors('Light')).toEqual({ fill: '#2f55d4', outline: '#13213f' })
    expect(markSvg('Light')).toContain(
      '<rect x="11" y="3" width="18" height="18" rx="4" fill="#2f55d4"/>',
    )
  })

  it('keeps the outline visible on dark backgrounds, the square the same', () => {
    const light = markColors('Light')
    const dark = markColors('Graphite')
    expect(dark.fill).toBe(light.fill)
    expect(dark.outline).not.toBe(light.outline)
  })

  it('serves a light and a dark file', () => {
    expect(MARK_FILES).toEqual({ light: 'Light', dark: 'Graphite' })
    for (const theme of Object.values(MARK_FILES)) {
      expect(markSvg(theme)).toMatch(
        /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 32 32"/,
      )
    }
  })

  it('takes its colours from the tokens only', () => {
    const source = fs.readFileSync(path.join(import.meta.dirname, 'brand-mark.ts'), 'utf8')
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
})
