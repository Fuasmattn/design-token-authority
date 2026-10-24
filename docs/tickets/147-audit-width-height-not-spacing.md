# TICKET-147: `dta audit` suggests width/height tokens for paddings and margins

**Phase:** 8 — Token Engine Overhaul (follow-up)
**Priority:** Low
**Effort:** S
**Blocked by:** —
**Status:** open

## What to build

Found in TICKET-146: the site got `size.icon` (20, Figma scope `WIDTH_HEIGHT`), and `dta audit` on the site then suggested `size.icon` for four `padding: … 20px` and `margin: 20px` values. `kindsOf` in `packages/cli/src/audit/match.ts` treats `WIDTH_HEIGHT` like `GAP` (both "spacing"), so a size token is offered wherever a spacing value is expected.

Give width/height tokens their own kind: suggested for `width`, `height`, `min-/max-width`, `min-/max-height`, `inline-size`, `block-size`, `flex-basis`, never for `padding`, `margin`, `gap` or `inset`. A token with both scopes (`GAP` and `WIDTH_HEIGHT`) stays a candidate for both. Name-based detection without scopes stays as it is.

## Acceptance criteria

- [ ] `match.test.ts`: a `WIDTH_HEIGHT` token is suggested for `width: 20px`, not for `padding: 20px`; a token with both scopes for both
- [ ] The site's four `size.icon` entries leave `site/.dta/audit-baseline.json`; `site/audit.test.ts` back to "2 more in the baseline"
- [ ] Snapshots unchanged, or re-recorded per scenario if a fixture is affected
- [ ] Audit reference page: one sentence on how scopes decide the kind
- [ ] All gates pass
