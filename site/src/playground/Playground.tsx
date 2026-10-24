/**
 * The playground app (spec: docs/specs/playground.md, TICKET-077 and TICKET-115), a Preact island
 * on /playground, laid out as a workspace (decision 15):
 * - before loading, the input takes the page (TokenInput: drop area, the two examples, paste
 *   field); "Example with problems" (TICKET-113) is brand-ab with flaws the default rules catch;
 * - after loading, a one-line SourceBar, a SummaryLine that stays visible, and Tabs with the views
 *   Structure · Lint · Graph · Outputs (the selected tab is kept in the URL hash);
 * - details of a collection, a finding or an output file open in a DetailPanel (side panel from
 *   1024px, bottom sheet below), so the view behind stays in place; a finding's panel steps on
 *   to the next finding ("Next finding");
 * - Outputs (TICKET-079): which outputs to build, the files grouped with Copy and Download, one
 *   zip per group and "Download all", and the generated dta.config.ts with the CLI commands.
 * - Graph (TICKET-078): the dependency graph from `@dta/core` for one brand and breakpoint
 *   (GraphSwitcher), drawn as layer columns (GraphCanvas) or, on phones, as a list (GraphList);
 *   a token opens its readings in every mode, as `dta token get` gives them, in the panel. A lint
 *   finding's "Show in graph" and a token's "Show in lint" lead from one view to the other; the
 *   hash keeps the selected token (`#graph/<id>`, its mode chosen from the id).
 * Everything it shows is a design-system component; src/styles/playground.css only places them.
 * Motion (TICKET-116, design-system/motion): a new read is a View Transition (the input collapses
 * into the source bar, the results fade in one after another), a tab change crossfades the view,
 * new output files move into place, the detail panel slides in, and changed counts light up.
 * Nothing is uploaded: the example is bundled and the analysis runs here (analyse.ts). The only
 * requests after load are the page's own lazy chunks (spec decision 9, TICKET-124): the analysis
 * (analyse.ts with `@dta/core`, `@dta/figma`, `@dta/lint` and zod) loads once the browser is idle
 * after the first render, or at once on the first input or a view in the URL hash, whichever
 * comes first; input that arrives before it waits for it ("Reading…" in the summary) and is read
 * once it is there. `@dta/build` (Style Dictionary) and the zip code (outputs-engine.ts) load
 * when the Outputs tab first opens, the graph (graph-engine.ts) when the Graph tab first opens.
 */
import type { BuildResult, OutputFormat } from '@dta/build'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import DetailPanel, { type DetailPanelProps } from '../components/ds/DetailPanel'
import Findings, { findingId } from '../components/ds/Findings'
import SourceBar from '../components/ds/SourceBar'
import StructureTable from '../components/ds/StructureTable'
import SummaryLine, { type SummaryPart, type SummaryTone } from '../components/ds/SummaryLine'
import Tabs, { tabId, type Tab } from '../components/ds/Tabs'
import TokenInput, {
  PASTE_FILE_NAME,
  PasteForm,
  type TokenInputFile,
} from '../components/ds/TokenInput'
import { transition } from '../components/ds/motion'
import type { Outcome, PlaygroundResult, RuleFindings } from './analyse'
import { EXAMPLES, inputExamples, type Example } from './example'
import { ALL_FORMATS, OUTPUT_CHOICES, plural } from './shared'

// The lazy chunks (TICKET-124, spec decision 9): only their types are imported statically.
/** Reading and linting: `@dta/core`, `@dta/figma`, `@dta/lint`, zod. */
type Analysis = typeof import('./analyse')
/** The Outputs tab's components, grouping, config and CLI steps. */
type OutputsUi = typeof import('./outputs-ui')
/** `@dta/build` (Style Dictionary) and the zip code. */
type Engine = typeof import('./outputs-engine')
type Graph = typeof import('./graph-engine')
type Modes = Record<string, string>

const ID = 'pg'
const FINDINGS_ID = `${ID}-finding`
const VIEWS = ['structure', 'lint', 'graph', 'outputs'] as const
type View = (typeof VIEWS)[number]

/**
 * The selected view from the URL hash (`#lint`), and on the graph the selected token
 * (`#graph/Brand(Alias).BrandB/Colors/Brand/Accent`); none for any other hash.
 */
function hashState(): { view?: View; token?: string } {
  const hash = window.location.hash.slice(1)
  const slash = hash.indexOf('/')
  const view = slash < 0 ? hash : hash.slice(0, slash)
  if (!(VIEWS as readonly string[]).includes(view)) return {}
  if (slash < 0 || view !== 'graph') return { view: view as View }
  let token: string | undefined
  try {
    token = decodeURIComponent(hash.slice(slash + 1)) || undefined
  } catch {
    token = undefined
  }
  return { view: 'graph', token }
}

/** The hash for a view, and a token on the graph. */
const hashOf = (view: View, token?: string) => (token ? `#${view}/${encodeURI(token)}` : `#${view}`)

/** The element that shows a token on screen: the canvas row or the list row, whichever shows. */
const visibleNode = (id: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-node]')].find(
    (element) => element.dataset.node === id && element.offsetParent !== null,
  ) ?? null

interface Source {
  label: string
  detail: string
  files: string[]
  /** The plugin export's file name, for `dta pull --from-file` (none for per-mode files). */
  pluginExport?: string
}

/**
 * What the source bar says was read: in the words of `dta pull` for an import. Without a result
 * (the analysis is still loading) what was given: the example, the file or the files.
 */
function sourceOf(
  result: PlaygroundResult | undefined,
  input: readonly TokenInputFile[],
  example: Example | undefined,
): Source {
  const files = result?.files ?? input.map((file) => file.fileName)
  if (example)
    return { label: `${example.name} example`, detail: plural(files.length, 'file'), files }
  if (result && result.format !== 'dtcg-per-mode' && result.format !== 'unknown') {
    const name = input[0]?.fileName
    return {
      label: `${result.format} export`,
      detail: `converted into ${plural(files.length, 'token file')}`,
      files: result.files,
      pluginExport: !name || name === PASTE_FILE_NAME ? 'export.json' : name,
    }
  }
  if (input.length === 1) return { label: input[0].fileName, detail: '1 file', files: [] }
  return { label: 'Your files', detail: plural(input.length, 'file'), files }
}

type Selection =
  | { kind: 'collection'; name: string; mode?: string }
  | { kind: 'finding'; group: number; line: number }
  | { kind: 'file'; path: string }
  | { kind: 'token'; id: string }

/** The outputs built for one read and one choice of formats. */
interface Built extends BuildResult {
  run: number
  formats: string
}

/** The status colour of the lint count: errors, warnings or clean (TICKET-120). */
const LINT_TONE: Record<Outcome, SummaryTone> = {
  failed: 'error',
  warnings: 'warning',
  clean: 'success',
}

/**
 * What the summary says about the outputs: their count once built, that the build failed (broken
 * aliases, TICKET-119: no files), else the way to build them.
 */
function summaryParts(
  result: PlaygroundResult,
  outputs: number | undefined,
  failed: boolean,
): SummaryPart[] {
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
  parts.push({ text: lint.counts, target: 'lint', tone: LINT_TONE[lint.outcome] })
  parts.push({
    text: failed
      ? 'build failed'
      : outputs === undefined
        ? 'build outputs'
        : plural(outputs, 'output file'),
    target: 'outputs',
    tone: failed ? 'error' : undefined,
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

/**
 * The panel's content for what is selected, from the model (`resolve` in @dta/core); a file's
 * only once the Outputs tab's code is there (it is, wherever a file can be selected).
 */
function panelOf(
  { collectionDetail, findingChain }: Analysis,
  result: PlaygroundResult,
  selection: Selection,
  files: FilePreviews | undefined,
): Omit<DetailPanelProps, 'open'> | undefined {
  const { model, structure, lint } = result
  if (!model || !structure || !lint) return undefined
  if (selection.kind === 'token') return undefined
  if (selection.kind === 'file') {
    const file = files?.find(selection.path)
    if (!files || !file) return undefined
    const size = files.size(file.content)
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
    kickerSeverity: found.severity,
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
  /** `746 B`, `1.2 KB`. */
  size: (content: string) => string
  actions: (path: string, content: string) => DetailPanelProps['actions']
}

/** Input given before the analysis arrived: read once it is there (TICKET-124). */
interface Waiting {
  input: readonly TokenInputFile[]
  example?: Example
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
  // Graph (TICKET-078): its chunk loads with the tab; the modes shown (brand, breakpoint) are
  // chosen per collection; `reveal` counts selections made elsewhere, to scroll them into view.
  const [graph, setGraph] = useState<Graph | null>(null)
  const graphLoading = useRef<Promise<Graph> | null>(null)
  const [modes, setModes] = useState<Modes>({})
  const [reveal, setReveal] = useState(0)
  const runNow = useRef(run)
  runNow.current = run
  // The analysis (TICKET-124): its chunk loads once the browser is idle after the first render,
  // or at once when something asks for it (input, a view in the hash): `asked` counts the asks.
  // Input that comes first waits for it (`waiting`) and is read once, when it is here.
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const analysisLoading = useRef<Promise<Analysis> | null>(null)
  const [asked, setAsked] = useState(0)
  const [analysisFailed, setAnalysisFailed] = useState(false)
  const [waiting, setWaiting] = useState<Waiting | null>(null)
  const taken = useRef<Waiting | null>(null)
  const analysisNow = useRef(analysis)
  analysisNow.current = analysis
  const want = () => setAsked((count) => count + 1)
  // The Outputs tab's UI (TICKET-124): its chunk loads with the tab, beside the build's engine.
  const [outputsUi, setOutputsUi] = useState<OutputsUi | null>(null)
  const outputsUiLoading = useRef<Promise<OutputsUi> | null>(null)

  /** Selects a token from its id (a hash, "Show in graph"): its mode is shown, it is revealed. */
  const showToken = (
    id: string,
    result = runNow.current?.result,
    module = analysisNow.current,
  ): boolean => {
    const token = result?.model && module?.parseTokenId(result.model, id)
    if (!token) return false
    setModes((current) => ({ ...current, [token.collection]: token.mode }))
    setSelection({ kind: 'token', id })
    setReveal((count) => count + 1)
    opener.current = null
    return true
  }

  // The selected view lives in the URL hash, so a reload or a shared link keeps it; on the graph
  // also the selected token.
  useEffect(() => {
    const sync = () => {
      const { view: fromHash, token } = hashState()
      if (!fromHash) return
      setView(fromHash)
      // A shared link to a view: the tokens to show it with are coming, so read them at once.
      want()
      if (token && runNow.current) showToken(token)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  // Once the first render is painted and the browser is idle, the analysis loads in the
  // background, so it is usually here before anyone has picked a file (Safari: a timeout).
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const idle = window.requestIdleCallback(want, { timeout: 2000 })
      return () => window.cancelIdleCallback(idle)
    }
    const timer = setTimeout(want, 200)
    return () => clearTimeout(timer)
  }, [])

  // The analysis's chunk: requested once, on the first ask; a failed request can be asked again.
  useEffect(() => {
    if (!asked || analysis) return
    analysisLoading.current ??= import('./analyse')
    let current = true
    analysisLoading.current.then(
      (module) => {
        if (current) setAnalysis(module)
      },
      () => {
        analysisLoading.current = null
        if (current) setAnalysisFailed(true)
      },
    )
    return () => {
      current = false
    }
  }, [asked, analysis])

  // The Outputs tab's UI loads the first time the Outputs view opens.
  useEffect(() => {
    if (view !== 'outputs' || outputsUi) return
    outputsUiLoading.current ??= import('./outputs-ui')
    let current = true
    void outputsUiLoading.current.then((module) => {
      if (current) setOutputsUi(module)
    })
    return () => {
      current = false
    }
  }, [view, outputsUi])

  // The graph's chunk loads the first time the Graph view opens.
  useEffect(() => {
    if (view !== 'graph' || graph) return
    graphLoading.current ??= import('./graph-engine')
    let current = true
    void graphLoading.current.then((module) => {
      if (current) setGraph(module)
    })
    return () => {
      current = false
    }
  }, [view, graph])

  const graphView = useMemo(
    () =>
      graph && run?.result.model && run.result.structure
        ? graph.buildGraph(run.result, modes)
        : null,
    [graph, run, modes],
  )

  // A selection made from another view (or a hash) has no row that opened it: once its row (or
  // finding) is on screen, closing the panel returns focus there (one more render hands it over).
  const [, setOpenerFound] = useState(0)
  const onScreen = (): HTMLElement | null => {
    if (selection?.kind === 'token' && view === 'graph' && graphView) {
      return visibleNode(selection.id)
    }
    if (selection?.kind === 'finding' && view === 'lint') {
      return document.getElementById(findingId(FINDINGS_ID, selection.group, selection.line))
    }
    return null
  }
  const onScreenNow = useRef(onScreen)
  onScreenNow.current = onScreen
  useEffect(() => {
    if (opener.current?.isConnected) return
    const found = onScreen()
    if (!found) return
    opener.current = found
    setOpenerFound((count) => count + 1)
  })

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
    history.replaceState(null, '', hashOf(next as View))
  }

  const readWith = (module: Analysis, input: readonly TokenInputFile[], example?: Example) => {
    const result = module.analyse(input)
    const { view: fromHash, token } = hashState()
    const key = (runNow.current?.key ?? 0) + 1
    transition(() => {
      setRun({ result, source: sourceOf(result, input, example), key })
      setWaiting(null)
      setSelection(null)
      setPasting(false)
      setModes({})
      // A shared link to a token on the graph opens it once the tokens are read.
      if (fromHash === 'graph' && token) showToken(token, result, module)
    }, 'dta-read')
  }

  /** Reads the input now, or once the analysis is here (the summary says "Reading…" until then). */
  const read = (input: readonly TokenInputFile[], example?: Example) => {
    const module = analysisNow.current
    if (module) return readWith(module, input, example)
    transition(() => {
      setWaiting({ input, example })
      setSelection(null)
      setPasting(false)
    }, 'dta-read')
    setAnalysisFailed(false)
    want()
  }

  // Input that came before the analysis: read once it is here, exactly once.
  useEffect(() => {
    if (!analysis || !waiting || taken.current === waiting) return
    taken.current = waiting
    readWith(analysis, waiting.input, waiting.example)
  }, [analysis, waiting])

  const open = (next: Selection, element: HTMLElement) => {
    opener.current = element
    setSelection(next)
    if (next.kind === 'token') history.replaceState(null, '', hashOf('graph', next.id))
  }
  const selectionNow = useRef(selection)
  selectionNow.current = selection
  const close = useCallback(() => {
    // Closed before the opener reached the panel (it is found one render after a selection made
    // in another view): focus is still in the closed panel, so it goes to the row or finding on
    // screen now. Focus anywhere else is the visitor's and stays.
    const active = document.activeElement
    if (active?.closest('dialog.dta-detail')) {
      ;(opener.current?.isConnected ? opener.current : onScreenNow.current())?.focus()
    }
    if (selectionNow.current?.kind === 'token') history.replaceState(null, '', hashOf('graph'))
    setSelection(null)
  }, [])

  /** A finding's "Show in graph": the Graph view with its token selected and in view. */
  const showInGraph = (id: string) =>
    transition(() => {
      if (!showToken(id)) return
      setView('graph')
      history.replaceState(null, '', hashOf('graph', id))
    }, 'dta-tabs')

  /** A token's (or a layer's) "Show in lint": the Lint view with that finding open. */
  const showInLint = (ref: { group: number; line: number } | undefined) => {
    if (!ref) return
    transition(() => {
      opener.current = null
      setView('lint')
      setSelection({ kind: 'finding', ...ref })
      history.replaceState(null, '', hashOf('lint'))
    }, 'dta-tabs')
  }

  /** Another brand or breakpoint: the graph redraws; a selected token follows into that mode. */
  const changeMode = (collection: string, mode: string) => {
    const model = run?.result.model
    transition(() => {
      setModes((current) => ({ ...current, [collection]: mode }))
      if (selection?.kind !== 'token' || !model) return
      const token = analysis?.parseTokenId(model, selection.id)
      if (token?.collection !== collection) return
      const id = `${collection}.${mode}/${token.path}`
      opener.current = null
      setSelection({ kind: 'token', id })
      setReveal((count) => count + 1)
      history.replaceState(null, '', hashOf('graph', id))
    }, 'dta-tabs')
  }

  const sourceBar = (source: Source, focusKey: number) => (
    <SourceBar
      label={source.label}
      detail={source.detail}
      files={source.files}
      pasting={pasting}
      focusKey={focusKey}
      onFiles={(input) => read(input)}
      onPaste={() => transition(() => setPasting(!pasting), 'dta-read')}
    />
  )
  const pasteForm = pasting && (
    <PasteForm
      idPrefix={ID}
      autoFocus
      onFiles={(input) => read(input)}
      onCancel={() => transition(() => setPasting(false), 'dta-read')}
    />
  )

  if (!run || !analysis) {
    if (!waiting) {
      return (
        <div class="pg">
          <TokenInput
            idPrefix={ID}
            examples={inputExamples()}
            onFiles={(input) => read(input)}
            onExample={(id) => {
              const example = EXAMPLES.find((item) => item.name === id)
              if (example) read(example.files, example)
            }}
          />
        </div>
      )
    }
    // Input before the analysis: what was given, and the summary reading it (TICKET-124). The
    // children sit where the loaded page has them, so the bar and the summary stay the same
    // elements when the counts arrive (nothing remounts, fades in again or moves).
    const count = plural(waiting.input.length, 'file')
    return (
      <div class="pg" data-loaded="" data-reading="">
        {sourceBar(sourceOf(undefined, waiting.input, waiting.example), 1)}
        {pasteForm}
        {null}
        <>
          {analysisFailed ? (
            <SummaryLine
              parts={[
                { text: 'The analysis did not load. Reload the page to try again.', tone: 'error' },
              ]}
            />
          ) : (
            <SummaryLine parts={[]} reading={`Reading ${count}…`} />
          )}
        </>
      </div>
    )
  }

  const { result, source } = run
  const { structure, lint } = result
  const findings = lint?.rules.reduce((sum, rule) => sum + rule.findings.length, 0) ?? 0
  const fresh = built && built.run === run.key && built.formats === formatsKey ? built : null
  // While other formats build, the files of this read stay until the new ones replace them.
  const shown = fresh ?? (built && built.run === run.key ? built : null)
  const failed = shown ? analysis.hasErrors(shown.diagnostics) : false
  // `dta build` writes nothing when the build has errors; the playground shows nothing either.
  const outputFiles = shown && !failed ? shown.files : []
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
  // The Outputs tab's parts, once its code is here (only the tab and its files need them).
  const ui = outputsUi
  const groups = ui ? ui.groupOutputs(outputFiles) : []
  const config = ui
    ? ui.generateConfig({
        brands: structure?.brands ?? [],
        formats,
        defineConfig: ui.NPM_RELEASED,
      })
    : ''

  /** The files of the current build, or of the next one when it is still running. */
  const current = async () => {
    if (fresh) return fresh
    const next = await pending.current
    return next && next.run === run.key && next.formats === formatsKey ? next : null
  }
  const download = (path: string, content: string) => save(baseName(path), content, typeOf(path))
  const downloadZip = async (name: string, pick: (files: Built['files']) => Built['files']) => {
    const [module, build] = await Promise.all([loadEngine(), current()])
    if (!build || analysis.hasErrors(build.diagnostics)) return
    const files = pick(build.files)
    save(name, module.zipFiles(files), 'application/zip')
  }
  // Both are offered only in the Outputs view, so its code is there.
  const downloadAll = () =>
    ui &&
    downloadZip('dta-outputs.zip', (files) => [...files, { path: ui.CONFIG_FILE, content: config }])
  const downloadGroup = (id: string) =>
    ui &&
    downloadZip(`dta-${id}.zip`, (files) =>
      ui.groupOutputs(files).flatMap((group) => (group.id === id ? group.files : [])),
    )

  const previews: FilePreviews | undefined = ui
    ? {
        find: (path) => {
          if (path === ui.CONFIG_FILE) return { content: config }
          for (const group of groups) {
            const file = group.files.find((f) => f.path === path)
            // The kicker names the output where the group mixes them: `Output · Tailwind v4 · …`.
            if (file)
              return { content: file.content, group: ui.outputLabel(group, file) ?? group.name }
          }
          return undefined
        },
        size: (content) => ui.formatSize(ui.byteLength(content)),
        actions: (path, content) => (
          <>
            <ui.CopyButton text={content} accessibleLabel={`Copy ${path}`} variant="outline" />
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
    : undefined
  /** A token's panel: every reading as `dta token get` gives it, its names and its findings. */
  function tokenPanel(): Omit<DetailPanelProps, 'open'> | undefined {
    if (selection?.kind !== 'token' || !graph || !graphView) return undefined
    const detail = graph.tokenDetail(result, graphView, selection.id)
    if (!detail) return undefined
    return {
      ...graph.tokenPanelContent(detail, { onLint: showInLint, onMode: changeMode }),
      contentKey: `token-${selection.id}`,
    }
  }

  // A finding's panel steps through every finding, rule by rule, in the order of the Lint view.
  const order = (lint?.rules ?? []).flatMap((rule, group) =>
    rule.findings.map((_, line) => ({ group, line })),
  )
  const at =
    selection?.kind === 'finding'
      ? order.findIndex((f) => f.group === selection.group && f.line === selection.line)
      : -1
  const finding =
    selection?.kind === 'finding'
      ? lint?.rules[selection.group]?.findings[selection.line]
      : undefined
  // A finding about a token leads to it on the graph.
  const inGraph = finding && result.model && analysis.parseTokenId(result.model, finding.tokenPath)
  const found = selection
    ? (panelOf(analysis, result, selection, previews) ?? tokenPanel())
    : undefined
  const panel: Omit<DetailPanelProps, 'open'> | undefined =
    found && at >= 0
      ? {
          ...found,
          links: inGraph ? (
            <button
              type="button"
              class="dta-button outline"
              onClick={() => finding && showInGraph(finding.tokenPath)}
            >
              Show in graph
            </button>
          ) : undefined,
          contentKey: `finding-${order[at].group}-${order[at].line}`,
          next:
            order.length > 1
              ? {
                  label: 'Next finding',
                  position: `${at + 1} of ${order.length}`,
                  onNext: () => {
                    const next = order[(at + 1) % order.length]
                    // Closing returns focus to the row of the finding shown last.
                    opener.current = document.getElementById(
                      findingId(FINDINGS_ID, next.group, next.line),
                    )
                    setSelection({ kind: 'finding', ...next })
                  },
                }
              : undefined,
        }
      : found
  if (panel) lastPanel.current = panel
  const panelContent = panel ?? lastPanel.current
  const collection = selection?.kind === 'collection' ? selection : undefined
  const openFile = selection?.kind === 'file' ? selection.path : undefined
  const tokenId = selection?.kind === 'token' ? selection.id : undefined

  return (
    <div class="pg" data-loaded="">
      {sourceBar(source, run.key)}
      {pasteForm}

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
          banner
        />
      )}

      {structure && lint && (
        <>
          <SummaryLine
            parts={summaryParts(result, outputCount, failed)}
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
                    idPrefix={FINDINGS_ID}
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
                {view === 'graph' &&
                  (graph && graphView ? (
                    <div class="pg-graph">
                      <graph.GraphSwitcher
                        idPrefix={`${ID}-modes`}
                        groups={graphView.switcher}
                        onChange={changeMode}
                        note={graphView.note}
                        narrowNote="On a phone the graph is a list: each layer, its tokens and their alias chains."
                      />
                      <div class="pg-graph__canvas">
                        <graph.GraphCanvas
                          idPrefix={`${ID}-graph`}
                          label={`Dependency graph, ${graphView.label || 'every mode'}`}
                          data={graphView.data}
                          selected={tokenId}
                          onSelect={(id, element) => open({ kind: 'token', id }, element)}
                          onFinding={(id) => showInLint(graphView.layerFindings.get(id))}
                          reveal={reveal}
                        />
                      </div>
                      <div class="pg-graph__list">
                        <graph.GraphList
                          idPrefix={`${ID}-graph-list`}
                          label={`Dependency graph, ${graphView.label || 'every mode'}`}
                          data={graphView.data}
                          selected={tokenId}
                          onSelect={(id, element) => open({ kind: 'token', id }, element)}
                          onFinding={(id) => showInLint(graphView.layerFindings.get(id))}
                          open={graphView.switcher.slice(0, 1).map((group) => group.id)}
                        />
                      </div>
                    </div>
                  ) : (
                    <p class="pg-hint" role="status">
                      Drawing the graph with <code>@dta/core</code>, in your browser…
                    </p>
                  ))}
                {view === 'outputs' && !ui && (
                  <p class="pg-hint" role="status">
                    Building the outputs with <code>@dta/build</code>, in your browser…
                  </p>
                )}
                {view === 'outputs' && ui && (
                  <div class="pg-outputs">
                    <ui.OutputOptions
                      idPrefix={`${ID}-outputs`}
                      options={OUTPUT_CHOICES.map((c) => ({ value: c.format, label: c.label }))}
                      selected={formats}
                      onChange={(next) => setFormats(next as OutputFormat[])}
                    >
                      {formats.length > 0 && !failed && (
                        <button
                          type="button"
                          class="dta-button primary"
                          onClick={() => void downloadAll()}
                        >
                          Download all (.zip)
                        </button>
                      )}
                    </ui.OutputOptions>
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
                    ) : failed ? null : (
                      <p class="pg-hint" role="status">
                        {plural(outputFiles.length, 'file')} as <code>dta build</code> writes them.
                        Select one to see it in full; “Download all” adds{' '}
                        <code>{ui.CONFIG_FILE}</code> to the folders.
                      </p>
                    )}
                    {shown && shown.diagnostics.length > 0 && (
                      <Findings
                        title="Build"
                        level={3}
                        groups={analysis.diagnosticGroups(shown.diagnostics)}
                        summary={
                          failed
                            ? 'The build has errors: dta build writes no files until they are fixed.'
                            : undefined
                        }
                        outcome={failed ? 'failed' : undefined}
                        banner
                      />
                    )}
                    {groups.length > 0 && (
                      <ui.OutputFiles
                        idPrefix={`${ID}-files`}
                        groups={ui.outputFileGroups(groups)}
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
                      <ui.CliHandoff
                        idPrefix={`${ID}-cli`}
                        intro={
                          failed
                            ? 'Once the errors are fixed, dta build writes the files on your machine: the generated config carries the choices above.'
                            : 'The same files on your machine: the generated config carries the choices above.'
                        }
                        config={{
                          name: ui.CONFIG_FILE,
                          size: ui.formatSize(ui.byteLength(config)),
                          content: config,
                        }}
                        configOpen={openFile === ui.CONFIG_FILE}
                        steps={ui.cliSteps({ pluginExport: source.pluginExport })}
                        note={
                          <>
                            The config imports <code>defineConfig</code> from{' '}
                            <code>design-token-authority</code>: install it in your project first (
                            <code>npm install --save-dev design-token-authority</code>).
                          </>
                        }
                        onOpenConfig={(button) =>
                          open({ kind: 'file', path: ui.CONFIG_FILE }, button)
                        }
                        onDownload={() => download(ui.CONFIG_FILE, config)}
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
