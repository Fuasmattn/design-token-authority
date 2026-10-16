# TICKET-068: DTA Drafting Table as DTA token files, built with `dta build`

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** M
**Blocked by:** 039
**Status:** open
**Spec:** [docs-site](../specs/docs-site.md) (decisions 4, 5)

## What to build

The design system's tokens live in the repo as DTCG token files in DTA's model (primitives; a semantic layer with modes `Light` and `Graphite`), pass `dta lint`, and `dta build` turns them into CSS custom properties and a theme file per mode. This is DTA's first real token set besides the fixtures.

## Acceptance criteria

- [ ] Primitive scales (`paper`, `ink`, `graphite`, `blueprint`, `redline`, `sage`), spacing, radius, stroke and type values copied exactly from the DTA Drafting Table design system
- [ ] Semantic tokens (`bg-*`, `fg-*`, `border-*`, `action-*`, `signal-*`, `success-*`, `rail`, `terminal-*`) as aliases per mode, matching the system's light and Graphite values
- [ ] `dta.config.ts` for the site tokens; `dta lint` passes; `dta build` writes per-mode CSS used by the site
- [ ] A test pins the contrast pairs the design system README requires (text on `signal-bg` uses `signal-fg`, body text pairs ≥ 4.5:1 in both modes)
- [ ] The limitation "theme modes use DTA's brand layer until user-defined structure lands" is written down in the ticket and the spec
- [ ] All gates pass, and the GitHub run is green
