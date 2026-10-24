# TICKET-143: `dta init` workflows: action versions that run on Node 24

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** done (2026-10-24)
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md)

## What to build

Found while testing TICKET-087 (PRs #28, #29): GitHub warns that `actions/checkout@v4`, `actions/setup-node@v4` and `pnpm/action-setup@v4` target Node 20, which is deprecated, and forces them onto Node 24. `dta init --diff` writes exactly these versions into every user's workflows, so every new project starts with the warning. Move the generated workflows, the examples and the docs to the current major versions together, so they cannot drift.

## Acceptance criteria

- [x] `packages/cli/src/init/diff-workflows.ts` writes current majors (the open Dependabot PRs #25–27 propose `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`; check the releases before choosing)
- [x] One place for the versions in the generator, with a test that every generated workflow uses them
- [x] `actions/examples/*.yml`, this repository's `.github/workflows/*` (re-run `dta init --diff` in `site/`, keep the hand-added Vercel env) and the docs (`guides/ci.mdx`, the guide page; `llms-full.txt` is generated) use the same versions
- [x] Re-running `dta init --diff` on a project with old generated files updates them (unchanged hash) and keeps hand-edited ones
- [x] Dependabot PRs #25–27 closed or merged as part of this (closed by Dependabot after `51a60f0`)
- [x] A real pull request shows no Node 20 warning; all gates pass (PR #30)

## Notes

- `pnpm/action-setup` with `version:` (from `packageManager`) must keep working in the new major.
- Breaking changes between the majors (inputs, defaults such as `persist-credentials`) need a look before the bump.

## Done (2026-10-24)

- `ACTION_VERSIONS` in `packages/cli/src/init/diff-workflows.ts`: `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`, `actions/upload-artifact@v7`, `actions/download-artifact@v8` (all on Node 24); `oven-sh/setup-bun@v2` unchanged.
- Tests: every generated variant (4 package managers × 2 layouts × with/without hook) uses only these versions; the composite actions, this repository's workflows and the docs use the same versions (fails on drift); a workflow an older init wrote on v4 is updated by `dta init --diff`.
- Breaking changes checked: checkout v7 refuses fork PR code in `pull_request_target` / `workflow_run` (the report workflow checks out the default branch, the run workflow is `pull_request`: unaffected; GitHub also backported it to `@v4`). setup-node v5+ caches by itself when `packageManager` is set: bun gets `package-manager-cache: false`. download-artifact v5 extracts downloads by ID without the name folder: the report action downloads by name, unaffected. pnpm/action-setup v6 bootstraps pnpm with npm and still reads `packageManager` and `version`.
- Found on the way: the example report workflow passed only `VERCEL_TOKEN` to the Vercel hook; it now passes `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` too, as the site's workflow does (without them `vercel deploy` does not know the project).
- Guide: files init wrote follow a newer DTA; in hand-edited files the versions are bumped by hand. The site's `dta-diff-report.yml` (hand-edited for the Vercel env) was bumped by hand.
- CI on main after `51a60f0`: all jobs green, no Node 20 warning left (only GitHub's notice about `ubuntu-latest` moving to Ubuntu 26). Dependabot closed #25–27.
- PR #30 (Tabs padding, closed after the check): all jobs green, no Node 20 warning; the report workflow (download-artifact v8, Vercel) posted the comment with thumbnails; the approval label turned the status green.
