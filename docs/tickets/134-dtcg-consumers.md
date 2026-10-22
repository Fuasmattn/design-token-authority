# TICKET-134: Build, lint, diff, queries and audit on the new types

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** L (split by package if needed)
**Blocked by:** 133
**Status:** open
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decisions 9, 10; slice 3)

## What to build

- **Build:** structured values reach Style Dictionary so the DTCG transforms already listed in `CSS_BASE_TRANSFORMS` apply; composites become CSS shorthands (`box-shadow`, `font`, `transition`, `border`, gradients); dimensions keep their unit; sRGB colours stay hex, other colour spaces use the matching CSS function (`oklch()`, `color(display-p3 …)`); Tailwind v3 and v4 keys for the new types; JS output with the values as written.
- **Lint:** `color-contrast` converts any colour space to sRGB (gamut-mapped) and says when it clipped; `no-duplicate-values` uses `sameValue`.
- **`dta diff`:** token change set compares with `sameValue` and prints with `formatValue`.
- **Token queries and `dta audit`:** dimensions with units (rem × 16 only where a unit says rem), `--type` lists all types, `token find` matches structured values.

## Acceptance criteria

- [ ] A fixture `test/fixtures/dtcg-2025` with one file per feature, mostly from the report's examples; its CLI scenarios recorded by name
- [ ] CSS for every composite checked in a browser test (the shorthand renders)
- [ ] Contrast test with an `oklch` pair, clipped and not clipped
- [ ] Existing snapshots unchanged
- [ ] Learn page "Where DTA differs" and the Outputs reference updated
- [ ] All gates pass, and the GitHub run is green
