# TICKET-177: `glob` and `minimatch` advisories

**Phase:** 13 — Maintenance
**Priority:** High
**Effort:** XS
**Status:** review (2026-10-30, #55)
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

`pnpm audit` fails on main since two advisories were published after its last green run (found on #55):

- GHSA-3g3m-2fjr-6pw4 (moderate): `glob` 9.0.0–14.0.1, AbortSignal cancellation does not stop a traversal after a timeout.
- GHSA-g3hv-75wg-m249 (moderate): `minimatch` <11.0.1, denial of service through globparts amplification.

Both through `style-dictionary` 5.7.1 → `@bundled-es-modules/glob` 13.0.6 → `glob` 13.0.6 → `minimatch` 10. `style-dictionary` is shipped, so users get the advisory too until it moves on.

## What to build

- Override only that path in `pnpm-workspace.yaml`: `'@bundled-es-modules/glob>glob': ^14.0.2`. glob 14 depends on minimatch 11, which clears the second advisory. No global `minimatch` override: other packages need minimatch 3–10 and their APIs.

## Acceptance criteria

- [x] `pnpm audit` passes
- [x] `@bundled-es-modules/glob` re-exports `glob/raw`, which glob 14 still has; `globSync` works through it
- [x] Gates, snapshot check and site build green
- [ ] Drop the override once `style-dictionary` depends on a fixed glob
