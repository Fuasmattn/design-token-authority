# TICKET-091: Breakpoint modes in the build output

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Medium
**Effort:** M
**Blocked by:** —
**Status:** done

## What to build

Collections whose modes are not brands (the dimension layer, e.g. `ScreenType` with `Desktop`, `Tablet`, `Mobile`) become CSS that switches by breakpoint. Today `dta build` reads them only to resolve aliases (documented on the Outputs and Core concepts pages, 072).

## Acceptance criteria

- [x] Config names the breakpoint collection and maps each mode to a media query (or a selector), e.g. `breakpoints: { collection: 'ScreenType', modes: { Desktop: '(min-width: 1024px)', … } }`
- [x] `dta build` writes the tokens of each mode inside its media query (default mode on `:root`), as `var()` references where they alias
- [x] Tailwind v4 output covers them; snapshot of `build` on `brand-ab` re-recorded and reviewed
- [x] `outputs.css.prefix` and `outputs.tailwind.version` either take effect or are removed from the schema with a clear message (accepted but unused today)
- [x] Docs pages updated; all gates pass
- [x] The GitHub run is green

## Outcome

- **Config: the shape the ticket proposes, top level, plus `default`.** `breakpoints: { collection, default, modes }` next to `brands` (both say which modes of a multi-mode collection the build writes, and how; `outputs.*` only chooses files and folders, and the section also affects `dta diff`, `dta token`, `dta context` and `dta audit`, not only CSS). `default` is required: the ticket's shape has no way to say which mode goes on `:root`, and guessing it (first key, alphabetical, "the one without a query") would decide mobile- versus desktop-first for the user. `modes` holds every other mode and its query without `@media`, in cascade order (later wins). Rejected with a config error (exit 2, path named): the default mode in `modes`, a query starting with `@media`, a selector (`[`, `.`, `#`, `:`, `&`), an empty `modes`. Mismatches with the tokens are build warnings, and no breakpoint CSS is written: unknown or single-mode collection (`unknown-breakpoint-collection`), unknown default (`unknown-breakpoint-mode`); an unknown mode in `modes` is skipped, a mode without a query is left out (`breakpoint-mode-without-query`).

  ```ts
  breakpoints: {
    collection: 'ScreenType',
    default: 'Mobile',
    modes: { Tablet: '(min-width: 768px)', Desktop: '(min-width: 1024px)' },
  },
  ```

- **CSS** (`variables.css`, after the primitives' `:root` block): one block per mode, each after a comment naming it, `/* ScreenType · Mobile (default) */ :root {…}`, then `@media (min-width: 768px) { :root {…} }` and so on, in config order, aliases as `var()` references. Built by Style Dictionary's own `css/variables` with a nested selector (`['@media …', ':root']`), so values, names and reference ordering follow the same transforms. Nothing is sorted: mobile- or desktop-first comes from the user's queries (test with `max-width`, `default: 'Desktop'`).
- **Brands** (on top of 093): a breakpoint token whose alias chain reaches a brand token in _any_ mode is repeated in every `themes/<brand>.css`, once per breakpoint mode, inside the same media queries (`@media (min-width: 1024px) { [data-brand="brandb"] {…} }`), after the brand's own rule. Every mode, not only the ones that alias the brand: a theme rule holding only the Desktop value would override the root's Mobile value at every width. Breakpoint tokens that reach primitives only stay out of the themes. A breakpoint mode named in `brands` is not built as a theme (`unknown-brand`).
- **Tailwind v4:** `tailwind.css` ends with `/* ScreenType: theme variables that switch with the media queries of variables.css */ @theme inline { --spacing-spacing-gap: var(--spacing-gap); … }` (formatter option `inline`: every mapped token as `var()`, tokens without a utility namespace left out). Compiled with Tailwind 4.3.3 against the fixture build: `p-spacing-gap` → `padding: var(--spacing-gap)`, `rounded-radius-card` → `border-radius: var(--radius-card)`. A single-mode token that aliases a breakpoint token moves from `@theme` (where its value would be resolved, one size at every width) to the inline block.
- **Resolved outputs** (documented on Outputs): `base.css`, the JS palette and Tailwind v3 have no media queries; breakpoint tokens are not in them (unchanged), and a single-mode token aliasing one resolves through `default` instead of the first mode alphabetically (the only change to them, and only with `breakpoints`). The `<brand>/tailwind.*` files are unchanged.
- **Other commands follow the config:** `isBuilt`/`codeNames` (`@dta/build`, `BuildSelection.breakpoints`) count the breakpoint collection as built, so `dta token get/find`, `dta audit` and `dta context` give its CSS and Tailwind names. `dta diff`: `parseCssVariables` reads nested rules with their at-rules (`context`), `cssBindings` binds the default mode to `:root` and the others to `:root` in `@media …`, and `planReverts` (`@dta/visual-diff`) writes the revert inside the same at-rule and tells the build's own rules (including a page that wraps them in `@layer`) from other modes' rules.
- **`outputs.tailwind.version`: removed** (nothing read it: grep over `packages`, `site`, `scripts`, `actions`; 079 made `outputs.formats` the choice). Same pattern as 117: `z.never({ error })`, optional, so the specific message is the only issue on the key's own path. Error, as printed (exit code 2):

  ```text
  Invalid configuration in <cwd>/dta.config.ts:
    outputs.tailwind.version: was removed: it never had an effect. `outputs.formats` chooses the Tailwind versions ('tailwind-v4', 'tailwind-v3'). Delete this line.
  ```

  The default `4` is gone, so a loaded config no longer has the key. `dta init` writes `tailwind: { outDir: 'build/tailwind' }` (the answer still sets `formats`). The playground's `generateConfig` never wrote it (test added: no `version`, `prefix` or `breakpoints`). Both fixture configs dropped `version: 4`. CHANGELOG "Breaking changes" line, migration guide bullet; Quick start excerpts updated. `outputs.css.prefix` was already removed (117).

- **Snapshots re-recorded by name** (reviewed): `brand-ab/build` (`variables.css` +3 blocks, `tailwind.css` + inline block; `base.css`, themes, JS, v3 and brand files byte-identical; stdout unchanged), `brand-ab/context` (ScreenType "yes", five rows with per-mode values), `brand-ab/token-find-json` (`code` names on the ScreenType matches), `brand-ab/audit`, `brand-ab/audit-json`, `brand-ab/audit-baseline` (`16px` now suggests `Spacing.Gap` instead of `Dimensions.spacing.4`: see Decisions). The fixture's config gained `breakpoints` (mobile-first, 768/1024 px); `test/fixtures/README.md` says so.
- **Tests:** `build.test.ts` "breakpoint modes (TICKET-091)": exact blocks and order; desktop-first order; per-breakpoint theme blocks for a brand-aliasing token and none for a primitive one; Tailwind v4 inline block incl. the moved component token; `base.css`/v3 through the default; `formats` without `css`; a breakpoint mode in `brands`; four warning cases. Snapshot comparisons use `fixtureOptions()` (`test-helpers.ts`), the fixture's config as build options. `bindings.test.ts`: nested `@media` parsing, breakpoint bindings. `attribution.test.ts`: revert inside the media query; page copies of build rules (also inside `@layer`). `config.test.ts`, `cli.test.ts`, `init*.test.ts`: removal message, valid and invalid `breakpoints`. Site: `outputs.test.ts` and `playground.e2e.test.ts` compare with the snapshot minus the ScreenType blocks (the playground cannot know the queries); `browser-packages.test.ts` passes the fixture's breakpoints like the CLI. New `site/breakpoints.e2e.test.ts` (in `test:contrast`): the Learn `multi-brand` example plus a `Screen` collection, built with `bin/dta.js`, in Chromium at 390, 800 and 1280 px and resized 390 → 1024 → 1023 on one page: tokens follow the viewport; a nested `data-brand="brandb"` gets BrandB's green accent at desktop width while the root keeps BrandA's blue. Fails without the theme blocks (checked by disabling them).
- **Docs:** Outputs reference (new "Breakpoint modes": config, CSS from the fixture build, ordering, media-only, themes, Tailwind v4, resolved files; "Not built yet" updated), Core concepts (build list, the note, config example), Brands and themes ("Breakpoint tokens and brands", theme file from a real run), Tailwind guide (bullet), Quick start (fixture config, `dta init` excerpt), Migrating from v1 (removed key, `breakpoints` vs `layers.dimension`). Configuration reference generated from the schema descriptions.
- **Playground:** unchanged. Its generated config has no `breakpoints` (no queries to offer), so its outputs are the same as before; first load 59,863 B gzip (budget 60,000), outputs chunk 599,829 B gzip. No visible UI change, so no screenshots. Site tokens have no breakpoint collection: `pnpm report:tokens` rewrote `tokens-css.ts` unchanged, no diff re-record needed.
- **Decisions (confirmed by the maintainer, 2026-10-21: the first three as below; the fourth goes to TICKET-125):**
  - Top-level `breakpoints` (not `outputs.css.breakpoints`) and the extra required `default` key (above).
  - Media queries only; a mode mapped to a selector is rejected. The ticket says "(or a selector)" as an option; a selector would need a different revert/binding model in `dta diff` and a different theme nesting, and can be added later without breaking this shape (e.g. a value object).
  - No auto-detection: without `breakpoints`, nothing changes (the structure analysis's `dimension` role is not used). `dta init` does not ask for queries.
  - `dta audit`/`dta token find` now prefer a breakpoint token (`Spacing.Gap`) over a primitive (`Dimensions.spacing.4`) for `16px`, because the ranking prefers built tokens with deeper alias chains and the breakpoint token's Desktop value matches. Arguably right for semantic use, but `Spacing.Gap` is 16px only from 1024 px. Left as the existing ranking decides; follow-up: [TICKET-125](./125-audit-rank-breakpoint-values.md).
- **Files touched:** `packages/build/src/build.ts`, `formatters/tailwind-v4.ts`, `bindings.ts`, `code-names.ts`, `index.ts`, `test-helpers.ts`, `build.test.ts`, `bindings.test.ts`, `tailwind-v3.test.ts`, `tailwind-v4.test.ts`; `packages/cli/src/config/schema.ts`, `commands/build.ts`, `commands/diff.ts`, `code-names.ts`, `commands/init-config.ts`, `config.test.ts`, `cli.test.ts`, `commands/init-config.test.ts`, `commands/init.test.ts`; `packages/visual-diff/src/attribution.ts`, `attribution.test.ts`; `test/fixtures/brand-ab/dta.config.ts`, `daisyui/dta.config.ts`, `README.md`; six snapshot scenarios above; `site/breakpoints.e2e.test.ts`, `site/package.json`, `browser-packages.test.ts`, `browser-packages/engine.ts`, `playground.e2e.test.ts`, `src/playground/outputs.test.ts`, six docs pages; `CHANGELOG.md`.
- **Gates** (Node 24.14.1): prettier, typecheck, boundaries pass; `TERM=xterm-256color CI=true pnpm test` 1210 passed (154 skipped); `snapshot:check` 41 passed; `pnpm site:build` 137 pages, links valid; `test:contrast` 157 passed (7 files, incl. the new one); diff e2e (`DTA_E2E=1`) 3 passed. Nothing committed or pushed.

**Closed 2026-10-21.** GitHub run 39688510420 (CI, ee0a71e) green.
