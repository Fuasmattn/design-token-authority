# TICKET-087: Guard the DTA website with `dta diff`

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Medium
**Effort:** S
**Blocked by:** 086
**Status:** in progress (blocked on the merge to main and Vercel secrets)
**Spec:** [visual-diff](../specs/visual-diff.md) (decision 12)

## What to build

Every pull request that touches the site, its tokens or components runs `dta diff` on the website's stories and shows the review in the PR, published with the Vercel recipe.

## Acceptance criteria

- [ ] Site `diff` config in the repo with the Vercel publish hook (secret scoped to the publish step); workflow enabled for this repo
- [ ] Verified on a real PR with a token change and one with a component change
- [ ] All gates pass, and the GitHub run is green

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

1. **Merge the plan branch into main.** `workflow_run` (report) and `pull_request_target`/label (approve) workflows run from the default branch, and the generated workflows use `actions/*@main`; main is still v1 without `actions/` or `site/`. The three workflow files are therefore not in the repository yet: after the merge, `cd site && pnpm exec dta init` writes them (split layout, pnpm, `.nvmrc`, install at the root, `working-directory: site`).
2. **Vercel** (with TICKET-086): a project for the reports, `VERCEL_TOKEN` as a repository secret, `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`; then add `publish: 'sh .github/dta-diff-publish.sh'` to the site's `diff` section, run `dta init` (it carries the hook into the report workflow), and add `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as env of the report step (the example `actions/examples/dta-diff-report.yml` shows it).
3. Two real pull requests (a token change, a component change) and a green run.
