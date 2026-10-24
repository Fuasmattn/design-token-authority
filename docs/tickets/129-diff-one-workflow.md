# TICKET-129: One workflow file for private and team repositories

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** High
**Effort:** M
**Blocked by:** 090 (version tag for the action refs)
**Status:** in review
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

## Notes

- `actions/diff-pr`: one job runs `dta diff`, uploads the report artifact, runs the publish hook (optional `publish` input) and reports (status and sticky comment) from the local report folder. `actions/lib/run-diff.sh` is shared with `actions/diff`.
- The one-file workflow listens to `pull_request` (`opened`, `synchronize`, `reopened`, `labeled`, `unlabeled`): the `diff` job skips label events (and cancels a run superseded by a push), the `approve` job runs `diff-approve` for the approval label.
- The report creates the `dta-diff-approved` label on the first run that needs a review (best effort; a token that may not create labels only warns).
- One template: `renderDiffWorkflows` in `packages/cli/src/init/diff-workflows.ts` (npm, pnpm, yarn, bun; Node version file or version; a subfolder project). `actions/examples` is generated from it (`pnpm workflows:generate`, npm and Node 24); a test fails when they differ.
- **Open:** the action refs are `@main` (`ACTION_REF`) until there is a release tag (TICKET-090). The run on a test repository (comment, status and approval from one file) needs a GitHub repository to try it on; not done yet.
- **Review (fixed):** the install runs where the lockfile is (the repository root of a workspace) and `cache-dependency-path` names that lockfile; `node-version-file` is the path from the repository root; `pnpm/action-setup` gets `version: 10` when package.json has no `packageManager` field (it fails without one); `run-diff.sh` takes an absolute report folder.
