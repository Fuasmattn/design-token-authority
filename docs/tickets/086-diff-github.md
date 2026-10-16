# TICKET-086: Publish hook and `dta diff` in pull requests

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** M
**Blocked by:** 085
**Status:** open
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 10–13)

## What to build

Projects publish the report wherever they want through a hook, and pull requests show the result in place: a status check (pass / changes to review / fail by threshold) and one comment that updates on every push, with the explained-by-token summary, baseline / candidate / diff thumbnails per story and viewport, and a link to the full report. DTA ships no provider code; the docs ship recipes.

## Acceptance criteria

- [ ] `diff.publish` config and `--publish <command>`: runs on the report folder (path as argument and `DTA_REPORT_DIR`), reads the base URL from the last stdout line or `diff.publish.url`; `summary.md` and `result.json` get absolute links; a failing hook is reported and exits non-zero without hiding the diff result
- [ ] Without a hook: `summary.md` without images, report uploaded as a workflow artifact, comment says where to find it
- [ ] Composite action that only wraps `npx dta diff` plus status check and sticky comment (marked with an HTML comment, created or updated); minimal permissions; fork PRs handled with the two-workflow pattern (no secrets in untrusted runs)
- [ ] Approval label scoped to the head SHA; a new push needs a new review
- [ ] Recipes on the website, each tested once: Vercel preview of the report folder, GitHub assets branch (with cleanup on PR close; private-repo rendering verified and documented), generic static server
- [ ] Guide page "dta diff in pull requests" on the website
- [ ] All gates pass, and the GitHub run is green
