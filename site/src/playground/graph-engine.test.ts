import { describe, expect, it } from 'vitest'
import { analyse } from './analyse'
import * as engine from './graph-engine'
import { PROBLEM_EXAMPLE } from './example'

describe('graph-engine (the Graph tab chunk)', () => {
  it('carries the model mapping, the token panel and the three graph components', () => {
    expect(Object.keys(engine).sort()).toEqual([
      'GraphCanvas',
      'GraphList',
      'GraphSwitcher',
      'buildGraph',
      'idInModes',
      'parseNodeId',
      'tokenDetail',
      'tokenPanelContent',
    ])
    const result = analyse(PROBLEM_EXAMPLE.files)
    const view = engine.buildGraph(result)
    const detail = engine.tokenDetail(result, view, 'ScreenType.Desktop/Spacing/Gap')
    expect(detail && engine.tokenPanelContent(detail).title).toBe('Spacing.Gap')
  })
})
