import { COMMAND_NAMES } from '@dta/cli'
import { describe, expect, it } from 'vitest'
import { COMMANDS, COMMAND_GRID, NPM_RELEASED, WORKFLOW } from './content'

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
      'DTA does its work',
      'The team decides',
    ])
    for (const beat of WORKFLOW.beats) expect(beat.text).not.toMatch(/\bdta\s+\w/)
    expect(WORKFLOW.end).toBe('Merged')
  })

  it('shows every command of the grid as a shipped dta command, once, in workflow order (TICKET-168)', () => {
    for (const cell of COMMAND_GRID) {
      expect(cell.command.shipped, cell.command.text).toBe(true)
      for (const name of cell.command.uses) expect(registered.has(name), name).toBe(true)
      expect(cell.text.split(/\s+/).length, cell.text).toBeLessThanOrEqual(13)
    }
    const texts = COMMAND_GRID.map((cell) => cell.command.text)
    expect(new Set(texts).size).toBe(texts.length)
    expect(texts.slice(0, 4)).toEqual([
      COMMANDS.pull.text,
      COMMANDS.lint.text,
      COMMANDS.build.text,
      COMMANDS.diff.text,
    ])
  })
})
