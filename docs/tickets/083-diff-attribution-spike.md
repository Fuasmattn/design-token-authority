# TICKET-083: Spike: record which CSS variables each element uses

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** S
**Blocked by:** 082
**Status:** open
**Spec:** [visual-diff](../specs/visual-diff.md) (decision 8, open question 2)

## What to build

A time-boxed spike answers whether DTA can reliably record, per rendered element, which CSS custom properties resolve on it (including inheritance, shorthands, `calc()`), and at what cost. The result is a short write-up in the ticket and a recommendation: element-level or story-level attribution for version 1.

## Acceptance criteria

- [ ] Prototype on the website's stories; cases that work and cases that do not, with examples
- [ ] Runtime cost per story measured
- [ ] Recommendation recorded; 084's acceptance criteria adjusted accordingly
- [ ] No production code merged except tests or fixtures that 084 reuses
