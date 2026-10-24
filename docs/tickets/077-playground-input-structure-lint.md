# TICKET-077: Playground: input, structure and lint findings

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** High
**Effort:** L (own route, shared layout, Preact setup and new design-system components)
**Blocked by:** 076
**Status:** done (2026-10-19), pending the GitHub run
**Spec:** [playground](../specs/playground.md) (decisions 2, 3, 4, 6, 7, 12, 13, 14)

## What to build

On the site's own `/playground` route (not a Starlight page, spec decision 12) a user drops or pastes token files or a plugin export (or loads the brand-ab example) and sees the detected structure (collections, modes, layer roles) and lint findings, with the same diagnostics the CLI gives. Nothing leaves the browser.

## Acceptance criteria

- [x] `/playground` is a standalone page on a shared `SiteLayout.astro` (also used by the landing page, which looks unchanged); the Starlight placeholder page and its sidebar group are removed; docs and landing page link to `/playground`; "Playground" in the site nav
- [x] Preact island loaded only on the playground page; `@astrojs/preact` set up; nothing of Preact on other pages
- [x] Input: a drop area that is also a button opening the file picker (keyboard, phones), accepting several files; a paste field; "Load example" (brand-ab)
- [x] Structure view: collections, modes, inferred layer role with confidence (`analyzeStructure`); lint findings list (`lintTokens`, default rules) with the CLI's wording
- [x] New UI as design-system components first (e.g. drop area, structure table, findings list), each with a docs page and stories incl. phone width
- [x] Multiple per-mode files or one plugin export (auto-detected); invalid input shows CLI-equivalent diagnostics
- [x] No network requests after load (asserted in a test)
- [ ] All gates pass plus the site job, and the GitHub run is green

## Notes

- APIs: `detectFormat` / `importPluginExport` (`@dta/figma`), `parseTokenFiles` / `analyzeStructure` (`@dta/core`), `lintTokens` (`@dta/lint`); browser proof and bundle budgets in `site/browser-packages.test.ts` (076).
- Lint runs with the default rules (a visitor has no config); toggling rules is a possible later addition.
- The optional "last session" in local storage (decision 4) is not part of 077.
- Checks like the landing page: AAA contrast test, no horizontal scroll at 390 px in both themes, layout shift 0.

## Outcome

- **Shared frame.** `site/src/layouts/SiteLayout.astro` holds the token CSS, both themes, the fonts (preloaded), the header (Logo, Nav, ThemeSwitch), the theme script and the footer; `src/styles/site.css` holds the frame's CSS that used to open `landing.css` (font fallbacks, surface, gutter, skip link, header, footer, reduced motion; `--landing-sans/-mono` renamed `--site-sans/-mono`). `index.astro` and `landing.css` keep only the landing page. Checked by screenshots before and after at 1280 and 390 px in both themes: pixel-identical except the new "Playground" link in the nav and the footer.
- **Route.** `site/src/pages/playground.astro` on SiteLayout, outside Starlight. The placeholder `content/docs/playground/index.mdx` is gone; the sidebar's Playground group is now a link to `/playground/`. Linked from the site nav (all pages on SiteLayout), the footer, the Start page and the Token files reference. The links validator cannot check custom pages, so `/playground/` is excluded there through `site/custom-pages.mjs`, and `custom-pages.test.ts` checks each listed page exists in `src/pages`.
- **Preact.** `@astrojs/preact` 6.0.5 (the release that matches Astro 7.3.5's `@astrojs/internal-helpers` 0.11) and `preact` 10.29.8; `tsconfig` sets `jsxImportSource: preact`. The lockfile also moved two transitive packages (postcss 8.5.8 → 8.5.30, sourcemap-codec 1.5.5 → 1.6.0) while resolving. The island (`src/playground/Playground.tsx`, `client:load`) is the only one on the site: `playground.e2e.test.ts` checks that only `playground/index.html` has an `astro-island` and that no other page references its component or renderer chunk. Stories render the Preact components to static HTML (no JS).
- **Input → analysis** in `src/playground/analyse.ts` (pure, tested in Node and in Chromium): one file that is not per-mode DTCG is a plugin export, read like `dta pull --from-file` (`detectFormat`, `importPluginExport`); everything else is read like the tokens directory of `dta lint` (`parseTokenFiles`). Input errors stop there; otherwise `analyzeStructure` and `lintTokens` with the default rules. The brand-ab example (six files) is bundled with `import.meta.glob(..., { query: '?raw', eager: true })`, so loading it is no request.
- **CLI wording, shared not copied.** `formatDiagnostic` and `hasErrors` moved from `@dta/cli` (`io/diagnostics.ts`, deleted) to `@dta/core`; `@dta/lint` exports `LINT_MESSAGES`, `groupViolationsByFile`, `lintCounts` and `formatLintSummary` (`report.ts`), which `dta lint` now uses; `@dta/core` exports `LOW_CONFIDENCE` (0.75, the threshold `dta analyze` marks with ⚠). The playground prints `error [code] message (file)` and `warn message [rule]` exactly as the CLI does (tests compare against `formatDiagnostic` and the lint snapshot wording). All 34 CLI snapshots unchanged.
- **Design-system components** (Preact `.tsx` + a `.css` each, in `src/components/ds`), each with a docs page and stories at 1280 and 390 px: `TokenInput` (drop area that is the file picker's button, several files; "Load example"; paste field with a file name for a single per-mode file), `StructureTable` (collections, modes, role, confidence with "⚠ review" below the threshold, variables, aliases, notes; a labelled list below 640 px of container width) and `Findings` (diagnostics or lint lines grouped by file, summary and verdict). `Button`'s styles moved to a shared `Button.css` so the island's buttons are the same Button. `components.test.ts`, `stories.test.ts` and `TokensUsed` now cover `.tsx` components and their stylesheets.
- **Tests.** `analyse.test.ts` (brand-ab structure and clean lint, a tokenHaus export with its `no-default-mode-names` error, invalid and misnamed files, an unknown single file); `playground.e2e.test.ts` on the built site in Chromium: load example → structure and lint; the drop area opens a multi-file chooser → three files read; a pasted plugin export → "Converted tokenhaus export into 1 token file" and `1 error found. Lint failed.`; invalid JSON → the CLI's `invalid-json` line and no structure; **no request after load** across all of it, no page errors; at 390 and 1280 px in both themes **layout shift 0** on load and nothing wider than the screen (empty, after the example, after invalid input); the JS budget. `contrast.e2e.test.ts` audits the playground (empty, example, invalid input; Light and Graphite; 1280 and 390) at AAA, and the seven new stories with every other story. `playground.e2e.test.ts` joined the site job's `test:contrast` script.
- **JS of the playground page:** 6 files, 160 KB minified, **45.5 KB gzip** (the island chunk with `@dta/core`, `@dta/figma`, `@dta/lint` and the example: 141 KB / 37 KB gzip; Preact, its hooks and signals, Astro's island client and the page script). Budget in the test: 60 KB gzip. No Style Dictionary in the first load. The 076 budgets still pass.
- **Decisions taken (spec left them open):**
  - Severity has no colour: the design system has no error token and `signal` is never for errors, so errors are a filled square and warnings an open ring, always with the word. No new token added.
  - A pasted per-mode file needs a `{Collection}.{Mode}.json` name, so the paste field has a "File name" input (default `Pasted.Value.json`); a pasted plugin export ignores it.
  - Input diagnostics carry no CLI summary line of their own; the playground says "The input could not be read; nothing else runs until it can." above the CLI lines.
  - The landing page links to `/playground` through the nav and the footer only, so its sections stay as the landing spec has them.
  - `client:load` (not `client:visible`): the input is above the fold.
- **Gates:** prettier, typecheck, boundaries, `pnpm test` (881 passed, browser halves skipped), snapshot check (34, unchanged), `pnpm site:build` (links valid) and `test:contrast` with Chromium (32 passed). Node 24.14.1. GitHub run: pending, nothing pushed.
- **Left open:** the nav does not mark the current page (`aria-current`), on any page; a possible Nav change. Toggling lint rules and the optional "last session" stay out of scope as noted above.
