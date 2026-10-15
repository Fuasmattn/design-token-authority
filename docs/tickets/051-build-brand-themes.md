# TICKET-051: Build: per-brand CSS themes

**Phase:** 8 — Token Engine Overhaul, Epic 4 (@dta/build)
**Priority:** High
**Effort:** M
**Blocked by:** TICKET-049
**Status:** ready-for-agent
**Spec:** [build-package](../specs/build-package.md)

## What to build

Per-brand output for multi-mode collections: `output/css/themes/<brand>.css` with `[data-brand="<slug>"]` and references to the base layer. The emit set for a brand is that brand's mode of every multi-mode collection; single-mode collections are reference context.

## Acceptance Criteria

- [ ] `themes/branda.css` and `themes/brandb.css` are byte-identical to the brand-ab snapshots; daisyui (no brands) produces no theme files
- [ ] Brand slug is the lower-cased brand name; brands come from `options.brands`
- [ ] A brand that is not a mode of any multi-mode collection yields a warning diagnostic and no files; an empty `brands` list yields no theme files
- [ ] Tokens that exist in only some brands do not throw; missing aliases are warning diagnostics
- [ ] Self-referencing aliases (Brand token shadowing a Primitive of the same path) are handled without circular-reference errors
- [ ] 039 parity table updated
- [ ] All gates pass, and the GitHub run is green
