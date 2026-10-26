# TICKET-168: Landing: drop the four scenes, add a short commands grid

**Phase:** 10 — Landing redesign
**Priority:** Medium
**Effort:** S
**Status:** done (2026-10-26)
**Spec:** [landing-redesign](../specs/landing-redesign.md) (revision note 2026-10-26)

## Problem

The example section (one change in four scenes with the Orbit Burger example) is ~400 words plus four embedded demos, and it tells the same story the workflow strip above it now tells (TICKET-155). A visitor who wants that level of detail expects it in the docs, not on the landing page; a visitor who does not, scrolls past it. Maintainer decision (2026-10-26): the landing page is plain — hero, the strip, the commands, the facts, the final call.

With the scenes gone, the page would show no `dta` command at all (the strip carries none by design). A short grid of the commands, one line each, keeps them on the page without the story.

## What to build

- **`Commands`** design-system component: a grid of command chips (`CommandButton`), one muted line under each, no heading per cell, no rules, no boxes (the rules were tried and removed on review). Docs page and story first (CLAUDE.md rule).
- **Page:** hero → `Workflow` → `Commands` → `Facts` → final call. The `story` block, the Orbit Burger stylesheet import and the `#agents` anchor leave the page; the "Agents" nav item points to the coding-agents guide.
- **Content:** `EXAMPLE`, `SCENES`, `TOKEN_ROWS`, `DIFF_SHARES`, `CHECKS`, `DECISION`, `APPROVE`, `AGENT_RUN` go; `COMMAND_GRID` comes (pull, lint, build, diff, audit, skill add — all shipped). `COMMANDS` stays as the honesty-rule registry.
- **Recorded run:** `site/src/landing/diff-run.json`, `site/scripts/record-diff-run.ts` and the `diff:record` script had the scenes as their only consumer; they go.
- **Tests:** `landing.test.ts` keeps the honesty rule for every command on the page (the grid included) and the workflow test; the scene-order and diff-share tests go.
- **Styles:** the `.story`, `.two-states`, `.pair`, `.shares`, `.agent`, `.caption` rules go from `landing.css`; a `.plain` section rhythm (strip, commands, facts) replaces them.
- **Audit baseline:** `site/.dta/audit-baseline.json` only excused the agent scene's quoted `#2443ac`; it goes, and `site/audit.test.ts` expects a clean run.
- The `Checks` stories carry their own data instead of importing the scenes'.
- `Scene`, `ExampleButton`, `TokenRows`, `Checks`, `Terminal` stay in the design system (docs and stories); the Orbit Burger example brand stays in `site/examples`.

## Acceptance criteria

- [x] The landing page has no scene; every command it shows is shipped (`landing.test.ts`)
- [x] `Commands` has a docs page under design-system/components and a story in both viewports
- [x] `pnpm --filter dta-site test`, `typecheck` and `build` green; `starlight-links-validator` finds no dangling `#agents` link
- [x] Spec revision note added; this ticket in the index

## Notes

Decided in conversation with the maintainer on 2026-10-26, from the question whether the example section would be read at all. The scenes' copy is kept in git history should a "how it works in detail" docs page want it.
