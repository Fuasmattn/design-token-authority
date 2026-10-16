import { describe, expect, it } from 'vitest'
import { lintTokens } from './index.js'
import { color, fixtureModel, modelFrom } from './test-helpers.js'

describe('lintTokens: result', () => {
  it('finds nothing in a clean model', () => {
    const model = modelFrom({
      'Base.Value.json': { Red: color('#ff0000'), Link: color('{Red}') },
    })
    expect(lintTokens(model)).toEqual({
      violations: [],
      errorCount: 0,
      warningCount: 0,
      diagnostics: [],
    })
  })

  it('finds nothing in an empty model', () => {
    expect(lintTokens({ collections: [] }).violations).toEqual([])
  })

  it('does not mutate the model', () => {
    const model = fixtureModel('brand-ab')
    const before = structuredClone(model)
    lintTokens(model, { rules: { 'no-duplicate-values': {} } })
    expect(model).toEqual(before)
  })
})

describe('no-dangling-aliases', () => {
  const model = modelFrom({
    'Brand.A.json': { Group: { Primary: color('{Colors.Missing}') } },
  })

  it('reports an alias to a token that does not exist, as an error', () => {
    const result = lintTokens(model)
    expect(result.errorCount).toBe(1)
    expect(result.violations).toEqual([
      {
        rule: 'no-dangling-aliases',
        severity: 'error',
        tokenPath: 'Brand.A/Group/Primary',
        file: 'Brand.A.json',
        message: 'Alias {Colors.Missing} references non-existent token "Colors.Missing"',
      },
    ])
  })

  it('cannot be switched off by configuration', () => {
    expect(lintTokens(model, { rules: {} }).errorCount).toBe(1)
  })
})

describe('no-circular-aliases', () => {
  it('reports a chain that leads back to itself', () => {
    const model = modelFrom({ 'Base.Value.json': { A: color('{B}'), B: color('{A}') } })
    const { violations } = lintTokens(model)
    const circular = violations.filter((v) => v.rule === 'no-circular-aliases')
    expect(circular).toHaveLength(1)
    expect(circular[0]).toMatchObject({
      severity: 'error',
      file: '',
      message: 'Circular alias chain: Base.Value/A → Base.Value/B → Base.Value/A',
    })
  })
})

describe('no-default-mode-names', () => {
  const lintModes = (...modes: string[]) =>
    lintTokens(
      modelFrom(
        Object.fromEntries(modes.map((mode) => [`Base.${mode}.json`, { A: color('#fff') }])),
      ),
    ).violations.filter((v) => v.rule === 'no-default-mode-names')

  it.each(['Mode 1', 'Mode1', 'mode 2'])('flags %s as a Figma default', (mode) => {
    expect(lintModes(mode)).toEqual([
      {
        rule: 'no-default-mode-names',
        severity: 'error',
        tokenPath: `Base.${mode}`,
        file: `Base.${mode}.json`,
        message: `Mode name "${mode}" is a Figma default — rename to something meaningful`,
      },
    ])
  })

  it('does not flag meaningful mode names', () => {
    expect(lintModes('Light', 'Dark', 'Model 3')).toEqual([])
  })

  it('reports each file once, however many tokens it has', () => {
    const model = modelFrom({ 'Base.Mode 1.json': { A: color('#fff'), B: color('#000') } })
    expect(lintTokens(model).violations).toHaveLength(1)
  })
})

describe('lintTokens: config validation', () => {
  const model = modelFrom({ 'Base.Value.json': { A: color('#fff') } })

  it.each([undefined, null, {}, { rules: {} }])('accepts %j', (config) => {
    expect(lintTokens(model, config).diagnostics).toEqual([])
  })

  it.each([
    ['a string', 'strict'],
    ['an array', []],
    ['rules as an array', { rules: [] }],
    ['an unknown top-level key', { rulez: {} }],
    ['an unknown rule', { rules: { 'no-such-rule': {} } }],
    ['a bad severity', { rules: { 'no-duplicate-values': { severity: 'loud' } } }],
    ['collections of the wrong type', { rules: { 'semantic-must-alias': { collections: 'A' } } }],
    ['a negative minRatio', { rules: { 'color-contrast': { minRatio: -1 } } }],
    ['a malformed pair', { rules: { 'color-contrast': { pairs: [['a']] } } }],
  ])('reports %s as an error diagnostic without throwing', (_name, config) => {
    const result = lintTokens(model, config)
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toMatchObject({ severity: 'error', code: 'invalid-config' })
    expect(result.diagnostics[0].message.length).toBeGreaterThan(10)
  })

  it('names the failing path in the message', () => {
    const { diagnostics } = lintTokens(model, {
      rules: { 'naming-pattern': { patterns: { Base: 42 } } },
    })
    expect(diagnostics[0].message).toContain('rules.naming-pattern.patterns.Base')
  })

  it('keeps running the valid rules when one rule has bad options', () => {
    const dangling = modelFrom({ 'Base.Value.json': { A: color('{Missing}') } })
    const result = lintTokens(dangling, { rules: { 'semantic-must-alias': { collections: 'A' } } })
    expect(result.diagnostics).toHaveLength(1)
    expect(result.violations.map((v) => v.rule)).toEqual(['no-dangling-aliases'])
  })
})
