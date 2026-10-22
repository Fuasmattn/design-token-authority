# TICKET-122: Example content never uses the system colours

**Phase:** 8 — Token Engine Overhaul, Epic 7b / 8 (examples across site, playground and `dta diff`)
**Priority:** Medium
**Effort:** L
**Blocked by:** 121
**Status:** done

## Why

Maintainer feedback on 121's report screenshots (2026-10-20): the example in the `dta diff` report changed `signal.bg` from `redline.500` to `redline.600`, so the example buttons were the same orange as the report's "changed" marks and the pixel-diff overlay. An example then reads as a UI state. **Rule (decision):** example content (sample tokens, stories' example UI, fixtures shown in the playground and docs) uses blue or neutral greys, never the system colours: signal orange (`redline-*`), error red (`crimson-*`), warning ochre (`ochre-*`), success green (`sage-*`) or hues close to them (any orange, red, yellow or green).

Scope decided by the maintainer (2026-10-20): **everything example-ish, including the `brand-ab` fixture.** Not in scope: the hero's orange well objects (key visual, TICKET-110) and the report's pixel-diff overlay (report UI that marks changes; it can only stay distinguishable once examples are no longer orange).

## What to build

Survey (2026-10-20) of what to change:

1. **`dta diff` report examples and tests:** `site/contrast.e2e.test.ts` review case (`signal.bg` `redline.500 → 600`), `packages/cli/test/diff-visual.test.ts` (green accent, purple, `Brand` blue → redline orange), `packages/visual-diff/src/token-changes.test.ts` (synthetic `Green`; the `brand-ab` pair follows 3), `attribution.test.ts` (`red.500` names). Example changes become blue → darker blue, or grey → grey.
2. **Site stories and examples:** Orbit Burger's Nova orange (`site/examples/orbit-burger/tokens{,-base}`, `ExampleButton`, `TokenRows`, landing scenes 01/03 and their copy in `site/src/landing/content.ts` "a slightly deeper brand orange"), the docs pages that quote it (`example-button.mdx`, `token-rows.mdx`), the `examples.test.ts` hex asserts. Orbit Burger's lint config checks text contrast at 7:1 on its dark surface: the new colours must still pass. Also decide the `Badge` `tone="example"` (signal today): an example label in neutral ink, or keep signal because it marks "this is example data" (record the decision).
3. **Token fixtures:** `test/fixtures/brand-ab` (`tokens`, `tokens-base`) and `brand-ab-problems`: replace Green/Orange/Red primitives and the aliases to them with blues and greys, including the names (no `Orange.550` in a dangling-alias example; the dangling one keeps being dangling). The headline diff example (BrandB Accent changes) stays a visible change, in blue/grey. Re-record every affected CLI snapshot by scenario name (`pnpm snapshot:record --scenario brand-ab/<scenario>`, `brand-ab-problems/<scenario>`; no record-all) and review the snapshot diff: only colour values and names may change. Figma recordings (`test/recordings/brand-ab/variables-local{,.drifted}.json`) follow the fixture so `pull` snapshots stay consistent. Docs pages that copy real output (`quick-start.mdx`, `coding-agents.mdx`, `token-queries.mdx`, `brands-and-themes.mdx`, `concepts.mdx`, `lint-rules.mdx`, `token-path.mdx`) get output from real runs again. Playground stories that read the fixture (`DetailPanelSide`, `TokenPathWrapping`) and the 078 board's sample names follow.
4. **Design system:** the rule goes into the design-system overview (principles or patterns) and the Status colours page ("examples never use system colours"), so it stays.

## Acceptance criteria

- [x] No example token, story example, fixture or docs sample uses an orange, red, yellow or green hue (a test scans the fixtures' and examples' colour values and fails on hues in those ranges, with the key visual tokens excluded by name)
- [x] Snapshot diffs only change colour values and names; every re-recorded scenario listed in the Outcome
- [x] Orbit Burger and landing copy updated; its own lint (7:1) passes
- [x] Badge `example` tone decided and recorded
- [x] Rule in the design-system docs
- [x] AAA contrast in both themes (`test:contrast`), layout shift 0
- [x] Screenshots 1280 and 390, light and dark (report review case, landing scenes 01 and 03, playground with the brand-ab example) shown before pushing
- [ ] All gates pass plus the site job (done locally, below), and the GitHub run is green

## Outcome

Done 2026-10-20 (on top of 121 item 4, uncommitted). Screenshots shown and the GitHub run are the maintainer's.

**Palette (decision: blues and neutral greys, the maintainer's "blue or some neutral gray tones").** Renamed so no name says a hue the rule forbids; the new names sort where the old ones did, so listings keep their order.

| Where                                            | Was                                      | Now                           | Used for                                                                |
| ------------------------------------------------ | ---------------------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| brand-ab (all three token sets, both recordings) | `Green.500` `#2e9e5b`                    | `Navy.500` `#3d5a80`          | BrandB `Primary` (white on it 7.06:1)                                   |
|                                                  | `Green.700` `#1f7a43`                    | `Navy.700` `#2c4466`          | BrandB `Primary Dark`; BrandB `Accent` in `tokens-base`                 |
|                                                  | `Orange.500` `#e8731a`                   | `Sky.500` `#3b8fd9`           | `Accent` (both brands)                                                  |
|                                                  | `Red.500` `#d1342f` (`tokens-base` only) | `Steel.500` `#7d8ea3`         | the removed token of `diff-tokens`                                      |
| brand-ab-problems                                | `{Colors.Foundation.Orange.550}`         | `{Colors.Foundation.Sky.550}` | still dangling (no `Sky.550` exists)                                    |
| Orbit Burger                                     | `Nova.400` `#ff9a4d`                     | `Nova.400` `#86bcff`          | changed values in Token rows (9.24:1 on Void.900, 7:1 needed)           |
|                                                  | `Nova.500` `#ff7a1a`                     | `Nova.500` `#5aa2ff`          | brand before (Void.900 label 6.98:1, as before)                         |
|                                                  | `Nova.600` `#e0600a`                     | `Nova.600` `#3d87e8`          | brand after (5.05:1, was 5.07; 500 vs 600 1.38:1, still "easy to miss") |
|                                                  | `Mint.300` `#9bebcb`                     | `Ice.300` `#b9d8f7`           | `Colors.Accent.Fresh`                                                   |

Blue (`Blue.500/700`), the greys and White are unchanged, so `dta audit` (`src/Button.css`, `Card.tsx`), `token find '#003f8a'` and every other value stay as they were. Structure, token counts, aliases, the circular alias, the dangling alias and the Figma IDs are unchanged. **Headline diff:** BrandB `Colors.Brand.Accent` `{Navy.700}` `#2c4466` → `{Sky.500}` `#3b8fd9` (dark navy to a light sky blue; plainly different in screenshots).

**Decisions**

- **Badge `example` is a neutral ink outline** (the proposal): `stroke-hairline` in `border-strong`, word in `fg-default`, no fill; its `data-contrast-exception` ("redline label") is gone, so the redline label is again the only exception besides the report's. Recorded on the Badge page.
- **Report example data:** the contrast suite's review case and the screenshot script use the brand-ab headline (`Colors.Brand.Accent (Brand(Alias) · BrandB)` navy → sky) instead of `signal.bg` `redline.500 → 600`. `diff-visual.test.ts`: `Brand` `#2f55d4 → #13213f` (was → `#e8632a`), the theme accents `green`/`purple` became `sky` `#4c8fd6` / `slate` `#5a6480`. `token-changes.test.ts` synthetic `Green` → `Sky` `#66aaff`; `attribution.test.ts` `red.500` → `slate.500`, CSS value `red` → `steelblue`; `analyse.test.ts` `{Orange}` → `{Sky}`.
- **Out of the scan, by decision:** the daisyUI fixture (a third-party export kept as published), the gravity well's orange objects (key visual, excluded by token name `well-object-orange*`), the report's pixel-diff overlay (report UI; stays redline orange), and the design-system pages (they document the system colours). Historical specs and prototypes (`docs/specs/landing-redesign/*`, the playground prototypes other than 078's board) and closed tickets keep the old names.
- **Orbit Burger's 7:1 lint:** passes (`examples.test.ts`). Note: `color-contrast` only compares raw hex tokens (v1 quirk), and Orbit Burger's pairs are aliases, so the rule reports nothing for them either way; the contrasts above were checked by hand and in the browser (`test:contrast` audits the landing page and the stories).

**Changed**

- Fixtures `test/fixtures/brand-ab/{tokens,tokens-base}`, `brand-ab-problems/tokens`, recordings `test/recordings/brand-ab/variables-local{,.drifted}.json` (names and r/g/b floats), `test/fixtures/README.md`.
- Orbit Burger `site/examples/orbit-burger/{tokens,tokens-base}` (values, `Mint` → `Ice`, "the brand blue"), `ExampleButton.astro` comment, landing copy (`content.ts`: "a slightly deeper brand blue", "the darker blue is easy to miss"), `example-button.mdx`, `examples.test.ts` hex asserts.
- Docs with real output, re-checked against runs on the fixtures (`dta diff --tokens-only --base tokens-base`, `dta token get Colors.Brand.Primary`, `dta context`, `dta lint` and `dta build` on brand-ab-problems): `quick-start.mdx`, `coding-agents.mdx`, `token-queries.mdx`, `brands-and-themes.mdx`, `concepts.mdx`, `lint-rules.mdx`, `token-path.mdx`; story `TokenPathWrapping.astro`. `DetailPanelSide` and the Outputs stories read the fixture and follow by themselves.
- Tests quoting fixture values: `build.test.ts`, `token.test.ts`, `render.test.ts`, `alias-problems.test.ts`, `resolve.test.ts`, `token-changes.test.ts`, `analyse.test.ts`, `playground.e2e.test.ts` (dangling line; the BrandA theme CSS is 743 B, was 746 B: `sky` is three bytes shorter than `orange`).
- 078 board `docs/specs/playground/prototypes/Graph.dc.html`: sample names and swatches.
- **Rule in the design system:** overview Patterns "Examples stay blue and grey"; Status colours: "Examples never use system colours" under what is not a status, a section "Examples stay blue and grey" (scope, exclusions, the test) and a do/don't row; Badge page.

**Snapshots re-recorded** (by name; 16): `brand-ab/build`, `brand-ab/graph-dot`, `brand-ab/graph-html`, `brand-ab/pull-api`, `brand-ab/diff-tokens`, `brand-ab/pull-from-file`, `brand-ab/token-get`, `brand-ab/token-get-json`, `brand-ab/token-list`, `brand-ab/context`, `brand-ab-problems/build`, `brand-ab-problems/lint`, `brand-ab-problems/graph-console`, `brand-ab-problems/graph-dot`, `brand-ab-problems/graph-markdown`, `brand-ab-problems/graph-html`. Reviewed with a script that maps old → new names and hex over the old files: 24 files identical after the mapping; `colorpalette.js` and the two pulled `Primitives.Value.json` differ only in names (`ColorsFoundationNavy500`, `"Navy": {`); `token-list` only in column padding (the longest name got shorter). Nothing else changed.

**Tests:** new `site/example-colours.test.ts`: reads every colour value (hex, `rgb()`, Figma `{r,g,b}`) of the brand-ab fixtures and their `src/`, the recordings, the Orbit Burger token sets, the story examples (`site/src/examples`), `ExampleButton`, `TokenRows`, landing `content.ts`, the docs pages outside the design system, and the report test data (`packages/visual-diff/src/**/*.test.ts`, `diff-visual.test.ts`, `contrast.e2e.test.ts`); fails on chroma ≥ 0.12 with a hue in red (330°–15°), orange (15–45°), yellow (45–70°) or green (70–170°). Each source must yield colours (no vacuous pass); a case pins that the old example colours and the system colours are flagged and the new blues and greys (incl. warm off-white `#f6f2ea`) pass; the key-visual exclusion matches only `well-object-orange*`.

**Gates** (Node 24.14.1): prettier, typecheck, boundaries pass; `TERM=xterm-256color CI=true pnpm test` 1094 passed (120 skipped); `snapshot:check` 41 passed after the re-record; `diff-visual.test.ts` with Chromium 2 passed; `pnpm site:build` 126 pages, links valid; `test:contrast` (Chromium) 123 passed (AAA both themes, layout shift 0); on a second full run the motion case "playground transitions at 1280 px, without layout shift" failed once and then passed three times alone (timing, nothing in it reads colours; watch it on CI). Site tokens unchanged, so no `report:tokens`. Nothing committed or pushed.

**Screenshots** (session scratchpad, not committed): `122-report-review-{1280,390}-{light,dark}.png` (the review report with the navy → sky example; the stand-in diff images are redline orange like the real overlay), `122-landing-01-…`, `122-landing-03-…`, `122-playground-…` (brand-ab loaded, Brand(Alias) panel on BrandB), `122-badge-{light,dark}.png`.
