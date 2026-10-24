import { describe, expect, it } from 'vitest'
import * as ui from './outputs-ui'

describe('outputs-ui (the Outputs tab chunk, TICKET-124)', () => {
  it('carries the tab’s components and the helpers its view and file previews use', () => {
    expect(Object.keys(ui).sort()).toEqual([
      'CONFIG_FILE',
      'CliHandoff',
      'CopyButton',
      'NPM_RELEASED',
      'OutputFiles',
      'OutputOptions',
      'byteLength',
      'cliSteps',
      'formatSize',
      'generateConfig',
      'groupOutputs',
      'outputFileGroups',
      'outputLabel',
    ])
    expect(ui.generateConfig({ brands: ['BrandA'], formats: ['css'] })).toContain(
      "formats: ['css']",
    )
  })
})
