# TICKET-050: Build: shared CSS variables and JS palette

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** S
**Blocked by:** TICKET-049
**Status:** ready-for-agent
**Spec:** [build-package](../specs/build-package.md)

## What to build

Add the shared outputs: `output/css/variables.css` (with `outputReferences`) and `output/js/colorpalette.js`, from the same emit set as the base layer.

## Acceptance Criteria

- [ ] `variables.css` and `colorpalette.js` are byte-identical to the legacy snapshots for brand-ab and daisyui
- [ ] The returned JS path is the real one (`output/js/colorpalette.js`); the legacy summary mismatch is listed in 039 as a CLI follow-up
- [ ] References between emitted tokens become `var(--…)` in `variables.css` and resolved values in the JS file, as in legacy
- [ ] Tests through the public API with crafted models (alias chains, descriptions as comments, numbers with and without Figma scopes)
- [ ] 039 parity table updated
- [ ] All gates pass, and the GitHub run is green
