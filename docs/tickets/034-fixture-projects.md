# TICKET-034: Fixture projects for parity testing

**Phase:** 8 — Token Engine Overhaul, Epic 1
**Priority:** High
**Effort:** S
**Blocked by:** None (can start immediately)
**Status:** done
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md)

## What to build

Two self-contained fixture projects that the legacy and the new pipeline can both run against: one with the repo's anonymized BrandA/BrandB token set (Primitives, Brand, ScreenType), one with the DaisyUI DTCG token file as a structurally different input.

## Acceptance Criteria

- [x] Each fixture project contains a config and token files in the current format (one file per collection and mode)
- [x] Legacy `dta build`, `dta lint` and `dta graph` run on both fixtures (lint on `daisyui` intentionally exits 2 with errors; see the fixtures README)
- [x] Fixtures contain only anonymized brand names (BrandA, BrandB) — no real customer names
- [x] A short README in the fixtures folder explains what each fixture covers
