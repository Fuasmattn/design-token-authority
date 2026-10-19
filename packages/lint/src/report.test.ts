import { describe, expect, it } from 'vitest'
import {
  BUILT_IN_RULES,
  formatLintSummary,
  formatRuleCount,
  groupViolationsByFile,
  groupViolationsByRule,
  LINT_MESSAGES,
  lintCounts,
  lintTokens,
} from './index.js'
import type { LintViolation } from './index.js'

const violation = (file: string, severity: 'error' | 'warn' = 'warn'): LintViolation => ({
  rule: 'r',
  severity,
  tokenPath: 'A.Value/x',
  file,
  message: 'm',
})

describe('lint report wording', () => {
  it('groups violations by file in the order found, spanning ones under (unknown file)', () => {
    const a1 = violation('A.Value.json')
    const b = violation('B.Value.json')
    const a2 = violation('A.Value.json', 'error')
    const span = violation('')
    expect(groupViolationsByFile([a1, b, a2, span])).toEqual([
      ['A.Value.json', [a1, a2]],
      ['B.Value.json', [b]],
      ['(unknown file)', [span]],
    ])
  })

  it('counts errors first, with plurals, and says when there is nothing', () => {
    expect(lintCounts({ errorCount: 1, warningCount: 8 })).toEqual([
      { severity: 'error', text: '1 error' },
      { severity: 'warn', text: '8 warnings' },
    ])
    expect(formatLintSummary({ errorCount: 0, warningCount: 1 })).toBe('1 warning found.')
    expect(formatLintSummary({ errorCount: 2, warningCount: 0 })).toBe('2 errors found.')
    expect(formatLintSummary({ errorCount: 0, warningCount: 0 })).toBe(LINT_MESSAGES.clean)
    expect(LINT_MESSAGES.clean).toBe('No lint violations found.')
  })

  it('groups violations by rule: the built-in rules first, also when clean, then others', () => {
    const dangling = { ...violation('A.Value.json', 'error'), rule: 'no-dangling-aliases' }
    const naming = { ...violation('A.Value.json'), rule: 'naming-pattern' }
    const groups = groupViolationsByRule([naming, dangling])
    expect(groups.map(([rule, found]) => [rule, found.length])).toEqual([
      ['no-dangling-aliases', 1],
      ['no-circular-aliases', 0],
      ['no-default-mode-names', 0],
      ['naming-pattern', 1],
    ])
    expect(groupViolationsByRule([naming], [])).toEqual([['naming-pattern', [naming]]])
  })

  it('counts one rule, errors first, or says it has no findings', () => {
    expect(formatRuleCount([])).toBe('no findings')
    expect(formatRuleCount([violation('A', 'warn')])).toBe('1 warning')
    expect(formatRuleCount([violation('A', 'warn'), violation('A', 'error')])).toBe(
      '1 error, 1 warning',
    )
  })

  it('names the rules lintTokens runs without a config', () => {
    // A model that breaks each of them once: a dangling alias and a default mode name.
    const result = lintTokens({
      collections: [
        {
          name: 'A',
          modes: ['Mode 1'],
          sources: {},
          tokens: [{ name: ['x'], type: 'color', values: { 'Mode 1': '{missing}' } }],
        },
      ],
    })
    const rules = new Set(result.violations.map((v) => v.rule))
    for (const rule of rules) expect(BUILT_IN_RULES).toContain(rule)
    expect(rules.size).toBe(2)
  })
})
