# TICKET-050: Build: shared CSS variables and JS palette

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-049
**Status:** done
**Spec:** [build-package](../specs/build-package.md)

## What to build

Add the shared outputs: `output/css/variables.css` (with `outputReferences`) and `output/js/colorpalette.js`, from the same emit set as the base layer.

## Acceptance Criteria

- [x] `variables.css` and `colorpalette.js` are byte-identical to the legacy snapshots for brand-ab and daisyui
- [x] The returned JS path is the real one (`output/js/colorpalette.js`); the legacy summary mismatch is listed in 039 as a CLI follow-up
- [x] References between emitted tokens become `var(--…)` in `variables.css` and resolved values in the JS file, as in legacy
- [x] Tests through the public API with crafted models (alias chains, descriptions as comments, numbers with and without Figma scopes)
- [x] 039 parity table updated
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- Base layer, `variables.css` and the JS palette share one emit set, so they run in one Style Dictionary instance with three platforms (`css-base`, `css`, `js`). Legacy used separate runs over identical sources; the output is the same.
- The JS file is written to `output/js/colorpalette.js` (legacy hardcoded `output/js/` and printed `build/js/…` in its summary; that summary text is a CLI follow-up listed in 039). The directory is not configurable yet.
- Tests: byte-identical to the snapshots for brand-ab and daisyui; crafted model for `var()` references (CSS) versus resolved values (base.css and JS), descriptions as comments, and path order of the returned files.
