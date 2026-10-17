import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMMANDS, NPM_RELEASED, TRUST_RUN } from './content'

const cli = fs.readFileSync(
  path.resolve(import.meta.dirname, '../../../packages/cli/src/commands.ts'),
  'utf8',
)
const registered = new Set([...cli.matchAll(/name: '([a-z:-]+)'/g)].map((m) => m[1]))

describe('landing page honesty rule', () => {
  it('shows only commands that work as written as shipped; the rest are labelled coming', () => {
    for (const command of Object.values(COMMANDS)) {
      const exists = command.uses.every((name) => registered.has(name))
      const needsRelease = /^(npx |npm create )/.test(command.text)
      const runnable = !needsRelease || NPM_RELEASED
      expect(exists && runnable, `${command.text} is marked shipped: ${command.shipped}`).toBe(
        command.shipped,
      )
    }
  })

  it('never shows `npx dta` (that npm name belongs to another package)', () => {
    for (const command of Object.values(COMMANDS)) expect(command.text).not.toMatch(/npx dta\b/)
  })

  it('runs the trust terminal on a shipped command', () => {
    expect(TRUST_RUN.lines[0].map((s) => s.text).join('')).toBe('$ npx dta diff')
    expect(registered.has('diff')).toBe(true)
  })
})
