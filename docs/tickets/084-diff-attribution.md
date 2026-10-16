# TICKET-084: Explain visual changes by token

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** L
**Blocked by:** 083
**Status:** open
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 8, 9)

## What to build

Every changed story is marked explained (its changed regions trace to changed tokens) or unexplained, and results are grouped by token change: "color.action 600 → 700 explains 96 of 100 changed stories; 4 are unexplained". Thresholds apply by cause.

## Acceptance criteria

- [ ] Element-level attribution by revert, as recommended in [083](./083-diff-attribution-spike.md): for each changed story, each changed token (grouped per collection · mode, split when a group does not fully explain a story) is set back to its base value in the head page; elements whose computed style (incl. `::before`/`::after`) or box changes are its dependents
- [ ] `@dta/build` exposes, per token and mode, the CSS variable name and the selector it was written under (`:root`, `[data-brand="…"]`), so the revert rule matches the build; primitives built as literals are reverted through the semantic variables that reference them (`affected` entries)
- [ ] A changed pixel is explained when it lies in a dependent's head or base box (2 px tolerance); a story is explained when all its changed pixels are; unexplained stories report the pixel count and bounding region
- [ ] Each result lists, per story, the explaining tokens with dependent count and explained pixels (tokens may overlap)
- [ ] Fixture site at two commits: token-only change → all explained; component change → unexplained; a token in one mode only explains only that mode's elements
- [ ] Attribution cost logged per story; it runs only on changed stories
- [ ] Thresholds by cause in config; exit code with `--fail-on-change` counts only unexplained changes above threshold plus unreviewed explained groups
- [ ] `result.json` schema versioned and documented
- [ ] All gates pass, and the GitHub run is green
