import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(path.join(import.meta.dirname, 'theme.css'), 'utf8')
const declarations = [...css.matchAll(/^\s*(--sl-[\w-]+):\s*([^;]+);/gm)]

describe('Starlight theme', () => {
  it('maps Starlight onto token variables only (no raw colours or sizes)', () => {
    expect(declarations.length).toBeGreaterThan(20)
    for (const [, name, value] of declarations) {
      expect(value, name).toMatch(/^(var\(--[\w-]+\)|none)$/)
    }
  })

  it('uses no colour literals anywhere', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
  })

  it('maps every Starlight shadow to none', () => {
    const shadows = declarations.filter(([, name]) => name.startsWith('--sl-shadow'))
    expect(shadows.map(([, , value]) => value)).toEqual(['none', 'none', 'none'])
  })
})
