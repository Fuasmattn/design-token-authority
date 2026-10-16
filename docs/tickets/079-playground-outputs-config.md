# TICKET-079: Playground: outputs, generated config and CLI handoff

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** High
**Effort:** M
**Blocked by:** 077
**Status:** open
**Spec:** [playground](../specs/playground.md) (decision 3)

## What to build

The playground previews and downloads the build outputs (CSS, Tailwind v4/v3, JS) and generates a `dta.config.ts` plus the `npx dta` commands to continue in a project.

## Acceptance criteria

- [ ] Outputs equal what `dta build` writes for the same input (test on the fixtures)
- [ ] The generated config is loaded by the real CLI config loader in a test
- [ ] Copy and download for each output and the config
- [ ] All gates pass plus the site job, and the GitHub run is green
