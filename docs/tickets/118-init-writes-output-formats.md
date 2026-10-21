# TICKET-118: `dta init` writes `outputs.formats`

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Low
**Effort:** S
**Blocked by:** —
**Status:** done

## Problem

`dta init` asks which outputs a project wants, but writes keys that only move folders. Since TICKET-079 the build can choose formats (`outputs.formats`), so the wizard's answer can actually take effect.

## Acceptance criteria

- [x] `dta init` writes `outputs.formats` from the wizard's answer; snapshots of `init` re-recorded by name (there are no `init` snapshot scenarios: the wizard is covered by `init.test.ts`; nothing re-recorded, see Outcome)
- [x] Docs (Start, Configuration reference) show the key
- [x] All gates pass, and the GitHub run is green

## Outcome

- **Mapping** (`outputFormats` in `packages/cli/src/commands/init-config.ts`, exported for tests): wizard answer → `outputs.formats` entry: `css` → `'css'`, `tailwind4` → `'tailwind-v4'`, `tailwind3` → `'tailwind-v3'`, `js` → `'js'`; `ios`, `android-xml`, `android-compose` → none (`dta build` writes no Swift, XML or Compose yet). The list follows the order of `OUTPUT_FORMATS` from `@dta/build`, not the order of the answer, so the same choice always gives the same line. `generateConfigContent` writes `formats: [...]` as the first line of `outputs`, before the folder keys it already wrote (`css.outDir`, `tailwind.outDir`/`version`, `ios`, `android`), which stay as they were.
- **Decisions:**
  - **The wizard offers JS.** `OUTPUT_OPTIONS` had no JavaScript entry, so an answer could never give all four formats and `outputs.formats` would have dropped `colorpalette.js` for everyone who used the wizard. Added `js` ("JavaScript colour palette"); a test checks the options cover every `OUTPUT_FORMATS` entry.
  - **iOS and Android stay offered, marked.** They keep their folder keys (cleaned by `dta clean`) and now carry the hint "not built yet" in the prompt; they add nothing to `formats`.
  - **Only iOS/Android chosen → no `formats` key.** The schema requires at least one format; an empty list would be a config error, and leaving the key out builds all four (the old behaviour). Nothing chosen at all writes no `outputs` block, as before.
  - **`outputs.css.prefix` untouched.** `init` still writes `prefix: '--'` with the CSS block; that key belongs to TICKET-117.
- **Snapshots:** none re-recorded. `testkit`'s `SCENARIOS` has no `init` scenario (an interactive wizard; it is tested through `runCli` in `init.test.ts`), and no other scenario runs `init`. `snapshot:check` 41 passed, unchanged.
- **Tests:** `init-config.test.ts`: `outputFormats` (each answer alone, order of `OUTPUT_FORMATS` whatever the answer's order, iOS/Android left out, the wizard offers every build format); `generateConfigContent` checks `formats` for CSS, Tailwind v4, v3 and the CSS + v4 config, JS alone (`outputs: { formats: ['js'] }`, no folder block), and no `formats` for iOS alone. `init.test.ts`: the Enterprise run writes `formats: ['css', 'tailwind-v4']` and the real `loadConfig` reads it back; the run that chooses only CSS and then pulls and builds writes `base.css` but no `output/tailwind` or `output/js` (the answer takes effect in `dta build`).
- **Docs:** Configuration reference via the `.describe()` of `outputs.formats` in `packages/cli/src/config/schema.ts` (generated page now says `dta init` writes it from "Which formats should dta generate?"); Quick start step 1 shows the `outputs` block `dta init` writes for CSS + Tailwind v4 (copied from a real wizard run on the `brand-ab` tokens) and says iOS/Android write no files yet; Core concepts' example config carries `formats`; Outputs reference "Choosing outputs" names `dta init` next to the playground.
- **Files touched:** `packages/cli/src/commands/init-config.ts`, `init-config.test.ts`, `init.test.ts`, `packages/cli/src/config/schema.ts`, `site/src/content/docs/start/quick-start.mdx`, `start/concepts.mdx`, `reference/outputs.mdx`.
- **Gates** (Node 24.14.1): prettier, typecheck, boundaries pass; `TERM=xterm-256color CI=true pnpm test` 1183 passed (148 skipped); `snapshot:check` 41 passed, none changed or re-recorded; `pnpm site:build` 137 pages, links valid; `test:contrast` 151 passed. Diff e2e not run: nothing it renders changed. Nothing committed or pushed.
- **Left open:** TICKET-117 now records the decision to remove `outputs.css.prefix`, including "`dta init` stops writing it"; that line in `generateConfigContent` was left for 117 (done there, the Quick start excerpt updated with it).

**Closed 2026-10-21.** GitHub run 39637189200 (CI, 587a356) green.
