# TICKET-061: Docs HTML generator as a package function (decision needed)

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** 059
**Status:** ready-for-agent
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Resolve spec decision 9. Recommended: port `formatters/docs-html.ts` verbatim into a small package as a pure function over the model (no redesign; Epic 7 owns that), proven by the `output/docs/index.html` snapshot of both fixtures. If you pick option (b) instead, this ticket becomes a short ticket that records the accepted diff and removes the docs step from the new `build`.

## Acceptance Criteria

- [ ] Decision recorded in the spec (a or b)
- [ ] (a) The function's output is byte-identical to `test/snapshots/*/build/files/output/docs/index.html`; package has a README and small public API
- [ ] (b) The reviewed snapshot diff and the 039 row say "replaced by Epic 7"
- [ ] 039 parity table rows updated in the same PR; legacy files that are now unused are deleted (label `legacy-exception`)
- [ ] All gates pass, and the GitHub run is green
