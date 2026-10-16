# TICKET-056: Lint: semantic-must-alias and naming-pattern rules

**Phase:** 8 — Token Engine Overhaul, Epic 5 (@dta/lint)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-055
**Status:** done
**Spec:** [lint-package](../specs/lint-package.md)

## What to build

Add the two collection-scoped configurable rules.

## Acceptance Criteria

- [x] `semantic-must-alias`: raw values in the listed collections are violations (default severity `warn`; `off` and `error` respected; no `collections` means the rule does nothing); message as in legacy
- [x] `naming-pattern`: per collection a regular expression that every path segment must match; the first failing segment of a token is reported; collections without a pattern are ignored
- [x] An invalid regular expression is an error diagnostic naming the collection; the rule skips that pattern and other patterns still run
- [x] Violations carry the legacy `tokenPath` (graph id) and `file` (`Collection.Mode.json`)
- [x] Legacy test cases for both rules re-expressed through `lintTokens`
- [x] 039 parity table updated
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- Segments come from the graph id (`Collection.Mode/Group/Token`), so collection names and mode names containing dots cannot confuse the match.
- An invalid regex yields an `invalid-config` error diagnostic naming the collection and skips only that pattern.
