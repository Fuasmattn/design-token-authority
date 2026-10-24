# TICKET-143: `dta init` workflows: action versions that run on Node 24

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** open
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md)

## What to build

Found while testing TICKET-087 (PRs #28, #29): GitHub warns that `actions/checkout@v4`, `actions/setup-node@v4` and `pnpm/action-setup@v4` target Node 20, which is deprecated, and forces them onto Node 24. `dta init --diff` writes exactly these versions into every user's workflows, so every new project starts with the warning. Move the generated workflows, the examples and the docs to the current major versions together, so they cannot drift.

## Acceptance criteria

- [ ] `packages/cli/src/init/diff-workflows.ts` writes current majors (the open Dependabot PRs #25–27 propose `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`; check the releases before choosing)
- [ ] One place for the versions in the generator, with a test that every generated workflow uses them
- [ ] `actions/examples/*.yml`, this repository's `.github/workflows/*` (re-run `dta init --diff` in `site/`, keep the hand-added Vercel env) and the docs (`guides/ci.mdx`, the guide page; `llms-full.txt` is generated) use the same versions
- [ ] Re-running `dta init --diff` on a project with old generated files updates them (unchanged hash) and keeps hand-edited ones
- [ ] Dependabot PRs #25–27 closed or merged as part of this
- [ ] A real pull request shows no Node 20 warning; all gates pass

## Notes

- `pnpm/action-setup` with `version:` (from `packageManager`) must keep working in the new major.
- Breaking changes between the majors (inputs, defaults such as `persist-credentials`) need a look before the bump.
