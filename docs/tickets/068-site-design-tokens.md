# TICKET-068: DTA Drafting Table as DTA token files, built with `dta build`

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** M
**Blocked by:** 039
**Status:** done
**Spec:** [docs-site](../specs/docs-site.md) (decisions 4, 5)

## What to build

The design system's tokens live in the repo as DTCG token files in DTA's model (primitives; a semantic layer with modes `Light` and `Graphite`), pass `dta lint`, and `dta build` turns them into CSS custom properties and a theme file per mode. This is DTA's first real token set besides the fixtures.

## Acceptance criteria

- [x] Primitive scales (`paper`, `ink`, `graphite`, `blueprint`, `redline`, `sage`), spacing, radius, stroke and type values copied exactly from the DTA Drafting Table design system
- [x] Semantic tokens (`bg-*`, `fg-*`, `border-*`, `action-*`, `signal-*`, `success-*`, `rail`, `terminal-*`) as aliases per mode, matching the system's light and Graphite values
- [x] `dta.config.ts` for the site tokens; `dta lint` passes; `dta build` writes per-mode CSS used by the site
- [x] A test pins the contrast pairs the design system README requires (text on `signal-bg` uses `signal-fg`, body text pairs ≥ 4.5:1 in both modes)
- [x] The limitation "theme modes use DTA's brand layer until user-defined structure lands" is written down in the ticket and the spec
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `site/` is a private workspace member (`dta-site`) so its tests run in the `site` Vitest project; Astro arrives with 069. The boundary guardrail now also checks `site/` (no relative imports into `packages/`).
- Collections: `Primitives` (mode `Value`) and `Theme` (modes `Light`, `Graphite`). Semantic names keep the design system's names as paths (`bg-canvas` → `bg.canvas` → `--bg-canvas`).
- Figma scopes decide units: `GAP`, `CORNER_RADIUS`, `STROKE_FLOAT` get `px`; font sizes stay unitless (DTA's current behaviour), noted in `site/README.md`.
- Contrast: all twelve text pairs from the design system README pass 4.5:1 in both themes; a test also pins that white on `signal.bg` fails, which is why redline labels use `signal.fg`.
- `@dta/lint`'s `color-contrast` rule skips aliased tokens (v1 quirk), so the site checks contrast in its own test through `resolve` + `contrastRatio`.
