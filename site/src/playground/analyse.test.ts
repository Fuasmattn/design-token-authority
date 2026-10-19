import fs from 'node:fs'
import path from 'node:path'
import { runCli } from '@dta/cli'
import { formatDiagnostic, parseTokenFiles } from '@dta/core'
import { importPluginExport } from '@dta/figma'
import { describe, expect, it } from 'vitest'
import { analyse, collectionDetail, findingChain } from './analyse'
import { EXAMPLE_FILES, EXAMPLES, PROBLEM_EXAMPLE } from './example'

const repo = path.join(import.meta.dirname, '..', '..', '..')
const fixture = (name: string) => path.join(repo, 'test', 'fixtures', name)

/** The finding lines (`error … [rule]`), the summary and the verdict of a `dta lint` run. */
function lintReport(stdout: string) {
  const lines = stdout
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
    .split('\n')
    .map((line) => line.replace(/^[|—o]\s*/, '').trim())
  return {
    findings: lines.filter((line) => /^(error|warn) .* \[[a-z-]+\]$/.test(line)),
    summary: lines.find((line) => / found\.$|^No lint violations found\.$/.test(line)),
    verdict: lines.find((line) => /^Lint (failed|passed)/.test(line)),
  }
}

const primitives = () => {
  const file = EXAMPLE_FILES.find((f) => f.fileName === 'Primitives.Value.json')
  return JSON.parse(file?.content ?? '{}')
}

/** brand-ab's primitives as a tokenHaus plugin export (single mode, Figma's "Mode 1"). */
const tokenHausExport = () =>
  JSON.stringify({
    $name: 'brand-ab',
    $extensions: { 'com.figma': { modes: {} } },
    Primitives: primitives(),
  })

const lineOf = (line: { label: string; text: string }) => `${line.label} ${line.text}`

describe('playground analysis', () => {
  it('bundles the brand-ab example with its six files', () => {
    expect(EXAMPLE_FILES.map((file) => file.fileName)).toEqual([
      'Brand(Alias).BrandA.json',
      'Brand(Alias).BrandB.json',
      'Primitives.Value.json',
      'ScreenType.Desktop.json',
      'ScreenType.Mobile.json',
      'ScreenType.Tablet.json',
    ])
  })

  it('bundles each example from its fixture, file for file', () => {
    for (const example of EXAMPLES) {
      const dir = path.join(fixture(example.name), 'tokens')
      expect(example.files).toEqual(
        fs
          .readdirSync(dir)
          .sort((a, b) => a.localeCompare(b))
          .map((fileName) => ({
            fileName,
            content: fs.readFileSync(path.join(dir, fileName), 'utf8'),
          })),
      )
    }
  })

  it('finds in the "Example with problems" exactly what `dta lint` finds in its fixture', async () => {
    const result = analyse(PROBLEM_EXAMPLE.files)
    const lint = result.lint
    if (!lint) throw new Error('the problem example does not lint')
    const shown = lint.rules.flatMap((rule) => rule.findings.map((f) => f.cli))

    // The real CLI in the fixture project (no lint section: the default rules, as here)
    let out = ''
    const code = await runCli(['lint'], {
      cwd: fixture(PROBLEM_EXAMPLE.name),
      stdout: (text) => void (out += text),
      stderr: (text) => void (out += text),
    })
    expect(code).toBe(2)
    const cli = lintReport(out)
    expect([...shown].sort()).toEqual([...cli.findings].sort())
    expect(lint.summary).toBe(cli.summary)
    expect(lint.verdict).toBe(cli.verdict)
    // ...and the CLI's reference snapshot of it says the same
    const snapshot = lintReport(
      fs.readFileSync(
        path.join(repo, 'test', 'snapshots', PROBLEM_EXAMPLE.name, 'lint', 'stdout.txt'),
        'utf8',
      ),
    )
    expect(snapshot).toEqual(cli)

    // One finding per default rule, so every rule has something to show
    expect(lint.rules.map((rule) => [rule.rule, rule.count])).toEqual([
      ['no-dangling-aliases', '1 error'],
      ['no-circular-aliases', '1 error'],
      ['no-default-mode-names', '1 error'],
    ])
    expect(lint.summary).toBe('3 errors found.')
    expect(lint.counts).toBe('3 errors')
    // The structure still reads: the default mode name is the primitives' one mode
    expect(result.structure?.breakpoints).toEqual(['Desktop', 'Mobile', 'Tablet'])
    expect(result.structure?.brands).toEqual(['BrandA', 'BrandB'])
  })

  it('shows the chain of each problem finding, or why it does not resolve', () => {
    const { model, lint } = analyse(PROBLEM_EXAMPLE.files)
    if (!model || !lint) throw new Error('the problem example does not lint')
    const [dangling, circular, mode] = lint.rules.map((rule) => rule.findings[0])
    expect(findingChain(model, dangling.tokenPath)).toEqual({
      name: 'Colors.Brand.Accent',
      detail: '"Colors.Brand.Accent" aliases "Colors.Foundation.Orange.550", which does not exist.',
    })
    expect(findingChain(model, circular.tokenPath)?.detail).toMatch(/circular/i)
    expect(circular.file).toBe('')
    expect(findingChain(model, mode.tokenPath)).toBeUndefined()
    expect(mode.file).toBe('Primitives.Mode 1.json')
  })

  it('shows the structure of brand-ab as `dta analyze` does, and its clean lint', () => {
    const result = analyse(EXAMPLE_FILES)
    expect(result.format).toBe('dtcg-per-mode')
    expect(result.input).toEqual({ groups: [], failed: false })
    expect(result.structure?.rows.map((row) => [row.name, row.role, row.confidence])).toEqual([
      ['Brand(Alias)', 'brand', '0.94'],
      ['Primitives', 'primitives', '0.90'],
      ['ScreenType', 'dimension', '0.92'],
    ])
    expect(result.structure?.rows[2]).toMatchObject({
      modes: ['Desktop', 'Mobile', 'Tablet'],
      variables: 5,
      aliasShare: '100%',
      low: false,
    })
    expect(result.structure?.brands).toEqual(['BrandA', 'BrandB'])
    expect(result.structure?.breakpoints).toEqual(['Desktop', 'Mobile', 'Tablet'])
    expect(result.structure?.tokens).toBe(42)
    // default rules, as for a project without a lint section: brand-ab passes them
    expect(result.lint).toEqual({
      rules: [
        { rule: 'no-dangling-aliases', count: 'no findings', findings: [] },
        { rule: 'no-circular-aliases', count: 'no findings', findings: [] },
        { rule: 'no-default-mode-names', count: 'no findings', findings: [] },
      ],
      summary: 'No lint violations found.',
      counts: '0 lint findings',
      outcome: 'clean',
      verdict: undefined,
    })
  })

  it('imports a plugin export like `dta pull --from-file`, then lints it', () => {
    const result = analyse([{ fileName: 'export.json', content: tokenHausExport() }])
    const imported = importPluginExport(JSON.parse(tokenHausExport()))
    expect(result.format).toBe('tokenhaus')
    expect(result.files).toEqual(['Primitives.Mode 1.json'])
    expect(result.input.failed).toBe(false)
    expect(result.input.groups.flatMap((g) => g.lines).map(lineOf)).toEqual(
      imported.diagnostics.map((d) => formatDiagnostic(d, { docs: false })),
    )
    expect(result.structure?.rows.map((row) => row.name)).toEqual(['Primitives'])
    // Figma's default mode name is a lint error, worded as `dta lint` prints it
    expect(result.lint?.outcome).toBe('failed')
    expect(result.lint?.verdict).toBe('Lint failed.')
    expect(result.lint?.summary).toBe('1 error found.')
    expect(result.lint?.counts).toBe('1 error')
    const rule = result.lint?.rules.find((r) => r.rule === 'no-default-mode-names')
    expect(rule).toMatchObject({ count: '1 error', severity: 'error' })
    expect(rule?.findings).toEqual([
      {
        severity: 'error',
        label: 'error',
        text: 'Mode name "Mode 1" is a Figma default — rename to something meaningful',
        rule: 'no-default-mode-names',
        cli: 'error Mode name "Mode 1" is a Figma default — rename to something meaningful [no-default-mode-names]',
        file: 'Primitives.Mode 1.json',
        tokenPath: 'Primitives.Mode 1',
      },
    ])
  })

  it('shows the CLI diagnostics for invalid per-mode files and stops there', () => {
    const files = [
      { fileName: 'Brand.BrandA.json', content: '{"Colors": ' },
      { fileName: 'tokens.json', content: '{}' },
      { fileName: 'Base.Value.json', content: '{"Primary": {"$value": "#fff"}}' },
    ]
    const result = analyse(files)
    const expected = parseTokenFiles(files).diagnostics.map((d) =>
      formatDiagnostic(d, { docs: false }),
    )
    expect(expected.length).toBeGreaterThanOrEqual(3)
    expect(result.input.failed).toBe(true)
    expect(result.input.groups.flatMap((g) => g.lines).map(lineOf)).toEqual(expected)
    expect(expected.join('\n')).toMatch(
      /error \[invalid-json\] "Brand\.BrandA\.json" is not valid JSON/,
    )
    expect(expected.join('\n')).toMatch(/must be named \{Collection\}\.\{Mode\}\.json/)
    expect(result.structure).toBeUndefined()
    expect(result.lint).toBeUndefined()
  })

  it('reports an unknown single file the way `dta pull --from-file` does', () => {
    const result = analyse([{ fileName: 'Pasted.json', content: '[1, 2]' }])
    expect(result.format).toBe('unknown')
    expect(result.input.failed).toBe(true)
    const [line] = result.input.groups[0].lines
    expect(lineOf(line)).toMatch(
      /^error \[invalid-export\] Expected the export to be a JSON object/,
    )
  })

  it('reads a single per-mode file under its own name', () => {
    const result = analyse([
      { fileName: 'Primitives.Value.json', content: JSON.stringify(primitives()) },
    ])
    expect(result.format).toBe('dtcg-per-mode')
    expect(result.files).toEqual(['Primitives.Value.json'])
    expect(result.structure?.rows[0]).toMatchObject({ name: 'Primitives', role: 'primitives' })
  })

  it("reads a collection's tokens in a mode: alias chain and resolved value (resolve)", () => {
    const { model } = analyse(EXAMPLE_FILES)
    if (!model) throw new Error('no model')
    const brandA = collectionDetail(model, 'Brand(Alias)')
    expect(brandA?.modes).toEqual(['BrandA', 'BrandB'])
    expect(brandA?.mode).toBe('BrandA')
    const primary = brandA?.lines.find((line) => line.name === 'Colors.Brand.Primary')
    expect(primary?.detail).toMatch(/^→ \{Colors\.Foundation\.[^}]+\}  #[0-9a-f]{6}$/i)
    expect(primary?.swatch).toMatch(/^#/)
    const brandB = collectionDetail(model, 'Brand(Alias)', 'BrandB')
    expect(brandB?.mode).toBe('BrandB')
    expect(brandB?.lines.find((l) => l.name === 'Colors.Brand.Primary')?.detail).not.toBe(
      primary?.detail,
    )
    // Raw values have no chain; an unknown mode falls back to the first.
    const primitives = collectionDetail(model, 'Primitives', 'Nope')
    expect(primitives?.mode).toBe('Value')
    expect(primitives?.lines[0].detail).not.toMatch(/→/)
    expect(collectionDetail(model, 'Missing')).toBeUndefined()
  })

  it('shows the chain of the token a finding is about, and why it does not resolve', () => {
    const files = [
      {
        fileName: 'Primitives.Value.json',
        content: JSON.stringify({ Blue: { $type: 'color', $value: '#2443ac' } }),
      },
      {
        fileName: 'Brand.BrandA.json',
        content: JSON.stringify({
          Primary: { $type: 'color', $value: '{Blue}' },
          Accent: { $type: 'color', $value: '{Orange}' },
        }),
      },
    ]
    const result = analyse(files)
    const dangling = result.lint?.rules.find((r) => r.rule === 'no-dangling-aliases')
    expect(dangling?.count).toBe('1 error')
    const [found] = dangling?.findings ?? []
    expect(found.tokenPath).toBe('Brand.BrandA/Accent')
    const chain = result.model && findingChain(result.model, found.tokenPath)
    expect(chain).toEqual({
      name: 'Accent',
      detail: '"Accent" aliases "Orange", which does not exist.',
    })
    expect(result.model && findingChain(result.model, 'Brand.BrandA/Primary')).toEqual({
      name: 'Primary',
      detail: '→ {Blue}  #2443ac',
      swatch: '#2443ac',
    })
    // A finding about a file or a pair of tokens has no chain.
    expect(result.model && findingChain(result.model, 'Brand.BrandA')).toBeUndefined()
  })
})
