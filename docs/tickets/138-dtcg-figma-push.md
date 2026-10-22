# TICKET-138: Figma push for the new types

**Phase:** 12 — DTCG 2025.10
**Priority:** Medium
**Effort:** M
**Blocked by:** 134
**Status:** done
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decision 11; slice 7)

## What to build

- `planPush` maps what Figma variables can hold: colour (any space converted to sRGB, warning when clipped), `number`, `dimension` in `px` as a number, `string`, `boolean`, `fontFamily` as a string where it is one family.
- Everything else (other units, `duration`, `cubicBezier`, composites) is skipped with one `not-pushable` warning per token, listed in the push report.
- `dta pull` keeps writing per-mode files.

## Acceptance criteria

- [x] Push planning tests against the Figma fake for each mapped and each skipped type
- [x] Push report scenario recorded by name
- [x] Figma guide documents what is pushed and what is skipped
- [x] All gates pass, and the GitHub run is green

## Notes

- **Pushed:** colours in any colour space (through `toSrgb`; one outside sRGB is clipped with a `clipped-to-srgb` warning naming the colour Figma gets), `dimension` in `px` (objects and `"8px"`) as FLOAT, a `fontFamily` with one font as STRING, a `$ref` to a token as an alias, a `$ref` into a value as that value.
- **Skipped** with a `not-pushable` warning that says why: `rem` dimensions, lists of font families, font weights, durations, cubic Béziers, the composite types. **An alias to a skipped token is skipped too** (found in a first pass, repeated until nothing changes), so Figma never gets an alias to a variable it does not have.
- **`dta push` now prints warnings** of the plan (before, only when there were errors); for `--format json` and `markdown` they go to stderr, so those outputs stay clean. No existing push snapshot changed.
- **Scenario `push-dry-run-dtcg`** on the `dtcg-2025` fixture against `test/recordings/dtcg-2025/variables-empty.json` (a Figma file without variables), recorded by name.
