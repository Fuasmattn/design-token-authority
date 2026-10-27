# TICKET-156: Patch and minor dependency updates

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S
**Status:** done (2026-10-26, #33)
**Spec:** [maintenance](../specs/maintenance.md)

## What to build

Update in one go, with pnpm, nothing else changed:

- site: `astro` 7.3 → 7.4, `@astrojs/preact` 6.0 → 6.1, `@astrojs/starlight` 0.42.5 → 0.42.7, `@astrojs/check` 0.9.10 → 0.9.12, `starlight-links-validator` 0.26 → 0.27
- root: `rollup` 4.65.0 → 4.65.1, `rollup-plugin-dts` 6.2 → 6.5, `yaml` 2.8 → 2.9

Not in this ticket: `playwright-core` (TICKET-159) and `@figma/rest-api-spec` (TICKET-160), which can change output; all majors (160–167).

## Acceptance criteria

- [x] Only the listed packages and the lockfile change (minus `astro`, held back)
- [x] Safety check of the spec green; no snapshot re-recorded
- [ ] Vercel preview of the site unchanged at 1280 and 390 px (`starlight-links-validator` 0.27 may report new broken links: fix the links, not the check)
- [x] `package:build` output types unchanged (compare `dist/*.d.ts` before and after)

## Notes

`starlight-links-validator` is 0.x, so 0.26 → 0.27 may carry breaking changes; read its changelog first. Outcome: the site build with its link check passed unchanged.

**`astro` 7.3.5 → 7.4.2 held back.** With 7.4 the playground's lazy tabs fetch their island's stylesheet a second time when the tab opens (`graph-engine.css`, `outputs-ui.css`, `shared.css`, about 5 KB gzip together). The same rules are already linked in the page's `<head>` (`GraphSwitcher.css` is byte-identical to the new `graph-engine.css`), so the page looks the same and the first load is the same, but a tab opening now costs an extra request. The playground budget test (`playground.e2e.test.ts`, TICKET-124) caught it: "only `.js` lazy chunks" and the Graph tab budget (12.5 KB with the CSS, 9.3 KB without) failed. Isolated by downgrading only `astro`: 7.3.5 with every other update passes all 34 playground tests. Decision (spec, decision 2 and 3): hold `astro` at 7.3.5 rather than loosen the test. Re-check on the next Astro bump: if the duplicate fetch is gone, update; if it stays, decide whether a 5 KB fetch on tab open is acceptable and then adapt the test to measure JS and CSS apart.

**`dta diff` on the pull request reports 2 changed stories, both `workflow--default`, about 200 px each.** Not this change: rendering one and the same commit twice (`dta diff --base HEAD`) shows the same two stories changed and nothing else. The Workflow section places its dust motes with `Math.random()`, so the finished picture differs on every render. TICKET-168 makes it deterministic. Until then the check needs the `dta-diff-approved` label on every pull request.

Node.js: the check ran on 24.22.1 (`.nvmrc`); Chromium through `DTA_BROWSER_PATH` where `playwright-core install` cannot download.
