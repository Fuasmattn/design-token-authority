# TICKET-079: Playground: outputs, generated config and CLI handoff

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** High
**Effort:** M
**Blocked by:** 077, 115 (the outputs go into the Outputs tab and its detail panel)
**Status:** open
**Spec:** [playground](../specs/playground.md) (decisions 3, 9)

Revised 2026-10-19 (maintainer): one-time use matters, so this ticket comes before 078 and adds "download all" and the output options.

## What to build

The playground previews and downloads the build outputs (CSS, Tailwind v4/v3, JS) and generates a `dta.config.ts` plus the `npx dta` commands to continue in a project.

## Acceptance criteria

- [ ] Outputs equal what `dta build` writes for the same input (test on the fixtures)
- [ ] The generated config is loaded by the real CLI config loader in a test
- [ ] Copy and download for every single file (e.g. only `css/themes/branda.css`) and the config, plus one download per output group (CSS, Tailwind, JS) for someone who only needs one kind (maintainer, 2026-10-19)
- [ ] "Download all" as one zip with the same folder layout `dta build` writes (plus the generated `dta.config.ts`); the zip library (e.g. fflate) loads with the outputs, not with the page
- [ ] Output options a one-time user needs: which outputs (CSS, Tailwind v4, Tailwind v3, JS) and the CSS variable prefix if the config schema has one; the generated config carries the same choices, so the CLI gives the same files
- [ ] `@dta/build` and the zip code load lazily (spec decision 9); the page's first-load JS budget from 077 still holds
- [ ] All gates pass plus the site job, and the GitHub run is green
