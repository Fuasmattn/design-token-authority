# TICKET-124: Playground first load: load the analysis engine lazily, tighten the budget

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** open

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

- [ ] First load contains no `@dta/core`, `@dta/figma`, `@dta/lint` or zod (checked on the built chunks, like 076's metafile check)
- [ ] The engine loads on idle and at once on input; input before it arrives is read once it is there; deep links (`#lint/…`, `#graph/…`) still work on load
- [ ] Summary shows a reading state while waiting; layout shift 0 at 390 and 1280 in both themes; no horizontal scroll
- [ ] Budgets split (first load + one per lazy chunk), numbers recorded; "no request after load" counts the new chunk
- [ ] Screenshots 1280 and 390, light and dark (empty state and the reading state), shown before pushing
- [ ] Playground spec (decision 9) and the playground docs page updated
- [ ] All gates pass plus the site job, and the GitHub run is green
