/**
 * The playground app (spec: docs/specs/playground.md, TICKET-077 and TICKET-115), a Preact island
 * on /playground, laid out as a workspace (decision 15):
 * - before loading, the input takes the page (TokenInput: drop area, example, paste field);
 * - after loading, a one-line SourceBar, a SummaryLine that stays visible, and Tabs with the views
 *   Structure · Lint · Graph · Outputs (the selected tab is kept in the URL hash);
 * - details of a collection or a finding open in a DetailPanel (side panel from 1024px, bottom
 *   sheet below), so the view behind stays in place.
 * Everything it shows is a design-system component; src/styles/playground.css only places them.
 * No request leaves the page: the example is bundled, the analysis runs here (analyse.ts), and
 * the Outputs view does not load @dta/build yet (TICKET-079).
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import DetailPanel, { type DetailPanelProps } from '../components/ds/DetailPanel'
import Findings from '../components/ds/Findings'
import SourceBar from '../components/ds/SourceBar'
import StructureTable from '../components/ds/StructureTable'
import SummaryLine, { type SummaryPart } from '../components/ds/SummaryLine'
import Tabs, { tabId, type Tab } from '../components/ds/Tabs'
import TokenInput, { PasteForm, type TokenInputFile } from '../components/ds/TokenInput'
import {
  analyse,
  collectionDetail,
  findingChain,
  type PlaygroundResult,
  type RuleFindings,
} from './analyse'
import { EXAMPLE_FILES, EXAMPLE_NAME } from './example'

const ID = 'pg'
const VIEWS = ['structure', 'lint', 'graph', 'outputs'] as const
type View = (typeof VIEWS)[number]

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** The selected view from the URL hash (`#lint`), or none for any other hash. */
function viewOfHash(): View | undefined {
  const hash = window.location.hash.slice(1)
  return (VIEWS as readonly string[]).includes(hash) ? (hash as View) : undefined
}

interface Source {
  label: string
  detail: string
  files: string[]
}

/** What the source bar says was read: in the words of `dta pull` for an import. */
function sourceOf(
  result: PlaygroundResult,
  input: readonly TokenInputFile[],
  example: boolean,
): Source {
  const count = result.files.length
  if (example)
    return { label: `${EXAMPLE_NAME} example`, detail: plural(count, 'file'), files: result.files }
  if (result.format !== 'dtcg-per-mode' && result.format !== 'unknown') {
    return {
      label: `${result.format} export`,
      detail: `converted into ${plural(count, 'token file')}`,
      files: result.files,
    }
  }
  if (input.length === 1) return { label: input[0].fileName, detail: '1 file', files: [] }
  return { label: 'Your files', detail: plural(input.length, 'file'), files: result.files }
}

type Selection =
  | { kind: 'collection'; name: string; mode?: string }
  | { kind: 'finding'; group: number; line: number }

function summaryParts(result: PlaygroundResult): SummaryPart[] {
  const { structure, lint } = result
  if (!structure || !lint) return []
  const parts: SummaryPart[] = [
    { text: plural(structure.rows.length, 'collection'), target: 'structure' },
  ]
  if (structure.brands.length > 0) {
    parts.push({ text: plural(structure.brands.length, 'brand'), target: 'structure' })
  }
  if (structure.breakpoints.length > 0) {
    parts.push({ text: plural(structure.breakpoints.length, 'breakpoint'), target: 'structure' })
  }
  parts.push({ text: plural(structure.tokens, 'token'), target: 'structure' })
  parts.push({ text: lint.counts, target: 'lint' })
  return parts
}

/** The panel's content for what is selected, from the model (`resolve` in @dta/core). */
function panelOf(
  result: PlaygroundResult,
  selection: Selection,
): Omit<DetailPanelProps, 'open'> | undefined {
  const { model, structure, lint } = result
  if (!model || !structure || !lint) return undefined
  if (selection.kind === 'collection') {
    const row = structure.rows.find((r) => r.name === selection.name)
    const detail = collectionDetail(model, selection.name, selection.mode)
    if (!row || !detail) return undefined
    return {
      kicker: `Collection · ${row.role} · ${row.confidence}`,
      title: row.name,
      meta: `${plural(detail.modes.length, 'mode')}: ${detail.modes.join(', ')}. ${detail.meta}`,
      modes: { label: 'Mode', options: detail.modes, selected: detail.mode },
      lines: detail.lines,
      linesLabel: `Tokens of ${row.name} in ${detail.mode}`,
    }
  }
  const rule: RuleFindings | undefined = lint.rules[selection.group]
  const found = rule?.findings[selection.line]
  if (!found) return undefined
  const slash = found.tokenPath.indexOf('/')
  const chain = findingChain(model, found.tokenPath)
  return {
    kicker: `${found.label} · ${found.rule}`,
    title:
      slash >= 0
        ? found.tokenPath
            .slice(slash + 1)
            .split('/')
            .join('.')
        : found.file || found.rule,
    meta: slash >= 0 && found.file ? `In ${found.file}.` : undefined,
    message: found.cli,
    lines: chain ? [chain] : undefined,
    linesLabel: 'Alias chain',
  }
}

export default function Playground() {
  const [run, setRun] = useState<{ result: PlaygroundResult; source: Source; key: number } | null>(
    null,
  )
  const [view, setView] = useState<View>('structure')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [pasting, setPasting] = useState(false)
  const opener = useRef<HTMLElement | null>(null)

  // The selected view lives in the URL hash, so a reload or a shared link keeps it.
  useEffect(() => {
    const sync = () => {
      const fromHash = viewOfHash()
      if (fromHash) setView(fromHash)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const select = (next: string) => {
    if (!(VIEWS as readonly string[]).includes(next)) return
    setView(next as View)
    setSelection(null)
    history.replaceState(null, '', `#${next}`)
  }

  const read = (input: readonly TokenInputFile[], example = false) => {
    const result = analyse(input)
    setRun({ result, source: sourceOf(result, input, example), key: (run?.key ?? 0) + 1 })
    setSelection(null)
    setPasting(false)
  }

  const open = (next: Selection, element: HTMLElement) => {
    opener.current = element
    setSelection(next)
  }
  const close = useCallback(() => setSelection(null), [])

  if (!run) {
    return (
      <div class="pg">
        <TokenInput
          idPrefix={ID}
          example={`${EXAMPLE_NAME}: BrandA and BrandB, three breakpoints`}
          onFiles={(input) => read(input)}
          onExample={() => read(EXAMPLE_FILES, true)}
        />
      </div>
    )
  }

  const { result, source } = run
  const { structure, lint } = result
  const findings = lint?.rules.reduce((sum, rule) => sum + rule.findings.length, 0) ?? 0
  const tabs: Tab[] = [
    { id: 'structure', label: 'Structure' },
    { id: 'lint', label: 'Lint', count: String(findings) },
    { id: 'graph', label: 'Graph' },
    { id: 'outputs', label: 'Outputs' },
  ]
  const panel = selection ? panelOf(result, selection) : undefined
  const collection = selection?.kind === 'collection' ? selection : undefined

  return (
    <div class="pg" data-loaded="">
      <SourceBar
        label={source.label}
        detail={source.detail}
        files={source.files}
        pasting={pasting}
        focusKey={run.key}
        onFiles={(input) => read(input)}
        onPaste={() => setPasting(!pasting)}
      />
      {pasting && (
        <PasteForm
          idPrefix={ID}
          autoFocus
          onFiles={(input) => read(input)}
          onCancel={() => setPasting(false)}
        />
      )}

      {result.input.groups.length > 0 && (
        <Findings
          title="Input"
          groups={result.input.groups}
          summary={
            result.input.failed
              ? 'The input could not be read; nothing else runs until it can.'
              : undefined
          }
          outcome={result.input.failed ? 'failed' : undefined}
        />
      )}

      {structure && lint && (
        <>
          <SummaryLine
            parts={summaryParts(result)}
            onSelect={(target) => {
              select(target)
              document.getElementById(tabId(ID, target))?.focus()
            }}
          />
          <Tabs idPrefix={ID} label="Views" tabs={tabs} selected={view} onSelect={select} sticky>
            <div class="pg-work" data-panel={panel ? '' : undefined}>
              <div class="pg-view">
                {view === 'structure' && (
                  <>
                    <StructureTable
                      caption="Structure"
                      hideCaption
                      rows={structure.rows}
                      brands={structure.brands}
                      selected={collection?.name}
                      onSelect={(name, button) => open({ kind: 'collection', name }, button)}
                    />
                    <p class="pg-hint">
                      Select a collection to see its tokens, their alias chains and values.
                    </p>
                  </>
                )}
                {view === 'lint' && (
                  <Findings
                    title="Default rules"
                    summary={lint.summary}
                    outcome={lint.outcome}
                    verdict={lint.verdict}
                    note="The rules every project gets; a project adds its own in dta.config.ts. A rule with findings opens to its lines, a line to its details."
                    groups={lint.rules.map((rule) => ({
                      title: rule.rule,
                      count: rule.count,
                      severity: rule.severity,
                      lines: rule.findings.map((f) => ({ ...f, detail: f.file || undefined })),
                    }))}
                    selected={selection?.kind === 'finding' ? selection : undefined}
                    onSelect={(group, line, button) =>
                      open({ kind: 'finding', group, line }, button)
                    }
                  />
                )}
                {view === 'graph' && (
                  <p class="pg-coming">
                    The dependency graph, with a brand and breakpoint switcher, comes next
                    (TICKET-078).
                  </p>
                )}
                {view === 'outputs' && (
                  <p class="pg-coming">
                    CSS, Tailwind and JS outputs to preview and download, and the matching{' '}
                    <code>dta.config.ts</code>, come next (TICKET-079).
                  </p>
                )}
              </div>
              <DetailPanel
                idPrefix={`${ID}-detail`}
                open={Boolean(panel)}
                title={panel?.title ?? ''}
                {...panel}
                opener={opener.current}
                onClose={close}
                onMode={(mode) => collection && setSelection({ ...collection, mode })}
              />
            </div>
          </Tabs>
        </>
      )}
    </div>
  )
}
