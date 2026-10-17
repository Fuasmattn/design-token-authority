import { COMMAND_NAMES } from '@dta/cli'
import { describe, expect, it } from 'vitest'
import { COMMANDS, NPM_RELEASED, TRUST_RUN } from './content'

/** Full command names: `diff`, `skill add`, … */
const registered = new Set(COMMAND_NAMES)

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
