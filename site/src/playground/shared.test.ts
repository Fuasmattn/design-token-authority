import { OUTPUT_FORMATS } from '@dta/build'
import { describe, expect, it } from 'vitest'
import * as outputs from './outputs'
import { ALL_FORMATS, OUTPUT_CHOICES, plural } from './shared'

describe('shared (what the first load needs, TICKET-124)', () => {
  it('words counts with plurals', () => {
    expect(plural(1, 'file')).toBe('1 file')
    expect(plural(0, 'file')).toBe('0 files')
    expect(plural(3, 'breakpoint')).toBe('3 breakpoints')
  })

  it('offers every output format, all chosen at first', () => {
    expect(OUTPUT_CHOICES.map((choice) => choice.format)).toEqual([...OUTPUT_FORMATS])
    expect(ALL_FORMATS).toEqual([...OUTPUT_FORMATS])
  })

  it('is what outputs.ts exports under the same names', () => {
    expect(outputs.plural).toBe(plural)
    expect(outputs.OUTPUT_CHOICES).toBe(OUTPUT_CHOICES)
    expect(outputs.ALL_FORMATS).toBe(ALL_FORMATS)
  })
})
