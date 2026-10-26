import { COMMAND_NAMES } from '@dta/cli'
import { describe, expect, it } from 'vitest'
import { COMMANDS, NPM_RELEASED, WORKFLOW } from './content'

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

  it('keeps the workflow to three beats without commands (TICKET-155)', () => {
    expect(WORKFLOW.beats.map((beat) => beat.title)).toEqual([
      'Tokens change',
      'Checked, built, rendered',
      'The team decides',
    ])
    for (const beat of WORKFLOW.beats) expect(beat.text).not.toMatch(/\bdta\s+\w/)
    expect(WORKFLOW.end).toBe('Merged')
  })

  it('points to the command reference from the checks beat, and only there (TICKET-169)', () => {
    expect(WORKFLOW.beats.map((beat) => beat.link?.href)).toEqual([
      undefined,
      '/reference/',
      undefined,
    ])
  })
})
