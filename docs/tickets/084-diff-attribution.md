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

- [ ] Attribution at the granularity 083 recommended
- [ ] Fixture site at two commits: token-only change → all explained; component change → unexplained
- [ ] Thresholds by cause in config; exit code with `--fail-on-change` counts only unexplained changes above threshold plus unreviewed explained groups
- [ ] `result.json` schema versioned and documented
- [ ] All gates pass, and the GitHub run is green
