# TICKET-086: Publish hook and `dta diff` in pull requests

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** M
**Blocked by:** 085
**Status:** done (2026-10-24; private-repo rendering split into TICKET-142)
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 10–13)

## What to build

Projects publish the report wherever they want through a hook, and pull requests show the result in place: a status check (pass / changes to review / fail by threshold) and one comment that updates on every push, with the explained-by-token summary, baseline / candidate / diff thumbnails per story and viewport, and a link to the full report. DTA ships no provider code; the docs ship recipes.

## Acceptance criteria

- [x] `diff.publish` config and `--publish <command>`: runs on the report folder (path as argument and `DTA_REPORT_DIR`), reads the base URL from the last stdout line or `diff.publish.url`; `summary.md` and `result.json` get absolute links; a failing hook is reported and exits non-zero without hiding the diff result
- [x] Without a hook: `summary.md` without images, report uploaded as a workflow artifact, comment says where to find it
- [x] Composite action that only wraps `npx dta diff` plus status check and sticky comment (marked with an HTML comment, created or updated); minimal permissions; fork PRs handled with the two-workflow pattern (no secrets in untrusted runs)
- [x] Approval label scoped to the head SHA; a new push needs a new review
- [x] Recipes on the website, each tested once: Vercel preview of the report folder, GitHub assets branch (with cleanup on PR close), generic static server (private-repo rendering of the assets branch: TICKET-142)
- [x] Guide page "dta diff in pull requests" on the website
- [x] All gates pass, and the GitHub run is green (PR #29: all jobs green)

## Notes

- CLI: `diff.publish` (`'command'` or `{ command, url }` with a `$.json.path` or regex), `--publish <command>`, `--from-report` (publish an earlier report folder without rendering, used by the report workflow). The hook gets the folder as last argument and `DTA_REPORT_DIR`; the URL is the last stdout line by default. `result.json` gets `publish: { url, report }`, `summary.md` the report link and baseline / candidate / diff thumbnails per story and viewport. A failing hook prints the error, still writes and prints the diff result, and exits 1. Tests: `packages/cli/test/diff-publish.test.ts`, `extractPublishUrl` in `@dta/visual-diff`.
- `summary.md` is now rendered from `result.json` (`renderSummaryMarkdown(result, { baseUrl })`), so `--from-report` can rewrite it.
- `actions/`: composite actions `diff` (run + artifact, read-only, fork-safe), `diff-report` (`workflow_run`: optional publish, status check "dta diff", sticky comment), `diff-approve` (`pull_request_target` labeled/unlabeled, checks out nothing); shared plain-Node script `actions/lib/dta-diff.mjs` (no dependencies). Example workflows in `actions/examples/`. The PR number from the artifact is only a hint and is checked against the head SHA from the trusted `workflow_run` event (fork PRs: found by head owner and branch).
- Status: pass → success, review → pending ("Changes to review: add the dta-diff-approved label"), fail → failure; an approval of the head SHA → success "Approved by @user". The comment carries a hidden state line (SHA, verdict, approval). A run for a new SHA removes a stale label: a new push needs a new review. Tests with an in-memory GitHub: `actions/lib/dta-diff.test.ts` (also checks the permissions of the example workflows); the script entry point was smoke-tested against a local fake API.
- Recipes in `actions/recipes/`, shown on the website with `?raw` imports so the page and the tested files cannot drift: `static-server.sh` and `github-assets-branch.sh` (+ cleanup) tested once in `actions/recipes/recipes.test.ts` (served folder, bare repository); the static recipe also end to end with `dta diff --from-report` on the website's report, served over HTTP, all 78 images loading. `vercel.sh` uses `vercel@62.1.0`.
- Guide page: `site/src/content/docs/guides/dta-diff-in-pull-requests.mdx` (checked at 1280 and 390 px).
- Other hosts (maintainer decision: no untested provider recipes): a general template `actions/recipes/template.sh` (run as is in the recipe tests) and a section "Any other host" on the guide page: what the host must do, `diff.publish.url` for URLs that are not on the last line, trying a hook with `dta diff --from-report --publish`.
- Security: the example report workflow publishes only reports of branches in the repository (a fork's `index.html` is untrusted HTML); forks fall back to the artifact.

### Still open (need the maintainer)

- [x] Vercel recipe tested once (2026-10-24): project `dta-diff-reports` (Deployment Protection off), a project-scoped `VERCEL_TOKEN`, `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` as secrets; the reports of PRs #28 and #29 deployed, the thumbnails load in the comment.
- Private-repo rendering of assets-branch thumbnails: split out into TICKET-142 (needs a private test repository).
- [x] The actions on a real pull request of this repository (PRs #28, #29, closed after the check): status check, sticky comment, report link and the approval label ("Approved by @Fuasmattn") all work. the plan branch is merged (PR #21) and `dta init --diff` wrote the three workflow files in `site/` (2026-10-24, see TICKET-087). They must be on main before the test pull request, since the report and approval workflows run from the default branch.
