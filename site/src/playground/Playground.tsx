/**
 * The playground app (spec: docs/specs/playground.md, TICKET-077 and TICKET-115), a Preact island
 * on /playground, laid out as a workspace (decision 15):
 * - before loading, the input takes the page (TokenInput: drop area, example, paste field);
 * - after loading, a one-line SourceBar, a SummaryLine that stays visible, and Tabs with the views
 *   Structure · Lint · Graph · Outputs (the selected tab is kept in the URL hash);
 * - details of a collection, a finding or an output file open in a DetailPanel (side panel from
 *   1024px, bottom sheet below), so the view behind stays in place;
 * - Outputs (TICKET-079): which outputs to build, the files grouped with Copy and Download, one
 *   zip per group and "Download all", and the generated dta.config.ts with the CLI commands.
 * Everything it shows is a design-system component; src/styles/playground.css only places them.
 * Motion (TICKET-116, design-system/motion): a new read is a View Transition (the input collapses
 * into the source bar, the results fade in one after another), a tab change crossfades the view,
 * new output files move into place, the detail panel slides in, and changed counts light up.
 * Nothing is uploaded: the example is bundled and the analysis runs here (analyse.ts). The only
 * requests after load are the page's own lazy chunks: `@dta/build` (Style Dictionary) and the
 * zip code (outputs-engine.ts) load when the Outputs tab first opens (spec decision 9).
 */
import type { BuildResult, OutputFormat } from '@dta/build'
import { hasErrors } from '@dta/core'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import CliHandoff from '../components/ds/CliHandoff'
import CopyButton from '../components/ds/CopyButton'
import DetailPanel, { type DetailPanelProps } from '../components/ds/DetailPanel'
import Findings from '../components/ds/Findings'
import OutputFiles from '../components/ds/OutputFiles'
import OutputOptions from '../components/ds/OutputOptions'
import SourceBar from '../components/ds/SourceBar'
import StructureTable from '../components/ds/StructureTable'
import SummaryLine, { type SummaryPart } from '../components/ds/SummaryLine'
import Tabs, { tabId, type Tab } from '../components/ds/Tabs'
import TokenInput, {
  PASTE_FILE_NAME,
  PasteForm,
  type TokenInputFile,
} from '../components/ds/TokenInput'
import { transition } from '../components/ds/motion'
import { NPM_RELEASED } from '../landing/content'
import {
  analyse,
  collectionDetail,
  diagnosticGroups,
  findingChain,
  type PlaygroundResult,
  type RuleFindings,
} from './analyse'
import { EXAMPLE_FILES, EXAMPLE_NAME } from './example'
import {
  ALL_FORMATS,
  byteLength,
  cliSteps,
  CONFIG_FILE,
  formatSize,
  generateConfig,
  groupOutputs,
  OUTPUT_CHOICES,
  plural,
  type OutputGroup,
} from './outputs'

type Engine = typeof import('./outputs-engine')

const ID = 'pg'
const VIEWS = ['structure', 'lint', 'graph', 'outputs'] as const
type View = (typeof VIEWS)[number]

/** The selected view from the URL hash (`#lint`), or none for any other hash. */
function viewOfHash(): View | undefined {
  const hash = window.location.hash.slice(1)
  return (VIEWS as readonly string[]).includes(hash) ? (hash as View) : undefined
}

interface Source {
  label: string
  detail: string
  files: string[]
  /** The plugin export's file name, for `dta pull --from-file` (none for per-mode files). */
  pluginExport?: string
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
    const name = input[0]?.fileName
    return {
      label: `${result.format} export`,
      detail: `converted into ${plural(count, 'token file')}`,
      files: result.files,
      pluginExport: !name || name === PASTE_FILE_NAME ? 'export.json' : name,
    }
  }
  if (input.length === 1) return { label: input[0].fileName, detail: '1 file', files: [] }
  return { label: 'Your files', detail: plural(input.length, 'file'), files: result.files }
}

type Selection =
  | { kind: 'collection'; name: string; mode?: string }
  | { kind: 'finding'; group: number; line: number }
  | { kind: 'file'; path: string }

/** The outputs built for one read and one choice of formats. */
interface Built extends BuildResult {
  run: number
  formats: string
}

/** What the summary says about the outputs: their count once built, else the way to build them. */
function summaryParts(result: PlaygroundResult, outputs: number | undefined): SummaryPart[] {
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
  parts.push({
    text: outputs === undefined ? 'build outputs' : plural(outputs, 'output file'),
    target: 'outputs',
  })
  return parts
}

/** Hands a file to the browser's downloads (a blob URL: nothing leaves the page). */
function save(name: string, data: string | Uint8Array, type: string) {
  const blob = new Blob([data as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)
const typeOf = (path: string) =>
  path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'text/plain' // .ts: browsers would label video/mp2t

/** The panel's content for what is selected, from the model (`resolve` in @dta/core). */
function panelOf(
  result: PlaygroundResult,
  selection: Selection,
  files: FilePreviews,
): Omit<DetailPanelProps, 'open'> | undefined {
  const { model, structure, lint } = result
  if (!model || !structure || !lint) return undefined
  if (selection.kind === 'file') {
    const file = files.find(selection.path)
    if (!file) return undefined
    const size = formatSize(byteLength(file.content))
    return {
      kicker: file.group ? `Output · ${file.group} · ${size}` : `Config · ${size}`,
      title: selection.path,
      meta: file.group ? undefined : 'The choices made here, for dta build.',
      actions: files.actions(selection.path, file.content),
      code: file.content,
      codeLabel: `Preview of ${selection.path}`,
    }
  }
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

interface FilePreviews {
  find: (path: string) => { content: string; group?: string } | undefined
  actions: (path: string, content: string) => DetailPanelProps['actions']
}

export default function Playground() {
  const [run, setRun] = useState<{ result: PlaygroundResult; source: Source; key: number } | null>(
    null,
  )
  const [view, setView] = useState<View>('structure')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [pasting, setPasting] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  // Outputs (TICKET-079): the engine loads on first use; the files are built per read and formats.
  const [formats, setFormats] = useState<OutputFormat[]>([...ALL_FORMATS])
  const [built, setBuilt] = useState<Built | null>(null)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [engineLoaded, setEngineLoaded] = useState(false)
  const engine = useRef<Promise<Engine> | null>(null)
  const pending = useRef<Promise<Built | null> | null>(null)
  // The view the build lands in (read when it lands, not when it started).
  const viewNow = useRef<View>(view)
  viewNow.current = view
  // The panel's last content, kept while it closes (it slides out with what it showed).
  const lastPanel = useRef<Omit<DetailPanelProps, 'open'> | undefined>(undefined)

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

  const loadEngine = () => {
    engine.current ??= import('./outputs-engine').then((module) => {
      setEngineLoaded(true)
      return module
    })
    return engine.current
  }

  // Build when the Outputs view is open (the first time loads @dta/build), and once the engine is
  // here also for every new read, so the summary keeps its file count.
  const runKey = run?.key ?? 0
  const formatsKey = formats.join(',')
  const wanted = Boolean(
    run?.result.model && run.result.structure && (view === 'outputs' || engineLoaded),
  )
  useEffect(() => {
    if (!wanted || !run?.result.model || !run.result.structure) return
    if (built && built.run === runKey && built.formats === formatsKey) return
    let current = true
    const model = run.result.model
    const brands = run.result.structure.brands
    const chosen = [...formats]
    const job = loadEngine()
      .then((module) => module.buildFiles(model, { brands, formats: chosen }))
      .then((result) => {
        const next = { ...result, run: runKey, formats: formatsKey }
        if (current) {
          // Files that replace shown ones (other formats) move into place; the first files of a
          // read appear as they are, right where the status was; elsewhere only counts change.
          const land = () => {
            setBuilt(next)
            setBuildError(null)
          }
          const replacing = built?.run === runKey
          if (viewNow.current === 'outputs' && replacing) transition(land, 'dta-outputs')
          else land()
        }
        return next
      })
      .catch((error: unknown) => {
        if (current) setBuildError(error instanceof Error ? error.message : String(error))
        return null
      })
    pending.current = job
    return () => {
      current = false
    }
  }, [wanted, runKey, formatsKey])

  const select = (next: string) => {
    if (!(VIEWS as readonly string[]).includes(next)) return
    setView(next as View)
    setSelection(null)
    history.replaceState(null, '', `#${next}`)
  }

  const read = (input: readonly TokenInputFile[], example = false) => {
    const result = analyse(input)
    transition(() => {
      setRun({ result, source: sourceOf(result, input, example), key: (run?.key ?? 0) + 1 })
      setSelection(null)
      setPasting(false)
    }, 'dta-read')
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
  const fresh = built && built.run === run.key && built.formats === formatsKey ? built : null
  // While other formats build, the files of this read stay until the new ones replace them.
  const shown = fresh ?? (built && built.run === run.key ? built : null)
  const failed = shown ? hasErrors(shown.diagnostics) : false
  // `dta build` writes nothing when the build has errors; the playground shows nothing either.
  const outputFiles = shown && !failed ? shown.files : []
  const groups: OutputGroup[] = groupOutputs(outputFiles)
  const outputCount = formats.length === 0 ? 0 : shown ? outputFiles.length : undefined
  const tabs: Tab[] = [
    { id: 'structure', label: 'Structure' },
    { id: 'lint', label: 'Lint', count: String(findings) },
    { id: 'graph', label: 'Graph' },
    {
      id: 'outputs',
      label: 'Outputs',
      count: outputCount === undefined ? undefined : String(outputCount),
    },
  ]
  const config = generateConfig({
    brands: structure?.brands ?? [],
    formats,
    defineConfig: NPM_RELEASED,
  })

  /** The files of the current build, or of the next one when it is still running. */
  const current = async () => {
    if (fresh) return fresh
    const next = await pending.current
    return next && next.run === run.key && next.formats === formatsKey ? next : null
  }
  const download = (path: string, content: string) => save(baseName(path), content, typeOf(path))
  const downloadZip = async (name: string, pick: (files: Built['files']) => Built['files']) => {
    const [module, build] = await Promise.all([loadEngine(), current()])
    if (!build || hasErrors(build.diagnostics)) return
    const files = pick(build.files)
    save(name, module.zipFiles(files), 'application/zip')
  }
  const downloadAll = () =>
    downloadZip('dta-outputs.zip', (files) => [...files, { path: CONFIG_FILE, content: config }])
  const downloadGroup = (id: string) =>
    downloadZip(`dta-${id}.zip`, (files) =>
      groupOutputs(files).flatMap((group) => (group.id === id ? group.files : [])),
    )

  const previews: FilePreviews = {
    find: (path) => {
      if (path === CONFIG_FILE) return { content: config }
      for (const group of groups) {
        const file = group.files.find((f) => f.path === path)
        if (file) return { content: file.content, group: group.name }
      }
      return undefined
    },
    actions: (path, content) => (
      <>
        <CopyButton text={content} accessibleLabel={`Copy ${path}`} variant="outline" />
        <button
          type="button"
          class="dta-button outline"
          aria-label={`Download ${path}`}
          onClick={() => download(path, content)}
        >
          Download
        </button>
      </>
    ),
  }
  const panel = selection ? panelOf(result, selection, previews) : undefined
  if (panel) lastPanel.current = panel
  const panelContent = panel ?? lastPanel.current
  const collection = selection?.kind === 'collection' ? selection : undefined
  const openFile = selection?.kind === 'file' ? selection.path : undefined

  return (
    <div class="pg" data-loaded="">
      <SourceBar
        label={source.label}
        detail={source.detail}
        files={source.files}
        pasting={pasting}
        focusKey={run.key}
        onFiles={(input) => read(input)}
        onPaste={() => transition(() => setPasting(!pasting), 'dta-read')}
      />
      {pasting && (
        <PasteForm
          idPrefix={ID}
          autoFocus
          onFiles={(input) => read(input)}
          onCancel={() => transition(() => setPasting(false), 'dta-read')}
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
            parts={summaryParts(result, outputCount)}
            onSelect={(target) => {
              if (target !== view) transition(() => select(target), 'dta-tabs')
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
                  <div class="pg-outputs">
                    <OutputOptions
                      idPrefix={`${ID}-outputs`}
                      options={OUTPUT_CHOICES.map((c) => ({ value: c.format, label: c.label }))}
                      selected={formats}
                      onChange={(next) => setFormats(next as OutputFormat[])}
                    >
                      {formats.length > 0 && (
                        <button
                          type="button"
                          class="dta-button primary"
                          onClick={() => void downloadAll()}
                        >
                          Download all (.zip)
                        </button>
                      )}
                    </OutputOptions>
                    {formats.length === 0 ? (
                      <p class="pg-hint">Choose at least one output to build.</p>
                    ) : buildError ? (
                      <p class="pg-hint" role="alert">
                        The outputs could not be built: {buildError}
                      </p>
                    ) : !fresh ? (
                      <p class="pg-hint" role="status">
                        Building the outputs with <code>@dta/build</code>, in your browser…
                      </p>
                    ) : (
                      <p class="pg-hint" role="status">
                        {plural(outputFiles.length, 'file')} as <code>dta build</code> writes them.
                        Select one to see it in full; “Download all” adds <code>{CONFIG_FILE}</code>{' '}
                        to the folders.
                      </p>
                    )}
                    {shown && shown.diagnostics.length > 0 && (
                      <Findings
                        title="Build"
                        level={3}
                        groups={diagnosticGroups(shown.diagnostics)}
                        summary={
                          failed
                            ? 'The build has errors: dta build writes no files until they are fixed.'
                            : undefined
                        }
                        outcome={failed ? 'failed' : undefined}
                      />
                    )}
                    {groups.length > 0 && (
                      <OutputFiles
                        idPrefix={`${ID}-files`}
                        groups={groups.map((group) => ({
                          id: group.id,
                          name: group.name,
                          downloadLabel: `Download ${group.name} (.zip)`,
                          files: group.files.map((file) => ({
                            path: file.path,
                            content: file.content,
                            size: formatSize(byteLength(file.content)),
                          })),
                        }))}
                        selected={openFile}
                        onOpen={(path, button) => open({ kind: 'file', path }, button)}
                        onDownload={(path) => {
                          const file = outputFiles.find((f) => f.path === path)
                          if (file) download(file.path, file.content)
                        }}
                        onDownloadGroup={(id) => void downloadGroup(id)}
                      />
                    )}
                    {formats.length > 0 && (
                      <CliHandoff
                        idPrefix={`${ID}-cli`}
                        intro="The same files on your machine: the generated config carries the choices above."
                        config={{
                          name: CONFIG_FILE,
                          size: formatSize(byteLength(config)),
                          content: config,
                        }}
                        configOpen={openFile === CONFIG_FILE}
                        steps={cliSteps({ pluginExport: source.pluginExport })}
                        note={
                          NPM_RELEASED ? undefined : (
                            <>
                              DTA is not on npm yet (TICKET-090), so <code>npx</code> cannot find it
                              until the first release. Until then, run it from a clone of the
                              repository, as the <a href="/start/quick-start/">Quick start</a>{' '}
                              shows.
                            </>
                          )
                        }
                        onOpenConfig={(button) => open({ kind: 'file', path: CONFIG_FILE }, button)}
                        onDownload={() => download(CONFIG_FILE, config)}
                      />
                    )}
                  </div>
                )}
              </div>
              <DetailPanel
                idPrefix={`${ID}-detail`}
                open={Boolean(panel)}
                title={panelContent?.title ?? ''}
                {...panelContent}
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
