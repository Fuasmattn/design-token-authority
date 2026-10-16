import { describe, expect, it } from 'vitest'
import { lintTokens } from './index.js'
import { color, fixtureModel, modelFrom, num } from './test-helpers.js'

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

describe('semantic-must-alias', () => {
  const model = modelFrom({
    'Base.Value.json': { Blue: color('#00f') },
    'Brand.A.json': { Primary: color('{Blue}'), Raw: color('#fff') },
    'Other.A.json': { Raw: color('#000') },
  })
  const rules = (options: object) => ({ rules: { 'semantic-must-alias': options } })

  it('flags raw values in the listed collections as warnings by default', () => {
    const result = lintTokens(model, rules({ collections: ['Brand'] }))
    expect(result.violations).toEqual([
      {
        rule: 'semantic-must-alias',
        severity: 'warn',
        tokenPath: 'Brand.A/Raw',
        file: 'Brand.A.json',
        message: 'Token has a raw value "#fff" but should be an alias in collection "Brand"',
      },
    ])
    expect(result.warningCount).toBe(1)
    expect(result.errorCount).toBe(0)
  })

  it('respects error and off, and does nothing without collections', () => {
    expect(lintTokens(model, rules({ collections: ['Brand'], severity: 'error' })).errorCount).toBe(
      1,
    )
    expect(
      lintTokens(model, rules({ collections: ['Brand'], severity: 'off' })).violations,
    ).toEqual([])
    expect(lintTokens(model, rules({})).violations).toEqual([])
  })
})

describe('naming-pattern', () => {
  const model = modelFrom({
    'Brand.A.json': { Good: { Name: color('#fff') }, Group: { bad: color('#000') } },
    'Other.A.json': { bad: color('#000') },
  })
  const rules = (patterns: Record<string, string>) => ({
    rules: { 'naming-pattern': { patterns } },
  })

  it('reports the first failing segment per token and ignores collections without a pattern', () => {
    const result = lintTokens(model, rules({ Brand: '^[A-Z]' }))
    expect(result.violations).toEqual([
      {
        rule: 'naming-pattern',
        severity: 'warn',
        tokenPath: 'Brand.A/Group/bad',
        file: 'Brand.A.json',
        message: 'Token path segment "bad" does not match pattern /^[A-Z]/ for collection "Brand"',
      },
    ])
  })

  it('skips an invalid regular expression with a diagnostic and still runs the others', () => {
    const result = lintTokens(model, rules({ Brand: '(', Other: '^[A-Z]' }))
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0].code).toBe('invalid-config')
    expect(result.diagnostics[0].message).toContain('Brand')
    expect(result.violations.map((v) => v.tokenPath)).toEqual(['Other.A/bad'])
  })
})

describe('color-contrast', () => {
  const model = modelFrom({
    'Base.Value.json': { Dark: color('#000000'), Light: color('#ffffff'), Grey: color('#777777') },
    'Brand.A.json': {
      Text: { Main: color('#777777') },
      Bg: color('#888888'),
      Via: color('{Dark}'),
    },
    'Brand.B.json': { Text: { Main: color('#999999') } },
  })
  const rules = (options: object) => ({ rules: { 'color-contrast': options } })

  it('flags pairs below the default 4.5 ratio, in dot or slash form', () => {
    const result = lintTokens(model, rules({ pairs: [['Text.Main', 'Bg']] }))
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({
      rule: 'color-contrast',
      severity: 'warn',
      tokenPath: 'Text.Main / Bg',
      file: 'Brand.B.json',
    })
    expect(result.violations[0].message).toMatch(
      /^Contrast ratio \d\.\d\d:1 between "Text\.Main" \(#999999\) and "Bg" \(#888888\) is below 4\.5:1$/,
    )
    expect(lintTokens(model, rules({ pairs: [['Text/Main', 'Bg']] })).violations).toHaveLength(1)
  })

  it('honours minRatio and passes sufficient contrast', () => {
    expect(lintTokens(model, rules({ pairs: [['Dark', 'Light']] })).violations).toEqual([])
    expect(
      lintTokens(model, rules({ pairs: [['Dark', 'Light']], minRatio: 30 })).violations,
    ).toHaveLength(1)
  })

  it('skips aliased and missing tokens (legacy quirk)', () => {
    const pairs = [
      ['Via', 'Light'],
      ['Nope', 'Light'],
    ]
    expect(lintTokens(model, rules({ pairs })).violations).toEqual([])
  })

  it('looks tokens up by in-file name in any mode, the last one winning (legacy quirk)', () => {
    // Text.Main exists in Brand.A (#000000, passes) and Brand.B (#999999, fails); Brand.B is last.
    const result = lintTokens(model, rules({ pairs: [['Text.Main', 'Light']] }))
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].message).toContain('(#999999)')
  })

  it('skips unparseable colours without throwing', () => {
    const odd = modelFrom({ 'Base.Value.json': { A: color('#zzz'), B: color('#fff') } })
    expect(lintTokens(odd, rules({ pairs: [['A', 'B']] })).violations).toEqual([])
  })

  it('rejects invalid options in the config', () => {
    const result = lintTokens(model, rules({ minRatio: 'high', pairs: [['A']] }))
    expect(result.diagnostics.length).toBeGreaterThan(0)
  })
})

describe('no-duplicate-values', () => {
  const rules = { rules: { 'no-duplicate-values': {} } }

  it('reports every member except the first, naming the others', () => {
    const model = modelFrom({
      'Base.Value.json': { A: color('#fff'), B: color('#fff'), C: color('#fff'), D: color('#000') },
    })
    const result = lintTokens(model, rules)
    expect(result.violations.map((v) => [v.tokenPath, v.message])).toEqual([
      ['Base.Value/B', 'Duplicate value "#fff" — also defined in: Base.Value/A, Base.Value/C'],
      ['Base.Value/C', 'Duplicate value "#fff" — also defined in: Base.Value/A, Base.Value/B'],
    ])
    expect(result.violations[0]).toMatchObject({ severity: 'warn', file: 'Base.Value.json' })
  })

  it('ignores aliases and separates types (legacy quirk)', () => {
    const model = modelFrom({
      'Base.Value.json': { A: color('#fff'), N: num(1), S: { $type: 'string', $value: '1' } },
      'Brand.A.json': { X: color('{A}'), Y: color('{A}') },
    })
    expect(lintTokens(model, rules).violations).toEqual([])
  })

  it('compares across collections and modes (legacy quirk)', () => {
    const model = modelFrom({
      'Base.Value.json': { A: color('#fff') },
      'Other.One.json': { B: color('#fff') },
      'Other.Two.json': { B: color('#fff') },
    })
    expect(lintTokens(model, rules).violations.map((v) => v.tokenPath)).toEqual([
      'Other.One/B',
      'Other.Two/B',
    ])
  })

  it('respects severity off and error', () => {
    const model = modelFrom({ 'Base.Value.json': { A: color('#fff'), B: color('#fff') } })
    const run = (severity: string) =>
      lintTokens(model, { rules: { 'no-duplicate-values': { severity } } })
    expect(run('off').violations).toEqual([])
    expect(run('error').errorCount).toBe(1)
  })
})
