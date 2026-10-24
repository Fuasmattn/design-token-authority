# TICKET-124: Playground first load: load the analysis engine lazily, tighten the budget

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** in review

## Problem

The playground's first-load JavaScript is at 59.9 of its 60 KB gzip budget (`JS_BUDGET_GZIP` in `site/playground.e2e.test.ts`, set in 077 when the first load was 45.5 KB). Every feature since (115, 116, 078, 079, 113, and 092 by making `@dta/lint` reach `resolve`) added a little. The next playground feature will fail the test. Raising the number each time would make the budget meaningless.

## Where the bytes are today

Measured 2026-10-21 on `site/dist` (gzip -9, after 092):

| Chunk                                                                                       | gzip    | Loads                                                   |
| ------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------- |
| `analyse` (`analyse.ts` + `@dta/core`, `@dta/figma`, `@dta/lint`, zod)                      | 35.1 KB | first load                                              |
| `Playground` (the island: `Playground.tsx`, design-system components, outputs UI, examples) | 14.7 KB | first load                                              |
| Preact, hooks, Astro client, page script, preload helper, shared `graph` bits               | 9.8 KB  | first load                                              |
| `graph-engine` (Graph tab)                                                                  | 7.3 KB  | lazily, first time the Graph tab opens (078)            |
| `outputs-engine` (`@dta/build`, Style Dictionary, fflate)                                   | 595 KB  | lazily, first time Outputs opens (079, spec decision 9) |

The tabs are already lazy. What remains is the engine that reads and lints tokens: 60 % of the first load, and the page does not need it until there is input (the empty state shows the drop area, paste form and example buttons only).

## What to build

1. **Load the analysis engine lazily.** `Playground.tsx` stops importing `./analyse` statically; it imports it with `import()`, the way the graph and outputs engines are loaded today. Loading starts:
   - when the browser is idle after the first render (`requestIdleCallback`, with a `setTimeout` fallback), so the engine is usually there before anyone has picked a file; and
   - at once on the first input (file chosen or dropped, paste, an example button, a `#lint/…` / `#graph/…` hash on load), whichever comes first.
     Input that arrives before the engine waits for it; the summary line shows a "Reading…" state without layout shift. Types stay static (`import type`), which costs nothing at runtime.
2. **Move the Outputs tab's UI into the outputs chunk** if it is still statically imported (`OutputOptions`, `OutputFiles`, `CliHandoff`, `outputs.ts`), unless something on first load needs it (e.g. the summary's file count). Measure first; skip if it saves less than 1 KB.
3. **Split the budget.** Replace the single `JS_BUDGET_GZIP` with a first-load budget set just above the new measured first load (rounded up to the next 5 KB) and a budget per lazy chunk (analysis, graph, outputs), so growth anywhere shows up in the test that owns it. Record the numbers and the measurement in the Outcome.
4. **Keep the "no request after load" test honest.** It already counts the lazy chunks (`lazyCount`); the analysis chunk joins that count. No other request.

Out of scope: `zod/mini` (different API, about 14 KB less; 076 "For later"); a separate ticket if the first load must shrink further.

## How lazy loading works here (short)

`import('./analyse')` (with parentheses) is a function call that returns a promise. Because of it, the bundler (Vite, inside Astro) puts `analyse.ts` and everything only it uses into a separate file, and the browser fetches that file only when the call runs. The playground already does this twice:

```ts
engine.current ??= import('./outputs-engine') // start loading once, keep the promise
const { buildOutputs } = await engine.current // later calls reuse the same promise
```

- `??=` assigns only if the ref is empty, so the file is requested once, however often the code runs.
- A `useEffect` with a `current` flag ignores the result if the component moved on before the file arrived.
- `import type { … } from './analyse'` stays a normal line: types disappear at build time and pull nothing into the first load.
- `requestIdleCallback` lets the browser finish painting first, then fetch the engine in the background ("prefetch"), so a visitor rarely waits.

## Decisions

1. **When to load the engine.** Proposal: idle prefetch plus "at once on input" (above). Alternative: only on input (fewer bytes for visitors who just look, but a short wait on the first file). **Decided (maintainer, 2026-10-21): the proposal.**
2. **New budget numbers.** Proposal: set from the measurement as in item 3, rounded up to the next 5 KB. **Decided (maintainer, 2026-10-21): the proposal**; the numbers are recorded in the Outcome.

## Acceptance criteria

- [x] First load contains no `@dta/core`, `@dta/figma`, `@dta/lint` or zod (checked on the built chunks, like 076's metafile check)
- [x] The engine loads on idle and at once on input; input before it arrives is read once it is there; deep links (`#lint/…`, `#graph/…`) still work on load
- [x] Summary shows a reading state while waiting; layout shift 0 at 390 and 1280 in both themes; no horizontal scroll
- [x] Budgets split (first load + one per lazy chunk), numbers recorded; "no request after load" counts the new chunk
- [x] Screenshots 1280 and 390, light and dark (empty state and the reading state), shown before pushing
- [x] Playground spec (decision 9) and the playground docs page updated
- [ ] All gates pass plus the site job, and the GitHub run is green

## Outcome

- **Analysis lazy (item 1).** `Playground.tsx` imports only types from `./analyse`; the module comes with `import('./analyse')` in the existing pattern (ref + `??=` + a `current` flag). An ask counter starts it: `requestIdleCallback` after the first render (timeout 2 s; `setTimeout` 200 ms where there is none, Safari), the first input (file, drop, paste, example) and a view in the hash on load or on `hashchange`. Input that comes first is kept as `waiting`; an effect reads it once when the module arrives (a ref guards against a second read), and the newest input wins if more than one comes first. `readWith` takes the module, so a `#graph/<id>` link opens its token after a delayed read; "Show in graph" and "Show in lint" use the module that is there by then. If the chunk fails to load, the summary says `The analysis did not load. Reload the page to try again.` (error tone, with its marker), and the next input asks again.
- **What the first render needed from the lazy modules:** `parseTokenId`, `collectionDetail`, `findingChain` and `diagnosticGroups` are only used once something is read, so they come from the loaded module (`panelOf` takes it); `hasErrors` (was imported from `@dta/core` directly) is re-exported by `analyse.ts`. The summary's `plural` and the default `ALL_FORMATS`/`OUTPUT_CHOICES` moved to a new dependency-free `src/playground/shared.ts` (`outputs.ts` re-exports them, so callers and tests are unchanged).
- **Outputs UI lazy (item 2).** Measured first: `OutputOptions`, `OutputFiles`, `CliHandoff`, `CopyButton` and `outputs.ts` came to 2.9 KB gzip (esbuild, without Preact), above the 1 KB bar, and nothing on first load needs them (the summary's output count comes from the build result). They are now `src/playground/outputs-ui.ts`, loaded when the Outputs view first opens, beside the engine; the view shows the existing "Building the outputs…" line until it is there. A file's preview in the panel uses it too (a file can only be selected from that view).
- **A bundler fix was needed.** With the analysis lazy, Rolldown (Vite 8) put its namespace helper (`__export`, used by zod and for the `analyse` module object) into the outputs engine chunk, and the analysis chunk then imported the 598 KB engine: idle prefetch would have fetched Style Dictionary on every visit. `codeSplitting.groups` cannot match Rolldown's runtime module; `experimental.chunkOptimization.mergeCommonChunks: false` in `astro.config.mjs` keeps the helper in a 137 B chunk of its own. Every other chunk of the site keeps its name and hash.
- **Reading state (design system first).** `SummaryLine` gained `reading`: one muted part (`fg-muted`, mono meta type) as a polite `role="status"` in a list with `aria-busy`, 24 px tall like a button part, so the counts replace it in place; no spinner, no motion. Docs page Summary line (guideline) and a story `summary-line--reading` (1280 and 390). While reading, the page renders the source bar (what was given) and the summary in the same child positions as the loaded page, so neither remounts or fades in again. **Layout shift:** the views arriving would push the footer down (measured 0.12 at 390 and 0.05 at 1280 without a fix), so `playground.css` hides the footer while `.pg[data-reading]` (`visibility: hidden`, nothing moves); the e2e test checks shift 0 and that the summary keeps its box at 390 and 1280 in both themes, and fails if the rule is removed.
- **Budgets (item 3).** `JS_BUDGET_GZIP` is replaced by `BUDGET` in `site/playground.e2e.test.ts`, each the measured value rounded up to the next 5 KB (gzip level 6 as the test computes it): **first load 25 KB** (measured 22.1), **analysis 40 KB** (36.3), **graph 10 KB** (9.1), **outputs 610 KB** (604.9; rounding up gave 605 KB with 0.1 KB headroom, raised by the maintainer, see below). The first load is computed from the built page (its module scripts and the island's component and renderer, with their static imports), and must contain none of the lazy chunks and no `@dta/core`, `@dta/figma`, `@dta/lint`, zod or Style Dictionary (a marker string from each, checked in the built chunks). Always on (`pnpm test`): `browser-packages.test.ts` bundles `Playground.tsx` with esbuild (code splitting, metafile, like 076) and checks that no `packages/{core,figma,lint,build}` or zod input is in the entry or its static imports, that each sits in a lazy chunk, and that the entry has four dynamic imports. Checked by adding a static `import { analyse } from './analyse'`: the test fails listing the `@dta/figma` inputs.
- **"No request after load" (item 4).** `open()` in the e2e test now waits for the analysis chunk (the idle prefetch) and records every request. The flow test checks that what loaded beyond the first load is only the analysis's lazy chunks (same origin, built JS, carrying the four packages, no Style Dictionary), counts them (`lazyCount`), and that after the example, the picker, a paste, a plugin export and invalid JSON there is no further request. The Outputs and Graph tests keep their own `lazyCount` and now check their budgets.
- **New e2e tests:** a browser that is never idle requests no analysis without input, does with `#lint` and with "Load example"; input before the analysis (chunk held back) shows `Reading 6 files…`, then the counts, analysis requested once, shift 0, nothing wider than the screen (390/1280, light/dark); the last of two inputs given before it is the one read, once; `#graph/<id>` with the example chosen before the analysis opens that token, and "Show in lint"/"Show in graph" work; a failed chunk shows the error part. `contrast.e2e.test.ts` audits the states "reading" and "analysis did not load" at AAA (Light/Graphite, 1280/390) and the new story.
- **Docs:** spec decision 9 (what loads when, the reading state, the budgets; 124 in the ticket list); Start page (the playground paragraph); Summary line docs page; `playground.astro` comment.

**Sizes** (gzip; level 9 as in the table above, level 6 in brackets as the test measures):

| Part                                                                   | Before (2026-10-21) | After                                                                       |
| ---------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------- |
| First load (page script, island, Preact, hooks, Astro client, helpers) | 59.6 KB, 8 files    | 21.9 KB (22.1), 8 files                                                     |
| `Playground` island chunk                                              | 14.7 KB             | 12.8 KB                                                                     |
| `analyse` (+ `@dta/core`, `@dta/figma`, `@dta/lint`, zod)              | 35.2 KB, first load | 34.8 KB, lazy (idle or input); with `graph` shared chunk and helper 36.3 KB |
| Graph tab (`graph-engine` + `transforms`)                              | 9.1 KB              | 9.1 KB                                                                      |
| Outputs tab                                                            | 598.2 KB (engine)   | 3.2 KB `outputs-ui` + 598.2 KB engine (604.9 at level 6)                    |

The first load is down by 37.7 KB. A visitor who reads tokens fetches 58.2 KB in 11 files before opening a tab (was 59.6 KB in 8); the Outputs tab costs 1.3 KB more than before (its UI moved out of the island chunk: 3.2 KB there, 1.9 KB less in `Playground`).

**Files:** `site/src/playground/{Playground.tsx,analyse.ts,outputs.ts,shared.ts,shared.test.ts,outputs-ui.ts,outputs-ui.test.ts}`, `site/src/components/ds/SummaryLine.{tsx,css}`, `site/src/examples/{SummaryLineReading.astro,stories.ts}`, `site/src/styles/playground.css`, `site/astro.config.mjs`, `site/{playground.e2e,contrast.e2e,browser-packages}.test.ts`, `site/src/content/docs/{design-system/components/summary-line.mdx,start/index.mdx}`, `site/src/pages/playground.astro`, `docs/specs/playground.md`.

**Maintainer decisions after the screenshots (2026-10-21):** the reading state stays as it is (muted line, footer hidden while reading; it is rare because the engine usually arrives during the idle time); `mergeCommonChunks: false` stays (the "no request after load" test guards it); the Outputs budget is 610 KB instead of 605 KB, so the next dependency update has room.

**Gates** (Node 24.14.1): prettier, typecheck (site: 0 errors, 0 warnings, 0 hints), boundaries pass; `TERM=xterm-256color CI=true pnpm test` 1215 passed (169 skipped); `snapshot:check` 41 passed, none changed; `pnpm site:build` 138 pages, links valid; `test:contrast` (Chromium) 173 passed; `dta diff` end to end (`DTA_E2E=1`) 3 passed. Nothing committed or pushed.

**Screenshots** (session scratchpad, not committed): `124-empty-{1280,390}-{light,dark}.png`, `124-reading-{1280,390}-{light,dark}.png` (analysis chunk held back after "Load example"), `124-read-{1280,390}-{light,dark}.png` (after it arrived).
