# TICKET-158: CI health: `dta diff report` fails now and then, Ubuntu 26 runners

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S
**Status:** open (needs the maintainer: the job logs need a GitHub login)
**Spec:** [maintenance](../specs/maintenance.md)

## Problem

1. The `dta diff report` workflow (`workflow_run`) failed twice on `main` on 2026-10-26 (runs 40266765510 and 40330043861) in the `diff-report` action step, with exit code 1. Runs for the same commit (`266ebcc`) passed minutes earlier. A report that fails at random teaches people to ignore the status check.
2. GitHub moves `ubuntu-latest` to Ubuntu 26 from 2026-10-19. The Chromium install (`playwright-core install --with-deps`) and the screenshots depend on the image.

## What to build

- Read the two failed logs (maintainer pastes them, or attaches them to this ticket) and find the cause: a race between two report runs for the same pull request, a missing artifact, a GitHub API error, the merged pull request being closed.
- Fix it in `actions/lib/dta-diff.mjs` or the action, with a test in `actions/lib/dta-diff.test.ts` that reproduces it against the in-memory GitHub.
- If a GitHub API call failed transiently: one retry with a clear log line, never a silent pass.
- Confirm one full CI run on the Ubuntu 26 image is green, including the `dta diff` end-to-end job, and that its screenshots match the Ubuntu 24 ones. If they differ, pin `runs-on: ubuntu-24.04` and open a follow-up.

## Acceptance criteria

- [ ] Cause named in the notes, with the log lines
- [ ] Fix plus a reproducing test; safety check of the spec green
- [ ] CI green on Ubuntu 26, or the runner pinned with a reason

## Notes
