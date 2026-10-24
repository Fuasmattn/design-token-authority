# TICKET-120: Status colours for success, warning and error

**Phase:** 8 — Token Engine Overhaul, the design system
**Priority:** High
**Effort:** M
**Blocked by:** —
**Status:** done (implemented 2026-10-19 on the proposal's values; GitHub run pending, nothing committed)

## Problem

The design system has no status colours. Errors and warnings are told apart only by shape (filled square, open ring) in ink, success borrows `sage` ad hoc, and `signal` (redline orange) is reserved for redlines and diffs and must never mean "error". Lint findings, failed builds (119), checks and the summary line need colours people read at a glance (maintainer, 2026-10-19).

## What to build

- **Primitives:** `crimson` and `ochre` scales next to the existing `sage`; values per the proposal (light: error text `#8c151c`, marker `#c42b30`, subtle `#fde4e1`; warning `#5e3f00` / `#7d5a00` / `#faecc8`; success `#27512f` / `#3c7646` / `#e1eee2`. Graphite: error `#ffb3ad` / `#f0736b` / `#3d1b19`; warning `#f2d08a` / `#f0c64a` / `#3a2d10`; success `#9ad3a2` / `#7fb887` / `#1c2a1e`).
- **Semantic tokens per theme:** `status.{success,warning,error}.{text,marker,subtle}`; text reaches 7:1 on canvas, surface and its own subtle; markers ≥ 3:1 (non-text). Info stays `action`; `signal` stays for redlines and diffs only.
- **Contrast and colour-vision check (2026-10-19):** all text pairs ≥ 7:1 on canvas, surface, `bg-subtle` and their own subtle in both themes (lowest: light success text on `bg-subtle` 7.19); markers ≥ 3:1 on all four (lowest: light warning marker on `bg-subtle` 4.97). Simulated protanopia/deuteranopia: the first warning marker (`#a86f00`, graphite `#dfa93a`) was almost indistinguishable from `signal` (ΔE 7), so the markers moved to `#7d5a00` / `#f0c64a` (ΔE ≥ 12 to signal, ≥ 9 to error). The CI contrast test must cover these pairs; the shapes and words carry the meaning for everyone.
- **Shapes stay:** colour adds to the markers (dot = success, open ring = warning, filled square = error) and the words; never colour alone.
- **Apply:** Findings, Checks, SummaryLine counts, the Outputs "build failed" block, TokenInput/diagnostics, the `dta diff` report verdicts, the Terminal's success line (`terminal-success`) where it fits; a status banner pattern (subtle background + complete 2px marker-colour outline, per principle 3).
- **Docs:** a Status colours section in the design system (tokens, when to use which, never `signal` for errors, shape + word + colour), token pages, component docs and stories updated; AAA contrast test covers every status pair in both themes.

## Acceptance criteria

- [x] Primitives and semantic status tokens built with `dta build`; contrast test proves the pairs
- [x] Components and the report use them; no status literals; stories and docs updated
- [x] Design-system docs: status colours rule and examples
- [ ] All gates pass plus the site job, and the GitHub run is green (all gates and the site job pass locally; the GitHub run is pending)

## Outcome

- **Tokens** (`site/tokens`, built with `dta build`): new primitive scales `crimson` and `ochre` with the steps of `sage` (100, 300, 400, 600, 700, 950), so `status.<s>.text/marker/subtle` alias step 700/600/100 in Light and 300/400/950 in Graphite for all three statuses. `sage` already held the proposal's success values exactly; its descriptions now say what each step is for. Semantic `status.{success,warning,error}.{text,marker,subtle}` per theme with exactly the proposal's hex values (a test pins them). The old `success.fg` / `success.subtle` are gone: every use moved to `status-success-*` (the dots to `-marker`, the words to `-text`). `pnpm report:tokens` regenerated `tokens-css.ts`.
- **Contrast test over the tokens** (`site/tokens.test.ts`): each status text ≥ 7:1 and each marker ≥ 3:1 on `bg-canvas`, `bg-surface`, `bg-subtle` and its own subtle, in both themes. Lowest text pair: Light success text on `bg-subtle`, 7.19:1. Lowest marker pair: Light success marker on `bg-subtle`, 4.28:1. The ticket's note said the lowest marker was Light warning on `bg-subtle` at 4.97; that is the lowest _warning_ marker, and the success marker sits lower. All marker pairs still pass 3:1. Graphite lowest: success text on its subtle 8.73, error marker on `bg-subtle` 5.36.
- **Applied:**
  - Findings: error and warning markers in `status-*-marker` (the shapes stay); the word (`error`, `warn`), the rule count and the summary line in `status-*-text`. The rest of a line stays in the ink.
  - A new `banner` prop gives the status banner pattern: the subtle tint, a complete 2px `stroke-ink` outline in the marker colour, `radius-md`, and every line, detail and link in status text.
  - The banner is used for the Input findings (invalid input, unknown export) and the Outputs "Build" findings (build failed).
  - SummaryLine parts get a `tone`: marker plus status text, used for the lint count (error, warning or success by outcome) and `build failed`.
  - DetailPanel `kickerSeverity`: marker and status text for a finding's kicker.
  - Checks gain `warnings` (passed with warnings, ring) and `failed` (square).
  - Chip gains `warning` and `error` tones with ring and square markers.
  - DiffCard `blocked` is now the error chip.
  - The `dta diff` report: `.chip.pass` and `.chip.unchanged` are success, and `.chip.fail` (the fail verdict and "unexplained") is error. Pass and fail chips carry the dot and the square. `removed` stays signal.
  - CopyButton's pass dot uses `status-success-marker`.
- **Decisions:**
  - (1) "Changes to review" stays signal in Checks. It is a diff state (the PR changed something a person looks at), not a problem. In the report the review verdict keeps its existing action tint. Both are diff states, not statuses.
  - (2) `terminal-success` stays its own token. The terminal is dark in both themes, so Light's success text cannot be used on it. It is `sage.300`, the same green as Graphite's success text.
  - (3) Info stays `action`, and selection keeps overriding status: a selected finding turns `action-text`.
  - (4) Starlight asides: caution now maps to warning and danger to error. They were signal, which broke "never signal for errors".
  - (5) StructureTable's "⚠ review" (low confidence) moves from `signal-text` to `status-warning-text`. It is a caveat, not a change.
  - (6) The banner is only for what stops the work. The lint view stays a list.
- **Docs:** new rules page [Status colours](../../site/src/content/docs/design-system/status-colours.mdx). It covers:
  - the tokens table and a live per-theme panel (`StatusTokens.astro`) computing the lowest ratios from the token files;
  - when to use which, and what is not a status;
  - shape + word + colour;
  - the banner;
  - the colour-vision note;
  - do and don't.

  Elsewhere:
  - The overview's principle 2 and Patterns now have "Severity markers" (replacing "Severity without colour") and "Status banner"; the sidebar has the new page.
  - The Colours page has the `status-*` group.
  - Component pages updated: Findings, Checks, Chip, Summary line, Detail panel, Output files (build failed), Token input (invalid input), Terminal, Diff card, Structure table, Copy button.
  - New stories: `findings--build-failed`, `checks--states` and `summary-line--problems` (desktop and phone). `chip--states` now includes the status chips and a phone viewport. Updated stories: findings input and unknown (banner), the detail-panel sheet (kicker), and summary-line default (success tone).

- **Tests:**
  - `tokens.test.ts`: values and pairs.
  - `design-tokens.test.ts`: 47 semantic colours, the scales, and the status names.
  - `html.test.ts`: verdict chips on status tokens, never signal for fail.
  - `contrast.e2e.test.ts`: new rendered AAA check of the `dta diff` report for pass, review and fail in Light and Graphite at 1280 and 390 (12 cases), besides the existing playground states (incl. example with problems lint, build errors, invalid input), landing and every story.
  - `components.test.ts` guards unchanged and green: no literals, borders complete, focus via box-shadow halo.
  - No CLI snapshot covers the report HTML, so none was re-recorded.
- **Gates** (Node 24.14.1, `TERM=xterm-256color`):
  - prettier, typecheck, and boundaries pass.
  - `pnpm test` with Chromium: 1173 passed, plus 1 failing in `analyse.test.ts`. That failure is the clack-gutter problem fixed on `main` in 7c89b33, and it passes with that commit applied.
  - `snapshot:check` 41 passed; `pnpm site:build` 122 pages, links valid; `test:contrast` 105 passed, plus the 12 report cases.
  - GitHub run: pending.
- **Screenshots** (session scratchpad, not committed): `120-lint-panel-1280-*`, `120-outputs-failed-{1280,390}-*`, `120-invalid-{1280,390}-*`, `120-landing-checks-{1280,390}-*-{02,03}`, `120-status-docs-{1280,390}-*`, `120-story-{checks,chips,summary,sheet}-*`, `120-report-{fail,pass}-*`, each in Light and dark.
- **Left open:**
  - The report's "review" verdict (action tint) and Checks' "changes to review" (signal) still differ in colour. Both are deliberately not statuses; aligning them is a separate decision.
  - CopyButton's "Not copied" has no error marker.
  - Terminal has no error tone, since no real CLI output shown on the site needs one yet.
