# TICKET-109: `dta diff` report: before/after with the change outlined, instead of thumbnails

**Phase:** 10 — Landing redesign (follows Epic 8)
**Priority:** Medium
**Effort:** M
**Blocked by:** 108 (the presentation is settled there)
**Status:** done
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decision 7); [visual-diff](./visual-diff.md)

## What to build

The report's per-story row currently shows three thumbnails (baseline, candidate, diff heat map) that a reviewer has to decode. Replace it with the landing page's presentation: the story rendered before and after at a readable size, the changed region outlined in the signal colour on the "after" render, and the token callout placed on the change ("Colors.Brand.Primary · Nova 500 → 600") when a token explains it; the heat map stays available behind a toggle for unexplained differences. Same tokens and components as the website (the report is styled from the DTA Drafting Table); the `DiffCard` component is reworked or replaced accordingly, with its docs page and story updated.

**Today (after 084/085/111):** each story has three thumbnails (baseline, candidate, diff) and below them a large before/after slider with the changed elements outlined and their token labels (stacked since 111). So the decision is how before/after side by side, the slider and the diff overlay fit together.

**Design board first (maintainer, 2026-10-20):** a board (1280 and 390, light and dark) shows the reworked story row; building waits for "looks good".

**Board feedback (maintainer, 2026-10-20), revision asked for:** the first board's before/after side by side showed an unchanged "before" (its example story was the landing demo, itself a main/this-change pair, so "before" looked like nothing changed). Direction now: **only "after"** with the outline and the token notes; a **"Show before"** control swaps the image in place (same spot, so a subtle step is visible by flicking); for unexplained changes the diff overlay is on by default and "Show before" sits beside it. The example is a plain story (e.g. a card), not the landing demo.

**Wording (maintainer, 2026-10-21, after the build screenshots):** "After · head" / "Before · base" confuse (git words). The panel heading reads **"With this change"** (the branch or head ref in small meta beside it) and, with "Show before" on, **"Before this change"** (the base ref and short sha in small meta, e.g. "main · 2ee9b31"). The button keeps "Show before".

## Acceptance criteria

- [x] Design board approved by the maintainer (2026-10-20, revised board: `docs/specs/visual-diff/prototypes/ReportRow.dc.html`)

- [x] Report rows show before/after with the outline and callout; unexplained differences still show the diff overlay
- [x] `dta diff` end-to-end test and the report HTML tests updated; design-system guards pass
- [x] Screenshots 1280 and 390, light and dark, shown before pushing
- [x] All gates pass, and the GitHub run is green

## Outcome

**Board decisions (approved 2026-10-20, with the proposals for its open questions):**

1. A story row shows only "after" with the changed elements outlined and the token notes (stacked, joined by a leader line) plus a token table (base, head, what it outlines); the thumbnails and the slider go; "Whole images: before · after · diff" links stay.
2. "Show before" (toggle with box, tick and on/off word, keyboard operable) swaps the image in place; outlines and notes hide but keep their space; the label switches "After · head" / "Before · base <sha>".
3. Unexplained rows: diff overlay on by default, dashed outline and "unexplained · no token", "Show before" beside the overlay toggle. Explained rows have no overlay toggle (the outline shows where; the diff image is linked).
4. Orange outlines and notes get a 1 px ink line (orange alone is under 3:1 on light stories).
5. Note wording: colours show the alias step (Nova 500 → 600), sizes the resolved numbers (8 → 24).
6. No keyboard shortcut for "Show before" for now.

**Built (2026-10-20), following decisions 1–6.**

- **Row** (`packages/visual-diff/src/report/html.ts`, `row()`): header (story, viewport, "· 1.92% changed", chips changed + explained/unexplained), a bar with the side label and the toggles, the stage, the token table, "Whole images: before · after · diff". Thumbnails, slider, their script and CSS are gone (`.thumbs`, `.slider`, `.handle`, `--pos`, `input[type=range]`).
- **Outlines and notes (1, 4, 5):** one outline per distinct box (all of a token's regions now, up to five, not only the first); tokens on the same box share one stack of notes. Outline: 2 px `signal-bg` with a 1 px `ink-900` line inside (border) and outside (`box-shadow`), 3 px outside the element; leaders 2 px signal between two ink lines; notes `signal-fg` on `signal-bg` with an ink border (redline label exception, as before). Wording: colours with both sides aliased show the last two alias segments, the palette once when it stays (`Nova 500 → 600`, else `Navy 700 → Sky 500`); everything else the resolved values (`8 → 24`, `#2f55d4 → #13213f`).
- **Placement:** a small inline script puts each stack under its box: boxes that share rows form a band, stacks go in lanes under the band, a stack moves right of its neighbour while its leader still lands on its box, otherwise it takes the next lane with its leader clear of the notes above; "unexplained · no token" sits right of its box when it fits. The stage reserves the room below the image (`--room`). Without JavaScript the notes line up under the image, leaders and toggles are left out (`html.js` set before first paint), "after", outlines and links stay.
- **Show before (2, 6):** `<button aria-pressed>` with box, tick (SVG) and the on/off word (fixed 3ch), `aria-label` "Show before", `aria-describedby` the row's heading; Enter and Space (native button), no shortcut. Both images sit in one place; `data-before` on the row swaps their `visibility` and hides outlines, leaders, notes and the overlay without removing them. The label is a CSS swap: "After · head / this change" and "Before · base / <short sha>" share one grid cell, so the wider sets the width and nothing moves (a text swap moved the meta by a fraction of a pixel: the layout-shift test caught it). The sha comes from `result.base` (`… (1a2b3c4)`), a directory base shows its name.
- **Unexplained (3):** the diff PNG over "after" with `mix-blend-mode: multiply` (changed pixels in signal, the rest stays clear), on by default with its own toggle beside "Show before"; dashed outline (signal and ink) and the note "unexplained · no token" in ink on `paper-0` with a dashed border; the sentence from the board under the image. Explained rows: no overlay, no overlay toggle. A partly explained row shows both.
- **Image:** the stage is the story page's paper (`paper-100`, both themes: screenshots do not follow the theme), the image at most its natural width, cropped 48 px below the lowest changed box (the rest of the page did not change; the whole images are linked). Phone (≤ 640 px): the stage runs edge to edge, toggles full width one under the other, notes in two lines, the token table becomes a list (base, head, box).
- **Data:** everything comes from `result.json` as it is (attribution regions, element labels, canvas; token before/after from `review.tokens` and `tokens.changes`; the base label). No schema or public API change, no CLI snapshot changed.
- **DiffCard** (design system first): reworked into this row (`site/src/components/ds/DiffCard.astro`; screenshots as slots `after`/`before`/`diff`, boxes in canvas pixels, the same toggles and the same note placement as the report's script). Stories `diff-card--explained`, `--before` ("Show before" pressed) and `--unexplained`, 1280 and 390 (were `review` and `blocked`, 1280 only); stand-in screenshots in `site/src/examples/orbit-card.ts` (an Orbit Burger order card, blue and grey, SVG). Chip gains a `neutral` tone (no marker) for "explained" (Chip docs and `chip--states`).
- **Docs:** Diff card page rewritten (guidelines incl. the contrast numbers, toggle, unexplained, phone, no JS); guide _dta diff in pull requests_: new section "Reading the report", intro no longer mentions the slider; Status colours (redlines with ink line, the new audit); design-system overview; spec `visual-diff.md` decision 10 records the row.

**Deviations from the board (and why):**

- Meta next to "After · head" is "this change", not "this pull request": `dta diff` also runs locally, without a pull request.
- The image is cropped below the lowest change and shown at most at its natural size; the board drew a hand-made card at 1:1. A 1280 render on a phone is therefore small (whole images linked); the 390 render of the same story is in the report too.
- While "before" shows, the diff overlay hides as well (the flick shows the real pixels); the overlay toggle keeps its state.
- "Outlined" lists the element labels the attribution carries (`span.button`, `div.card`), not the board's "button" / "card".
- The report's story-status chip "changed" keeps its action tint (unchanged since 121); the DiffCard uses Chip `info` for it, which is the same look, and the new `neutral` for "explained".
- In the DiffCard stories "Whole images" link to the slots and only an unexplained card links a diff (there are no PNGs in a story).

**Tests.** `report/html.test.ts` (13): row structure (header, side labels, both images, no overlay on explained, crop and mark position, note markup and wording, table, whole images), no thumbnails or slider, toggle markup (box, tick, on/off, `aria-pressed`, `aria-describedby`; visibility not display), no-JS fallback, ink line CSS, stacked notes per box and the alias/number wording, unexplained defaults (overlay on, toggle order, dashed, note, sentence, no table), added stories one-sided without toggles. `diff-visual.test.ts` (e2e): the card row (after, before, no overlay toggle, note `Brand · #2f55d4 → #13213f`, outlined `div`, diff link) and the button row (overlay on, dashed box, note). `contrast.e2e.test.ts`: report cases now 20 (pass; review and fail with "Show before" off and on; both themes; 1280 and 390) on SVG stand-in screenshots served for the PNG paths: AAA text in both toggle states; outlines, leaders and notes at 3:1 against the screenshot pixels around them by signal or ink line (checked to fail at 2.98:1 without the ink line); notes overlap neither each other nor an outlined box; "Show before" by keyboard (Space, back with Enter) changes `aria-pressed`, the word, the label and visibility while every box of the row stays put and the layout shift is 0 (inputs included); unexplained opens with the overlay on, explained has no overlay toggle. The story audit covers the three DiffCard stories. `stories.test`/`components.test` (tokens only, borders, `box-shadow` as halo only), `example-colours`, `dta audit` on the site pass.

**Gates** (Node 24.14.1): prettier, typecheck, boundaries pass; `TERM=xterm-256color CI=true pnpm test` 1156 passed (147 skipped); `snapshot:check` 41 passed, none changed; `pnpm site:build` 136 pages, links valid; `test:contrast` (Chromium) 151 passed; diff e2e (`DTA_E2E=1`) 2 passed. Nothing committed or pushed.

**Screenshots** (session scratchpad, not committed): `109-report-{explained,before,unexplained}-{1280,390}-{light,dark}.png`. Explained and before: a real Orbit Burger run (`dta diff --base 617cea0` in `site/examples/orbit-burger`, 617cea0 a dangling throwaway commit = the working tree with `tokens/` = `tokens-base/`, on no branch; same result as 111: 6 changed, 106 unchanged, both tokens explain `span.button`), row `scene--default` at 1280 and at 390. Unexplained: a small fixture like the e2e one (an order card whose title goes 22 → 25 px in the component). DiffCard stories: `109-diffcard-{explained,before,unexplained}-{1280,390}.png`.

**Wording (2026-10-21, after the build screenshots).** Headings in words, no git words:

- "With this change", meta: the head. `result.json` records nothing about the head (only `base`, a label), and `dta diff` renders the working tree, so the meta says "working tree"; the branch name would need a new optional `head` field in `dta.diff/1` (not added).
- "Before this change", meta: the base in words from `result.base`: `merge base with origin/main (1a2b3c4)` → "main · 1a2b3c4" (`origin/`/`upstream/` dropped), `release (1a2b3c4)` → "release · 1a2b3c4", a ref that is itself a sha → only the short sha (e.g. the Orbit run's "617cea0"), a directory base → its name.
- The separate "this change" meta is gone; the button stays "Show before". Added stories read "With this change · new story", removed ones "Before this change · <base> · removed story". Image alt texts follow ("scene--default@1280 with this change").
- Both headings, each with its meta, share one grid cell (the larger sets the box; inside, heading and meta may wrap at 390), so toggling moves nothing: the contrast suite's geometry check now includes the heading box, layout shift 0 at 1280 and 390.
- Changed: `report/html.ts` (`baseInWords`, `HEAD_IN_WORDS`, the swap), `DiffCard.astro` (`base` now the base in words, new `head` prop, default "working tree"), the three DiffCard stories (`base="main · 2ee9b31"`), Diff card docs (new guideline "Headings in words"), guide "Reading the report", spec decision 10. Tests: `html.test.ts` 14 (new: base in words for merge base, ref, sha and directory; no "After · head"/"Before · base" anywhere), `contrast.e2e.test.ts` (visible heading text in both states, heading box in the geometry), `diff-visual.test.ts` ("working tree" and "main · <sha>").
- Screenshots: `109c-report-{explained,before,unexplained}-{1280,390}-{light,dark}.png` (same runs as above).

**Open.** Screenshots shown to the maintainer; GitHub run.
