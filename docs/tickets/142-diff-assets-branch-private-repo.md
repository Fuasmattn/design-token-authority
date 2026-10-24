# TICKET-142: Assets-branch thumbnails in private repositories

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Low
**Effort:** S
**Blocked by:** 086
**Status:** done (2026-10-24)
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 10–13)

## What to build

Split out of TICKET-086. The GitHub assets-branch recipe (`actions/recipes/github-assets-branch.sh`) is tested on a public repository and against a bare repository. Whether the thumbnails in the PR comment render for a **private** repository is not verified; the guide page says "not verified yet".

## Acceptance criteria

- [x] A private test repository with `dta diff` and the assets-branch hook; one pull request with a visual change
- [x] Result documented on the guide page "dta diff in pull requests": the thumbnails render, or what a private repository needs instead (for example the Vercel recipe or the artifact fallback)
- [x] "not verified yet" removed from the guide page
- [x] All gates pass

## Notes

- Needs the maintainer: a private repository under his account.
- If the images do not render (raw URLs of private repositories need a token), the guide should say so plainly and point to the Vercel or static-server recipe.

## Result (2026-10-24)

- Test repository `Fuasmattn/dta-diff-private-test` (private): a small token project, `dta init --diff` with the one-file workflow, the assets-branch hook (`contents: write`, `GITHUB_TOKEN`) and the cleanup workflow. PR #1 there (`color.blue.500` darker): the run passed, the hook created `dta-diff-assets` and pushed the report, the comment and status were posted, the change was explained by `color.blue.500`.
- **The thumbnails do not load** in the comment, also for the signed-in owner (checked by the maintainer). The images point to `github.com/<repo>/raw/dta-diff-assets/…`, which needs a sign-in in a private repository; GitHub fetches comment images without one.
- Guide: the note under the assets-branch recipe now says so and points private repositories to the Vercel or static-server recipe, or the artifact.
- Found on the way: init prepends `dta build` to a build script that already runs it (TICKET-145); DTA 2.0.4 from npm still writes the v4 action versions (fixed on main by TICKET-143, comes with the next release).
