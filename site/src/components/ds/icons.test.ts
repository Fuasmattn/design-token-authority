import { describe, expect, it } from 'vitest'
import { ICONS } from './icons.js'

describe('icons', () => {
  it.each(Object.entries(ICONS))('%s is one square path without colours', (_name, icon) => {
    const [x, y, w, h] = icon.viewBox.split(' ').map(Number)
    expect([x, y]).toEqual([0, 0])
    expect(w).toBe(h)
    expect(icon.path).toMatch(/^M[\d.\s,a-zA-Z-]+$/)
    expect(icon.path).not.toMatch(/#|rgb|hsl/i)
  })
})
