# TICKET-112: Landing page: the workflow at a glance, and scenes that match it

**Phase:** 10 — Landing redesign
**Priority:** Medium
**Effort:** M
**Blocked by:** — (108 is done)
**Status:** open
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

- [ ] `WorkflowRail` (or `WorkflowStrip`) shows the two sides and the pull request between them, unnumbered, with a docs page and stories; phone layout as a vertical list
- [ ] Strip placed below the hero under the "How it works" anchor; fits the one-surface rules (no grid, no card chrome, borders not shadows)
- [ ] `COMMANDS` gains `lint` (and `audit` if shown as a chip); the honesty test covers every command in the strip
- [ ] Scene 03 command is `dta lint`; no step appears twice across strip and scenes in a contradicting order
- [ ] AAA contrast test green on the page; no horizontal scroll at 390 px in both themes; layout shift 0
- [ ] Reference snapshots re-recorded by name where the stories change
- [ ] Vercel preview reviewed by the maintainer before merge; all gates pass plus the site job, and the GitHub run is green

## Notes

- Copy stays in `site/src/landing/content.ts` (a `WORKFLOW` constant next to `SCENES`) so the honesty test sees it.
- Motion: none needed. If the old packet animation is kept, it respects `prefers-reduced-motion` and runs once, not in a loop.
- British spelling, as on the rest of the page.
