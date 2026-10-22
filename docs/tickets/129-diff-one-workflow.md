# TICKET-129: One workflow file for private and team repositories

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** High
**Effort:** M
**Blocked by:** 090 (version tag for the action refs)
**Status:** open
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md) (decision 6)

## What to build

Today a project copies three workflows (`actions/examples/dta-diff.yml`, `dta-diff-report.yml`, `dta-diff-approve.yml`). The split keeps pull requests from forks away from write permissions, which a repository without outside contributors does not need.

- A composite action (or a mode of `actions/diff`) that runs, comments and sets the status in one job on `pull_request`, with `pull-requests: write` and `statuses: write`.
- Approval in the same file: the workflow also listens for the `labeled` event on the approval label.
- The three-file setup stays, documented as the setup for public repositories.
- Action refs are pinned to a release tag instead of `@main`.
- The workflow is generated from one template with npm, pnpm, yarn and bun variants and the detected Node version (used by TICKET-131), not hand-edited copies.
- The approve action creates the `dta-diff-approved` label if it is missing.

## Acceptance criteria

- [ ] Example workflow for the one-file setup; the template renders npm and pnpm variants (tested)
- [ ] A run on a test repository: comment, status and approval from one file
- [ ] The guide explains in one paragraph when to use one file and when three
- [ ] All gates pass, and the GitHub run is green
