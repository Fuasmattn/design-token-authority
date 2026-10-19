# TICKET-113: Playground: an example that shows findings

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** Medium
**Effort:** S
**Blocked by:** 077
**Status:** open
**Spec:** [playground](../specs/playground.md) (decision 6)

## Problem

The one-click example (brand-ab) lints clean, so a visitor never sees what a finding looks like, which is the point of the tool (noticed on the 077 screenshots, 2026-10-19).

## What to build

A second example, "Example with problems", next to "Load example": brand-ab with a few deliberate flaws that the default rules catch (e.g. a semantic token with a raw value instead of an alias, a broken alias, a duplicate value, a contrast pair that fails), so the findings list, the structure table and (later) the graph's redlines all have something to show. Kept as a fixture in `test/fixtures/` so its findings are checked against `dta lint` output, not written by hand.

## Acceptance criteria

- [ ] Fixture with deliberate flaws; a test checks the playground's findings equal `dta lint` on it
- [ ] "Example with problems" button in `TokenInput` (story updated), bundled like brand-ab (no request)
- [ ] All gates pass plus the site job, and the GitHub run is green
