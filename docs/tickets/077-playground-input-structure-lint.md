# TICKET-077: Playground: input, structure and lint findings

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** High
**Effort:** M
**Blocked by:** 076
**Status:** open
**Spec:** [playground](../specs/playground.md) (decisions 2, 3, 4, 6, 7)

## What to build

On the site's Playground page a user drops or pastes token files or a plugin export (or loads the brand-ab example) and sees the detected structure (collections, modes, layer roles) and lint findings, with the same diagnostics the CLI gives. Nothing leaves the browser.

## Acceptance criteria

- [ ] Astro island loaded only on the playground page; Drafting Table components
- [ ] Multiple per-mode files or one plugin export (auto-detected); invalid input shows CLI-equivalent diagnostics
- [ ] No network requests after load (asserted in a test)
- [ ] All gates pass plus the site job, and the GitHub run is green
