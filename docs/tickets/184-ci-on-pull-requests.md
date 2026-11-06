# TICKET-184: Run CI on pull requests, including forks

**Phase:** 14 — Launch
**Priority:** High
**Effort:** XS
**Status:** open (2026-11-05)
**Spec:** —

## Problem

`test.yml` runs only on `push`. A pull request from a fork pushes to the fork, not to this repository, so outside contributors' pull requests never run the CI gates (#67 showed only `dta diff`). The maintainer has to check out and run the gates by hand.

## What to build

- `test.yml` runs on `pull_request` (fork pull requests included), on `push` to `main`, and by hand (`workflow_dispatch`). Branch pushes without a pull request no longer run CI; a branch with an open pull request runs once instead of twice.
- `permissions: contents: read`, and a concurrency group per pull request that cancels superseded runs.
- No secrets: none of the jobs uses one, so fork runs behave like the maintainer's.
- Contribute docs: one sentence that pull requests run the same gates, and that a first-time contributor's run waits for the maintainer's approval.

## Acceptance criteria

- [ ] A pull request from a branch runs CI once; a pull request from a fork runs it after approval
- [ ] A push to `main` runs CI
- [ ] The required status checks in the branch protection (if any) still match the job names
- [ ] Contribute docs updated; gates green

## Notes

- Found while reviewing #67, the first outside contribution.
- First-time contributors' workflow runs wait for approval in the Actions tab (repository setting "Require approval for first-time contributors"). Keep it on.
