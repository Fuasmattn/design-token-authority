# TICKET-048: Core: structure analysis on the token model

**Phase:** 8 — Token Engine Overhaul, Epic 3 (planned with @dta/figma, implemented in @dta/core)
**Priority:** Medium
**Effort:** S
**Blocked by:** TICKET-040
**Status:** ready-for-agent
**Spec:** [figma-package](../specs/figma-package.md) (decision 12)

## What to build

`analyzeStructure(model)` in `@dta/core`: infer the layer roles (primitives, brand, dimension, semantic, unknown), collections and modes from a token model. It replaces both legacy analyses: `analyze.ts` (from the Figma response) and `importers/analyze-tokens.ts` (from token files). Because it works on the model, it serves Figma API data, plugin imports and plain token files alike.

## Acceptance Criteria

- [ ] Roles, collections, modes and counts for the BrandA/BrandB fixture equal what legacy `dta analyze` infers for the same data (cross-checked against legacy output; any difference is listed here)
- [ ] The DaisyUI fixture is analysed without error; ambiguous or unknown setups return `unknown` roles instead of throwing
- [ ] Legacy `analyze.test.ts` and `analyze-tokens.test.ts` cases are re-expressed through the public API
- [ ] Output is plain JSON data; the text report stays for the CLI epic
- [ ] 039 parity table: `analyze` row points to core
- [ ] All gates pass, and the GitHub run is green
