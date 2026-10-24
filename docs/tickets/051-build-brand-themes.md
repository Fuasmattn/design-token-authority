# TICKET-051: Build: per-brand CSS themes

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-049
**Status:** done
**Spec:** [build-package](../specs/build-package.md)

## What to build

Per-brand output for multi-mode collections: `output/css/themes/<brand>.css` with `[data-brand="<slug>"]` and references to the base layer. The emit set for a brand is that brand's mode of every multi-mode collection; single-mode collections are reference context.

## Acceptance Criteria

- [x] `themes/branda.css` and `themes/brandb.css` are byte-identical to the brand-ab snapshots; daisyui (no brands) produces no theme files
- [x] Brand slug is the lower-cased brand name; brands come from `options.brands`
- [x] A brand that is not a mode of any multi-mode collection yields a warning diagnostic and no files; an empty `brands` list yields no theme files
- [x] Tokens that exist in only some brands do not throw; missing aliases are warning diagnostics
- [x] Self-referencing aliases (Brand token shadowing a Primitive of the same path) are handled without circular-reference errors
- [x] 039 parity table updated
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- One Style Dictionary run per brand. Sources: every single-mode collection (reference context) followed by the brand's mode of each multi-mode collection that has that mode (emitted). Other multi-mode collections are not in the tree for this run, as in legacy, so an alias into a collection that lacks the brand is reported as `broken-reference`.
- `unknown-brand` warning when a brand is a mode of no multi-mode collection. Duplicate warnings across brands and runs are merged (same code and message).
- Style Dictionary writes no file when nothing is left to emit; the self-referencing case (brand token aliasing its own path, which is stripped together with the primitive it shadows) shows this for that brand.
- Tailwind per-brand files come with TICKETs 052/053, in the same per-brand run.
