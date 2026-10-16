# TICKET-061: Docs HTML generator as a package function (decision needed)

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** 059
**Status:** done
**Spec:** [cli-parity](../specs/cli-parity.md)

## What to build

Resolve spec decision 9. Recommended: port `formatters/docs-html.ts` verbatim into a small package as a pure function over the model (no redesign; Epic 7 owns that), proven by the `output/docs/index.html` snapshot of both fixtures. If you pick option (b) instead, this ticket becomes a short ticket that records the accepted diff and removes the docs step from the new `build`.

## Acceptance Criteria

- [x] Decision recorded in the spec (a or b)
- [x] (a) The function's output is byte-identical to `test/snapshots/*/build/files/output/docs/index.html`; package has a README and small public API
- [x] (b) not taken (option a chosen) The reviewed snapshot diff and the 039 row say "replaced by Epic 7"
- [x] 039 parity table rows updated in the same PR; legacy files stay until the cut-over (066): `snapshot:check` still drives the legacy CLI
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- New package `@dta/docs` (`generateDocsHtml(tokenFiles, brands)`): the legacy generator, with the two file-system reads replaced by `{fileName, content}` input (files sorted by name; invalid JSON skipped instead of throwing). Output is byte-identical to `output/docs/index.html` of both fixtures (tested).
- Epic 7 owns any redesign.
