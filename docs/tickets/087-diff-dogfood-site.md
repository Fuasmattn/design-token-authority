# TICKET-087: Guard the DTA website with `dta diff`

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Medium
**Effort:** S
**Blocked by:** 086
**Status:** done (2026-10-24)
**Spec:** [visual-diff](../specs/visual-diff.md) (decision 12)

## What to build

Every pull request that touches the site, its tokens or components runs `dta diff` on the website's stories and shows the review in the PR, published with the Vercel recipe.

## Acceptance criteria

- [x] Site `diff` config in the repo with the Vercel publish hook (secret scoped to the publish step); workflow enabled for this repo
- [x] Verified on a real PR with a token change (#28) and one with a component change (#29)
- [x] All gates pass, and the GitHub run is green (#29; on #28 only the `test` job was red, because site tests pin the value of `blueprint.600`, as intended)

## Progress (dogfooding `dta init` on `site/`)

Done:

- `site/` runs `dta init` like any project: `design-token-authority` is a devDependency of the site (workspace link), and the `diff` section holds only what init would write plus `workflow: 'split'` (the repository is public). The hand-written `setup:` went: the base build installs by itself (TICKET-128).
- Running init on the site found four bugs, all fixed:
  - a static-site manifest showed as a page list;
  - a hand-written `diff` section got a suggested block that would have replaced it (init now names only the keys to add);
  - the report workflow always checked out, installed and read secrets, even with no publish hook (now one step without a hook);
  - the report folder was not ignored (init adds `.dta/diff/` to `.gitignore`).
- Local run, `dta diff --base HEAD` with two temporary edits (`blueprint.600` `#2f55d4 → #1e3fae`; padding in `Tabs.css`), 274 s with a fresh base install:
  - the floating-objects stories were explained by `blueprint.600`;
  - the Tabs stories were unexplained (correct);
  - the gravity-well stories were unexplained even though a token changed: its canvas reads the token once and draws pixels, so no element carries the colour. That is a limit of explaining by DOM elements, not a bug; it is a candidate for a follow-up (canvas stories explained by the tokens they read).

Left, needs the maintainer:

1. ~~**Merge the plan branch into main.**~~ Done (PR #21). On 2026-10-24 `cd site && pnpm exec dta init --diff --yes` wrote `.github/workflows/dta-diff.yml`, `dta-diff-report.yml` and `dta-diff-approve.yml` (split layout, pnpm, `.nvmrc`, install at the root, `working-directory: site`, no publish hook yet: the comment links the artifact). Gates green. Left: commit them to main **before** the first test pull request, because `workflow_run` and `pull_request_target` run from the default branch. Chromium could not be downloaded in the sandbox; CI installs it in the run workflow.
2. **Vercel values** (2026-10-24): `VERCEL_ORG_ID` = the team ID of "fuasmattn's projects"; `VERCEL_PROJECT_ID` = a new empty project for reports (not the website project, which keeps Deployment Protection); `VERCEL_TOKEN` created by the maintainer.
3. **Vercel setup** (with TICKET-086): a project for the reports, `VERCEL_TOKEN` as a repository secret, `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`; then add `publish: 'sh .github/dta-diff-publish.sh'` to the site's `diff` section, run `dta init` (it carries the hook into the report workflow), and add `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as env of the report step (the example `actions/examples/dta-diff-report.yml` shows it).
4. Two real pull requests (a token change, a component change) and a green run.

## Result (2026-10-24)

- Publish hook: `site/scripts/dta-diff-publish.sh` (the Vercel recipe; it runs in `site/`), `publish:` in `site/dta.config.ts`; the Vercel secrets are env of the report step only. A re-run of `dta init` keeps that hand edit ("edited by hand: not overwritten").
- #28 (`blueprint.600` `#2f55d4 → #1e3fae`): token table right (1 changed, 3 affected through aliases); `floating-objects` explained by `blueprint.600`; three `gravity-well` stories unexplained (canvas, see above), so the verdict was fail.
- #29 (tab padding `--space-4 → --space-6`): no token changes, the two Tabs stories unexplained, thumbnails in the comment.
- The label `dta-diff-approved` turned both statuses green.
- Follow-up: generated workflows pin actions that target Node 20 (TICKET-143).
