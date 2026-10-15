# TICKET-048: Core: structure analysis on the token model

**Phase:** 8 — Token Engine Overhaul, Epic 3 (planned with @dta/figma, implemented in @dta/core)
**Priority:** Medium
**Effort:** S
**Blocked by:** TICKET-040
**Status:** done
**Spec:** [figma-package](../specs/figma-package.md) (decision 12)

## What to build

`analyzeStructure(model)` in `@dta/core`: infer the layer roles (primitives, brand, dimension, semantic, unknown), collections and modes from a token model. It replaces both legacy analyses: `analyze.ts` (from the Figma response) and `importers/analyze-tokens.ts` (from token files). Because it works on the model, it serves Figma API data, plugin imports and plain token files alike.

## Acceptance Criteria

- [x] Roles, collections, modes and counts for the BrandA/BrandB fixture equal what legacy `dta analyze` infers for the same data (cross-checked against legacy output; any difference is listed here)
- [x] The DaisyUI fixture is analysed without error; ambiguous or unknown setups return `unknown` roles instead of throwing
- [x] Legacy `analyze.test.ts` and `analyze-tokens.test.ts` cases are re-expressed through the public API
- [x] Output is plain JSON data; the text report stays for the CLI epic
- [x] 039 parity table: `analyze` row points to core
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `packages/core/src/structure.ts`; public API `analyzeStructure(model)` → `{ collections, suggestedCollections, suggestedLayers, suggestedBrands }` plus types `LayerRole`, `CollectionStructure`, `StructureAnalysis`. Plain JSON data; `formatAnalysisReport` (the text table) is left for the CLI epic.
- Heuristics are the legacy ones, unchanged: dimension (all mode names responsive), primitives (one mode, alias ratio < 0.1), brand (several modes, ratio > 0.7), semantic (one mode, ratio > 0.7), otherwise `unknown` with confidence 0.4 or 0.3 and a note. `variableCount` is the number of distinct tokens; `aliasRatio` is alias values over all (token, mode) values.
- Cross-check against legacy (run once with the frozen `src/` code on the same data; results are asserted in `structure.test.ts`):
  - BrandA/BrandB against the recording (legacy `analyzeCollections`): roles, confidences, mode counts, variable counts (26, 11, 5), alias ratios (0, 1, 1), suggested layers and brands are identical.
  - BrandA/BrandB and DaisyUI token files (legacy `analyzeTokenFiles`): roles, confidences, alias ratios and suggested layers are identical on both fixtures.
- Differences, all intended:
  1. Legacy `analyzeTokenFiles` counted `variableCount` per mode file (e.g. Brand(Alias) 22 for 11 variables). The model counts distinct tokens, which is what the Figma-based legacy analysis reported.
  2. Collections and modes follow the model's order (sorted by name), not Figma's, so `suggestedBrands` is alphabetical and ties between equally confident collections resolve alphabetically.
  3. Legacy's `collectionId`, the deprecated-field comment and remote-collection handling are gone: the model has no ids, and remote collections never reach it.
- Legacy `analyze.test.ts` and `analyze-tokens.test.ts` cases are re-expressed in `structure.test.ts` (primitives, brand, dimension incl. t-shirt sizes, semantic, small collection, full 3-layer system, empty input); the two report-format tests move with the text report to the CLI epic.
- 039 parity table: `analyze.ts` and `importers/analyze-tokens.ts` now point at `@dta/core`; the legacy files are deleted with the `analyze` command.
