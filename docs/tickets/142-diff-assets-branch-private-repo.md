# TICKET-142: Assets-branch thumbnails in private repositories

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Low
**Effort:** S
**Blocked by:** 086
**Status:** open (needs a private test repository from the maintainer)
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 10–13)

## What to build

Split out of TICKET-086. The GitHub assets-branch recipe (`actions/recipes/github-assets-branch.sh`) is tested on a public repository and against a bare repository. Whether the thumbnails in the PR comment render for a **private** repository is not verified; the guide page says "not verified yet".

## Acceptance criteria

- [ ] A private test repository with `dta diff` and the assets-branch hook; one pull request with a visual change
- [ ] Result documented on the guide page "dta diff in pull requests": the thumbnails render, or what a private repository needs instead (for example the Vercel recipe or the artifact fallback)
- [ ] "not verified yet" removed from the guide page
- [ ] All gates pass

## Notes

- Needs the maintainer: a private repository under his account.
- If the images do not render (raw URLs of private repositories need a token), the guide should say so plainly and point to the Vercel or static-server recipe.
