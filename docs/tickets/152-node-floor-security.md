# TICKET-152: Require the patched Node.js 24 (October 2026 security release)

**Phase:** 8 — Token Engine Overhaul (follow-up)
**Priority:** High
**Effort:** XS
**Blocked by:** —
**Status:** in review (2026-10-25)

## What to build

The Node.js security release of 21 October 2026 fixed ten CVEs (four high: TLS hostname checks, DNS, the Brotli decoder) in 22.23.4, 24.22.1 and 26.12.1. The repository already runs 24.22.1 (`.nvmrc`, so CI, the release workflow and Vercel's 24.x), but the packages' `engines` allowed `>=24.14.1`, so users could run DTA on an unpatched Node without a warning.

- `engines.node` `>=24.22.1` in the root package (published as `design-token-authority`), `create-dta` and every workspace package.
- README, Quick start and Contribute say 24.22.1 or newer.
- Generated `dta diff` workflows are unchanged: they use the project's `.nvmrc`, or `24`, which `actions/setup-node` resolves to the newest 24.

## Acceptance criteria

- [x] Every `engines.node` is `>=24.22.1`; no `24.14.1` left outside the changelog and tickets
- [x] Docs and README state the same floor
- [x] All gates pass
