# TICKET-111: `dta diff` attribution for the Orbit Burger example (scoped selectors)

**Phase:** 10 — Landing redesign
**Priority:** Medium
**Effort:** M
**Blocked by:** 108
**Status:** in review (GitHub run pending)
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decision 2: "the numbers on the page come from a real `dta diff` run")

## Problem

The Orbit Burger example (105) is one brand with one mode, built by the site into one stylesheet scoped per state (`[data-example="orbit-burger"][data-state="main" | "change"]`, `site/scripts/build-example.ts`), because the page shows both states at once. `dta diff` run in `site/examples/orbit-burger` against a base where `tokens/` equals `tokens-base/` (recorded 2026-10-18 in the 108 outcome) renders the site's stories at both states and finds the changed pixels, but attribution explains none of them: its revert rules come from `dta build`'s own selectors (`:root` for a single-mode collection), and a `:root { --colors-brand-primary: … !important }` never reaches an element that declares the variable itself under the scoped selector.

So scene 02's "explains N % of the differences" lines stay illustrative and labelled (`DIFF_SHARES.real = false`, the honesty test checks the label).

## What to build

One of:

1. **Attribution through the page's own declarations.** `planReverts` derives the revert rule from where the variable is actually declared in the rendered page (every rule that declares `--colors-brand-primary`, from the page's stylesheets), not only from the build's selectors. Then any project whose build output is re-scoped still gets explained.
2. **A `diff.attribution.selectors` config**, mapping a collection · mode to the selector(s) the project declares it under, so the site can say `Brand · OrbitBurger → [data-example="orbit-burger"][data-state="change"]`.

**Decided (maintainer, 2026-10-20): option 1**, attribution through the page's own declarations: re-scoped CSS (themes per wrapper or component) is common, and it needs no config. Option 2 is not built.

Then record the run (`dta diff --base <sha>` in `site/examples/orbit-burger`, with a throwaway commit holding the main state), replace `DIFF_SHARES` with the real shares and set `real: true`; the illustrative note disappears from the page.

**Before pushing (maintainer, 2026-10-20, after the first screenshots):**

1. **Gravity-well noise:** `gravity-well--default@390` differs by 45 px with no token change behind it, so the recorded verdict is "Unexplained changes" and the count "of 7". Make the well render deterministically in `dta diff` runs (fix the cause, e.g. animation/randomness/timing, not a threshold), then re-record: "of 6", verdict "changes to review".
2. **Checks strip from the same run:** scene 03's `changes to review · 2 stories` contradicts "of 7 changed stories"; the strip's count comes from `diff-run.json` too.
3. **Overlapping token labels in the report:** when two tokens explain the same element, their redline labels overlap ("Radius.Card .Primary"); they must stack or sit side by side, readable at 1280 and 390, both themes.

## Acceptance criteria

- [x] Attribution explains the Orbit Burger stories' changes by `Radius.Card` and `Colors.Brand.Primary`
- [x] `DIFF_SHARES` on the landing page comes from a recorded run, `real: true`, no illustrative note
- [x] Before-pushing items 1–3 done; run re-recorded
- [ ] All gates pass plus the site job, and the GitHub run is green

## Outcome

**Decision (option 1, built):** a token is put back under the selectors `dta build` writes (unchanged) **and** under every rule in the rendered page's own stylesheets that declares its custom property: same selector, inside the same `@media` / `@layer` / `@supports` / `@container` / `@scope` / CSS nesting, `!important`, base value (or `initial` for an added token). Rules the build selector already covers are not repeated. With several brands (the variable declared by more than one collection · mode in the head build), a rule at another brand's build selector is never touched, and a re-scoped rule counts only when its value is this brand's head value as the build writes it and no other brand's; with one collection · mode (Orbit Burger) every declaring rule counts. Not reverted (stay unexplained): inline `style` declarations, cross-origin sheets (skipped), anonymous `@layer` blocks are put back unlayered. No config; `diff.attribution.selectors` (option 2) not built.

**Design.** `@dta/visual-diff`: `planReverts(set, base, head)` now returns a `RevertPlan` — `causes`, `variables` (what to look for), `groups` (build selectors only, as before) and `groupsFor(page)` (scoped to a page's declarations); new `PAGE_DECLARATIONS_SCRIPT` (in the browser: `document.styleSheets`, adopted sheets, `@import` with layer/supports/media, sheet media, nesting incl. nested declarations) returning `PageDeclaration[]`. The matching lives in TypeScript (`groupsFor`), the script only reads the CSSOM. `@dta/cli`: the screenshotter's `evaluate` became `inspect(url, width, ready, use)`, so one page load runs both scripts (declarations, then `DEPENDENTS_SCRIPT` with `plan.groupsFor(page)`).

**Recorded run** (2026-10-20, `dta diff --base 2ee9b31` in `site/examples/orbit-burger`; 2ee9b31 is a dangling throwaway commit = the working tree with `tokens/` = `tokens-base/`, on no branch, so base and head differ only in the tokens): 2 tokens changed; 6 changed · 106 unchanged; 6 explained; verdict **changes to review**. Same numbers in three full runs (base e9a0779 before `diff-run.json` was re-recorded, 2ee9b31 twice after).

| story                    | changed px (1280 / 390) | explained by                      |
| ------------------------ | ----------------------- | --------------------------------- |
| `scene--default`         | 19 636 / 18 008         | Colors.Brand.Primary, Radius.Card |
| `example-button--states` | 19 641 / 18 144         | Colors.Brand.Primary, Radius.Card |
| `token-rows--default`    | 340 / 332               | Colors.Brand.Primary              |

`Colors.Brand.Primary explains 6 of 6 changed stories`, `Radius.Card explains 4 of 6` (CLI wording). Both tokens' dependent is the same `span.button`, so both cover all of its changed pixels: the old illustrative split (94 % / 6 %) does not exist in the data, and the page shows the story counts. (First recording, before the well fix: 7 changed, `gravity-well--default@390` 45 px unexplained, verdict fail.)

**Gravity-well noise (before pushing, 1).** Cause: the well's objects are composited 3D layers painted at their default position on first paint, then moved by the script (`layout()` sets `--dy*`, `--s*`, `--r*`, `--tilt` and the stage's translate); Chromium then rasterised them at a scale that depended on timing, so two cubes' edges differed between page loads (same layout values, different pixels; reproduced on the head page alone: 1 of 4 loads differed). Fix at the source in `GravityWell.astro`: the stage stays `visibility: hidden` until `layout()` has run (`data-placed`), so the objects are first painted where they belong (also no jump on load). Verified: 12 of 12 loads identical at 390 and at 1280, and three full `dta diff` runs without the well. Documented on the gravity-well design-system page. No threshold, no exclusion.

**Checks strips (2).** The `dta diff` check in `CHECKS` (scene 02's strip and scene 03's `DECISION`) takes its status from the run's verdict (`review` → "changes to review", `pass` → passed, `fail` → failed) and its detail from the count: "changes to review · 6 stories". `DECISION` is the diff check by name. Lint and build stay as `dta lint` / `dta build` report them in the example (0 violations; build complete; checked). `diff-run.json` now records `verdict`.

**Report labels (3).** `renderReportHtml` gives tokens that explain the same box one mark whose labels (`.tags`) stack in a column above the box, so they cannot overlap; labels keep the redline contrast exception. Readable at 1280 and 390, light and Graphite (screenshots).

**Landing.** `site/src/landing/diff-run.json` (committed summary of the run's `result.json`, written by `site/scripts/record-diff-run.ts`, `pnpm --filter dta-site diff:record [result.json]`); `content.ts` words `DIFF_SHARES` and the diff check from it (`real: true`, `note` and `.shares .note` gone). `landing.test.ts`: real and no note; the recorded before/after match `tokens-base/` and `tokens/`; every share equals the wording from the file and every story it names is explained by that token; the diff check equals the run's verdict and count, all changes explained; the change labels match the file. Scene 03 copy unchanged (still true).

**Tests.** `attribution.test.ts`: re-scoped selector, nested at-rules and nesting, several declarations (deduplicated), other variables ignored, added token, multi-brand (value match, other brand's selector, shared value left alone), `groups == groupsFor([])`; `PAGE_DECLARATIONS_SCRIPT` on a duck-typed CSSOM (nesting, `@media`/`@layer`/`@supports`, anonymous layer, keyframes skipped, `@import` with layer/media, sheet media, cross-origin throw, disabled, adopted sheets). `diff-visual.test.ts` (e2e): new `scoped` story whose build writes `@layer example { @media … { .preview { --brand } } }` and nested `.preview { .theme-a / .theme-b { --accent } }`: explained by `Brand` and `accent (Theme · A)` with only `div#scoped-a` (fails with the old behaviour, checked). `report/html.test.ts`: two tokens on one box share one mark with stacked labels, a third box gets its own. `contrast.e2e.test.ts` report case (review): two tokens on the same box, audited in both themes at 1280 and 390, and no two labels' boxes intersect. No CLI snapshot changed.

**Docs.** Guide _dta diff with Storybook_ › How changes are explained (re-scoped CSS, multi-brand rule, what stays unexplained); _dta diff in pull requests_ links it; `docs/specs/visual-diff.md` §8 records the decision; `landing-redesign.md` honesty rule points to `diff-run.json`.

**Gates (Node 24.14.1, after the before-pushing fixes):** prettier, typecheck, boundaries, `pnpm test` (1152 passed, 139 skipped), snapshot check (41), `pnpm site:build`, `test:contrast` (143), diff e2e with `DTA_E2E=1` (2) — all green.

**Open.** GitHub run.
