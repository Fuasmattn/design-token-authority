# TICKET-078: Playground: dependency graph with brand and breakpoint switcher

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** Medium
**Effort:** M
**Blocked by:** 077, 115, 113, 120
**Status:** done (pending the GitHub run)
**Spec:** [playground](../specs/playground.md) (decisions 3, 5, 8, 15, 16)

## What to build

The Graph tab (today a "comes next" note in `Playground.tsx`) shows the token dependency graph from `@dta/core` (alias chains, cycles, dangling aliases, orphans) with a brand and breakpoint switcher. It is the last playground view.

1. **Graph from the engine.** Nodes and edges come from `@dta/core`'s graph analysis for the selected brand and breakpoint (mode selection as `dta token get`); layers follow the 3-layer model (Primitives → Brand → ScreenType). No playground copy of the analysis.
2. **Findings in the status colours (120).** Nodes and edges with a lint finding carry its severity in `status.{error,warning}.{marker,text,subtle}` with shape + word (never colour alone). Dangling and circular aliases are errors. `signal` is not used here: nothing in the graph is a change.
3. **Selecting a token opens its alias chain in the `DetailPanel`** (side panel on desktop, bottom sheet on phones), the same chain wording as `dta token get` (value per mode, chain, CSS/Tailwind names where available). The graph stays in place behind it; the selected node and its chain are highlighted in the blueprint selection (`action-*`).
4. **"Show in graph" becomes live.** In the panel of a lint finding (Lint tab), "Show in graph" switches to the Graph tab with that token selected and in view; the URL hash records tab and selection (as 115). From the graph, a node's findings link back to the Lint tab ("Show in lint").
5. **Keyboard and phones.** The graph is keyboard-navigable (focus moves along nodes/edges, Enter opens the panel). At 390 px the graph falls back to a list (layer → tokens → their alias chains) with the same selection and panel; no pinch-zoom dependency.
6. **Motion** per the motion rule (116): selection and tab switches use the motion tokens; reduced motion keeps the highlights.
7. **Design system first.** New UI (graph canvas, node, edge legend, switcher if not already there) becomes design-system components with docs pages and stories (1280 and 390) before use.

**New visual direction → design board first.** No board covers the graph yet (`docs/specs/playground/prototypes/Main.dc.html` only has the placeholder). A board (desktop 1280 and phone 390, light and dark) is made and shown to the maintainer; building waits for "looks good".

## Acceptance criteria

- [x] Design board approved by the maintainer (2026-10-20: `docs/specs/playground/prototypes/Graph.dc.html`)
- [x] Graph from `@dta/core` analysis with brand and breakpoint switcher; keyboard-navigable; list fallback at 390 px
- [x] Findings in the status colours, shape + word; dangling and circular aliases shown as errors
- [x] Selecting a token opens its alias chain in the `DetailPanel`; "Show in graph" and "Show in lint" work both ways, state in the URL hash
- [x] Design-system components, docs pages and stories (1280 and 390) for everything new; playground and design-system docs updated
- [x] AAA text contrast, 3:1 markers in both themes (`test:contrast`), layout shift 0, reduced motion
- [x] Decision on reusing it for `dta graph --format html` recorded: later, separate ticket (spec decision 8)
- [x] Playground JS budget (60 KB gzip for the page) holds, or the graph loads lazily like the outputs
- [x] Screenshots 1280 and 390, light and dark, shown before pushing
- [ ] All gates pass plus the site job, and the GitHub run is green

## Outcome

**Board decisions (approved with the board, 2026-10-20; the board's proposals for its open questions):**
1. A dangling alias ends in a "missing" node built in the playground from the alias's target name (the engine reports it in `danglingAliases`, not as a node).
2. Brand and breakpoint: segmented buttons on desktop, native selects on phones.
3. The graph shows one brand; the panel shows every brand (as `dta token get`); "Show BrandB" switches the graph.
4. URL hash `#graph/<node id>` (with the brand/breakpoint needed to show it).
5. A selected error node keeps its status marker (follows 121 item 2).
6. The legend keeps the warning ring (a config's rules can produce warnings).
7. **Reuse for `dta graph --format html`: later, separate ticket** (spec decision 8). The CLI's HTML graph stays as it is; the components are ready for it (`graph-layout.ts` is pure, the canvas renders statically).

**Decisions taken while building (closest to the board):**
- **Labels above the segments.** The board puts "BRAND"/"BREAKPOINT" left of their wells; beside the open detail panel (view 752 px at 1280) that row wrapped and the graph jumped down when a token was selected. Stacked, the row keeps one line in both states, so the graph stays in place (e2e checks its box).
- **Order from the files:** modes as the model has them (`Desktop, Mobile, Tablet`, as the Structure view), groups in the order the next layer uses them, read in file order (BrandA's `Typography.Body` comes before its effects, so `Typography.FontFamily` precedes `Effects.*`; the board had them the other way).
- **Fixed drawing, scrolls in its box:** three 208 px columns, 46 px apart (716 px) fit beside the panel at 1280; narrower views (760–1279 with the panel) scroll the canvas inside its own box. Up to 760 px (the site's break) the list replaces it; the switcher turns into selects at the same break.
- **Accessible name of a row:** the full token name and what the row shows (`Colors.Brand.Accent #3b8fd9, uses Colors.Foundation.Sky.500`) as `aria-label`; a visually hidden group prefix made Chrome insert a space into the name. The missing row is `role="img"` with its name, not focusable (arrow keys skip it).
- **Hover at once, state changes on the tokens.** A hover that changes a property a state also transitions could be reversed mid-way, which the browser shortens to a fraction of the token: the cause of the motion flake noted in 122 (seen as `dta-tabs__tab` colour 36.9 ms + 83.1 ms). Hover is now instant in GraphCanvas, GraphList, GraphSwitcher, Tabs and Findings; the selection still tints over `fast`. Before: about 1 in 8 runs of "playground transitions at 1280" failed; after: 12 of 12 green (with the graph cases). New do/don't row on the Motion page.
- **A brand switch on a phone is input, not a shift.** BrandB's layer is 17 px taller (Accent's "does not exist" line), so the layer below moves. The motion test changed the select with Playwright's `selectOption`, which is no user input, and under load the change sometimes landed outside Chrome's 500 ms input window (layout shift 0.0039, 2 of 45 loaded runs). The test now changes it by keyboard, as a visitor does: 0 of 45.
- **Hover never hides a selection:** a selected or chain row keeps its tint under the pointer (the hover rule only applies to plain rows).
- **Package fix, not a copy:** `codeNames`/`isBuilt` moved from `@dta/cli` into `@dta/build` (`code-names.ts`, a `BuildSelection` of brands and collections; the CLI wraps it with its config, output unchanged), and `@dta/build` declares `"sideEffects": false` (nothing in it registers anything), so the graph chunk gets the names in 5 KB without Style Dictionary. `analyzeGraph` runs once in `analyse()` (main chunk, lint uses it anyway); the graph chunk does not carry it.
- **Panel meta** says "Every brand, as `dta token get` reads it; the graph shows BrandA · Desktop." (not "the chain is highlighted there": the phone list highlights only the row).
- **Not done:** "Show in graph" for a file finding (default mode name); the layer header shows it and its chip leads to the Lint view.

**Components added (design system first):** `GraphSwitcher`, `GraphCanvas`, `GraphList` (Preact + CSS, docs pages under Design system → Components, sidebar 23–25; the later playground pages renumbered 26–32), `graph-layout.ts` (pure geometry: `layoutGraph`, `orderGroups`, `chainOf`, `moveFocus`). `DetailPanel` gained a line's `tag` and `severity`, `facts`, `notes` and `links`. Stories: `graph-switcher--problems`, `graph-canvas--problems`, `graph-canvas--dangling`, `graph-list--problems` (1280 and 390 each), `detail-panel--token` (1280), `detail-panel--token-sheet` (390); `detail-panel--sheet` shows "Show in graph". Docs: Detail panel, overview (component list, severity markers, side panel, new pattern "A graph you can read on any screen"), Status colours, Motion; user docs: Start, Lint rules reference, the playground page's intro; spec decision 16.

**Files:** `packages/build/src/code-names{,.test}.ts`, `packages/build/{package.json,src/index.ts}`, `packages/cli/src/code-names.ts`; `site/src/components/ds/{GraphCanvas,GraphList,GraphSwitcher}.{tsx,css}`, `graph-layout{,.test}.ts`, `DetailPanel.{tsx,css}`, `Tabs.css`, `Findings.css`; `site/src/playground/{graph,graph-engine,token-panel}` (+ tests), `Playground.tsx`, `analyse.ts` (`parseTokenId`, `graph`), `src/styles/playground.css`; examples and `stories.ts`; the docs pages above.

**Tests:** `graph.test.ts` (columns and modes, engine nodes/edges/cycles/orphans, findings per row and layer, the missing row next to `Sky.500`, switcher counts, the note, token details like `dta token get` incl. names and "Not in the build output", ids, the clean example, layout order and arrows), `graph-layout.test.ts` (ordering, placement, arrow geometry both directions, arcs and chip, chains, keyboard moves), `token-panel.test.ts`, `graph-engine.test.ts`, `packages/build/src/code-names.test.ts`, `browser-packages.test.ts` (the name helpers bundle without Style Dictionary, < 12 KB). `playground.e2e.test.ts`: select → chain, readings, names, finding, hash; "Show BrandB"; "Show in lint" and "Show in graph" back (also for the circular finding); focus returns to the row; a shared `#graph/<id>` link; the graph stays in place when the panel opens; arrow keys, Home/End, Enter, the brand segments by keyboard; at 390 the list with selects, the modal sheet, both links, the layer opening for a selection; layout shift 0 and no overflow at 390/1280 in both themes (graph, token open, BrandB); only lazy chunks, no outputs engine. `contrast.e2e.test.ts`: states "graph, a token selected" and "graph, BrandB with the dangling alias selected" (1280/390, Light/Graphite) and a 3:1 audit of the graph's markers, row outlines and arrows. Lowest measured: circular arc and error outline 4.99:1 Light / 6.40:1 Graphite, error marker on its row 4.65 / 5.38, alias arrow 7.14 / 7.73, chain 7.53 / 9.29 (the board's table). `motion.e2e.test.ts`: the graph at 1280/390 with and without reduced motion (highlight on the first frame under reduce, no View Transition; with motion the brand switch crossfades and every duration is a token; shift 0).

**Bundle sizes:** first load of /playground 8 files, 217 KB minified, **59.0 KB gzip** (budget 60 KB holds; was 56.4 KB; `@dta/core`'s graph module is now a 1.4 KB shared chunk). Lazy `graph-engine`: 21.5 KB minified, **7.3 KB gzip** (+ its CSS); lazy `outputs-engine` 2.15 MB / 599 KB gzip, unchanged. `@dta/build` code-name helpers alone: about 5 KB minified.

**Gates** (Node 24.14.1): prettier, typecheck, boundaries pass; `TERM=xterm-256color CI=true pnpm test` 1139 passed (139 skipped); `snapshot:check` 41 passed, none changed; `pnpm site:build` 135 pages, links valid; `test:contrast` (Chromium) 143 passed. Nothing committed or pushed.

**Screenshots** (session scratchpad, not committed): `078-graph-1280-{light,dark}.png`, `078-selected-1280-{light,dark}.png` (Colors.Brand.Accent selected, side panel), `078-phone-list-390-{light,dark}.png` (BrandB, list), `078-phone-sheet-390-{light,dark}.png`; stories `shots/078-story-*.png`.
