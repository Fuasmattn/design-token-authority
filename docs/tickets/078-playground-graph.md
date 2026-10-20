# TICKET-078: Playground: dependency graph with brand and breakpoint switcher

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** Medium
**Effort:** M
**Blocked by:** 077, 115, 113, 120
**Status:** in progress (design board first)
**Spec:** [playground](../specs/playground.md) (decisions 3, 5, 8, 15)

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

- [ ] Design board approved by the maintainer (recorded here with the date)
- [ ] Graph from `@dta/core` analysis with brand and breakpoint switcher; keyboard-navigable; list fallback at 390 px
- [ ] Findings in the status colours, shape + word; dangling and circular aliases shown as errors
- [ ] Selecting a token opens its alias chain in the `DetailPanel`; "Show in graph" and "Show in lint" work both ways, state in the URL hash
- [ ] Design-system components, docs pages and stories (1280 and 390) for everything new; playground and design-system docs updated
- [ ] AAA text contrast, 3:1 markers in both themes (`test:contrast`), layout shift 0, reduced motion
- [ ] Decision on reusing it for `dta graph --format html` recorded: later, separate ticket (spec decision 8)
- [ ] Playground JS budget (60 KB gzip for the page) holds, or the graph loads lazily like the outputs
- [ ] Screenshots 1280 and 390, light and dark, shown before pushing
- [ ] All gates pass plus the site job, and the GitHub run is green

## Outcome

_(open)_
