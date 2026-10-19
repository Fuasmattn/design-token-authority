# TICKET-112: Landing page: the workflow at a glance, and scenes that match it

**Phase:** 10 — Landing redesign
**Priority:** Medium
**Effort:** M
**Blocked by:** — (108 is done)
**Status:** done (2026-10-19), pending the maintainer's review of the Vercel preview
**Spec:** [landing-redesign](../specs/landing-redesign.md) (revision 2026-10-19, decision 12); [concept-notes](../specs/concept-notes.md) ("The loop has two sides")

## Problem

The redesigned page tells one change in four scenes, but a visitor never sees the workflow itself: what happens between "something changes" and "it ships". The scenes skip `lint` entirely, and scene 03 ("A person decides") shows `dta build` as its command, which mixes the decision with the rebuild after it. The maintainer misses a basic section with the steps (2026-10-19).

## What to build

Both, in this order:

1. **A workflow strip right below the hero** (the "How it works" anchor of the nav). One row, **unnumbered**, drawn as two sides meeting in a pull request, not as a ring:
   - **Change** — in Figma Variables, in a token file, or by an agent (the design side; muted label "where the change is made")
   - then, inside the pull request: **Check** (`dta lint`) → **Build** (`dta build`) → **Diff** (`dta diff`) → **Decide** (a person approves by token)
   - a return hint after Decide: "a fix goes back to whichever side caused it" (`dta audit` for hard-coded values in code), no arrow back to the start
   - each step: a one-word label, one short muted line, and the command as a small `CommandChip` (or plain mono text if chips are too heavy at this size; decide on the preview). Below 760 px: a vertical list, the pull-request bracket becomes a left rule.
   - The pull of the change into the repository (`dta pull`) sits on the crossing between Change and Check.
2. **Scenes that match the strip.** Scene 03 shows the checks and the decision, so its command becomes `dta lint` (the first check the reviewer sees) and its text keeps "then every output is rebuilt"; `dta build` lives in the strip. Kickers and headings stay; only commands and short texts move where needed so every step in the strip appears at most once in the scenes, in the same order.

Design-system first (CLAUDE.md rule): the strip is a component under `site/src/components/ds` with a docs page and stories before the page uses it. Either a new `WorkflowStrip` or a reworked `WorkflowRail` (today: numbered stations with a moving packet, used only in its own story). Recommended: rework `WorkflowRail` into the unnumbered strip and retire the numbered variant, so there is one workflow component.

## Acceptance criteria

- [x] `WorkflowRail` (or `WorkflowStrip`) shows the two sides and the pull request between them, unnumbered, with a docs page and stories; phone layout as a vertical list
- [x] Strip placed below the hero under the "How it works" anchor; fits the one-surface rules (no grid, no card chrome, borders not shadows)
- [x] `COMMANDS` gains `lint` (and `audit` if shown as a chip); the honesty test covers every command in the strip
- [x] Scene 03 command is `dta lint`; no step appears twice across strip and scenes in a contradicting order
- [x] AAA contrast test green on the page; no horizontal scroll at 390 px in both themes; layout shift 0
- [x] Reference snapshots re-recorded by name where the stories change
- [ ] Vercel preview reviewed by the maintainer before merge; all gates pass plus the site job, and the GitHub run is green

## Notes

- Copy stays in `site/src/landing/content.ts` (a `WORKFLOW` constant next to `SCENES`) so the honesty test sees it.
- Motion: none needed. If the old packet animation is kept, it respects `prefers-reduced-motion` and runs once, not in a loop.
- British spelling, as on the rest of the page.

## Outcome

- **One workflow component.** `site/src/components/ds/WorkflowRail.astro` is reworked into the unnumbered strip (recommended option); the numbered stations, their states and the travelling packet are retired, so there is no motion left in it. The change sits under a dashed `rail` bracket labelled "where the change is made"; `dta pull` is on the crossing ("into the repository"); Check (`dta lint`) → Build (`dta build`) → Diff (`dta diff`) → Decide sit under a solid `border-strong` bracket labelled "in the pull request", with thin `fg-subtle` arrows between them; the return line under the pull request says "A fix goes back to whichever side caused it: a value in Figma, or a component in code." with `dta audit` ("finds the hard-coded ones"). No arrow back. Steps are an ordered list for screen readers; the section has a visually hidden "How it works" heading. Docs page `design-system/components/workflow-rail.mdx` rewritten; the design-system overview lists it with the landing components and no longer mentions the rail packet. Story `workflow-rail--default` ("Two sides meeting in a pull request", 1280 and 390) replaces "Stations on the rail" (same id).
- **Chips, not plain mono** (decided on the preview): every command on the page stays the same `CommandButton` (spec decision 9). Chips do not wrap (151–161 px), so the **row starts at a 960 px container** (viewport ≈ 1024) rather than 760 px; below it the strip is the vertical list (the pull request's bracket becomes a 2 px left rule with its label, steps and return line inside; the change side a dashed one). Step columns are `minmax(min-content, 1fr)`, so a column is never narrower than its chip, and the chips stand on one line whatever the text above them. In the side-by-side theme panels of the docs and story routes (≈ 586 px each at 1280) the list is what shows, as for `Scene` and `Facts`; the row is checked on the page screenshots below.
- **Page.** `site/src/pages/index.astro` places the strip right below the hero (`<div class="wrap how">`, `id="how"`); the nav's "How it works" now points at `#how` (was `#story`). `landing.css` only adds the `.how` spacing. One surface, no grid, no card, borders not shadows (`components.test.ts`, `styles.test.ts` green).
- **Content and honesty.** `site/src/landing/content.ts`: `WORKFLOW` next to `SCENES`; `COMMANDS` gains `lint` and `audit` (both shipped). Scene 03's command is `dta lint`; its text keeps "Then every output is rebuilt". `CHECKS` on the page now run in the strip's order (lint passed, build passed, diff changes to review · 2 stories) instead of lint, diff, build pending, so build no longer contradicts the strip's order. `landing.test.ts` adds two tests: every command in the strip is a shipped `COMMANDS` entry whose subcommands exist in the CLI, and the strip is unnumbered, scene 03 shows `dta lint`, no scene command repeats, `dta build` is not a scene command, and the checks follow the strip's order.
- **Observation for the maintainer:** the scene commands now read `dta pull` (01) → `dta diff` (02) → `dta lint` (03), while the strip runs lint before diff. That is what this ticket asks for (scene 03 is the decision, and `dta lint` is the first check the reviewer sees there); the scenes map to the strip's Change → Diff → Decide in order. If the chip order should match the strip literally, scene 03 would need a different command or scenes 02/03 would swap; not done here.
- **Checks recorded** (built site, headless Chromium (Playwright build 1194), 1280×900, 1024×900, 1000×900 and 390×900, light and dark): no horizontal scroll at any width (`scrollWidth` = viewport); cumulative layout shift 0 on the page; rendered contrast audit (`contrast.e2e.test.ts`) green on the page in both themes at 1280 and 390 and on every story; `motion.e2e.test.ts` green. Screenshots (not committed): `112-{1280,390}-{light,dark}.png` (full page) and `112-strip-*.png` in the session scratchpad.
- **Snapshots:** no CLI reference snapshot under `test/snapshots/` lists site stories, so nothing needed re-recording; `pnpm snapshot:check` unchanged (34 passed). The `dta diff` baseline of `workflow-rail--default` changes by design.
- **Gates:** prettier, typecheck, boundaries, `pnpm test` (845 passed), snapshot check and `pnpm site:build` (links valid) green, with Node 24.14.1 from `.nvmrc`.
- Vercel preview: to be reviewed by the maintainer before merge.
