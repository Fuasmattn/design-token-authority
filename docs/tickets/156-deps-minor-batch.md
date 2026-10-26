# TICKET-156: Patch and minor dependency updates

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S
**Status:** open
**Spec:** [maintenance](../specs/maintenance.md)

## What to build

Update in one go, with pnpm, nothing else changed:

- site: `astro` 7.3 → 7.4, `@astrojs/preact` 6.0 → 6.1, `@astrojs/starlight` 0.42.5 → 0.42.7, `@astrojs/check` 0.9.10 → 0.9.12, `starlight-links-validator` 0.26 → 0.27
- root: `rollup` 4.65.0 → 4.65.1, `rollup-plugin-dts` 6.2 → 6.5, `yaml` 2.8 → 2.9

Not in this ticket: `playwright-core` (TICKET-159) and `@figma/rest-api-spec` (TICKET-160), which can change output; all majors (160–167).

## Acceptance criteria

- [ ] Only the listed packages and the lockfile change
- [ ] Safety check of the spec green; no snapshot re-recorded
- [ ] Vercel preview of the site unchanged at 1280 and 390 px (`starlight-links-validator` 0.27 may report new broken links: fix the links, not the check)
- [ ] `package:build` output types unchanged (compare `dist/*.d.ts` before and after)

## Notes

`starlight-links-validator` is 0.x, so 0.26 → 0.27 may carry breaking changes; read its changelog first.
