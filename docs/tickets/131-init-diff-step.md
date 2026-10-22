# TICKET-131: Init step for `dta diff`, re-runnable

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** High
**Effort:** M
**Blocked by:** 126, 128, 129
**Status:** open
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md) (decisions 1–5, 8)

## What to build

`dta init` (and so `npm create dta`) gets a step after tokens and outputs: "Review UI changes in pull requests?", defaulting to yes when stories were detected.

- **Detected (TICKET-126):** stories source, package manager, Node version, build command.
- **Asked only when not detected:** without Storybook, "Which pages should we check?" with `/` prefilled (TICKET-128); "Will people outside your team open pull requests?" (no → one file, yes → three, TICKET-129; settled question 1), saved in the config (for example `diff.workflow: 'single' | 'split'`, named when this is built) so a re-run does not ask again.
- **Writes:** the `diff` section in `dta.config.ts`, the workflow file(s) and `playwright-core` as a devDependency.
- **Browser:** asks whether to install `playwright-core` and Chromium now, default yes; `--yes` installs (settled question 3).
- **Prints** what it found and where from, and what it wrote.
- `dta init --diff` runs only this step; `--yes` makes it non-interactive (CI and agents).

**Re-running on an existing setup:**

- Detects again and compares with what is there.
- Lists what it would change before writing (for example "workflow: npm → pnpm", "stories: pages → Storybook") and asks once; `--yes` applies without asking.
- With no changes it says "Up to date" and writes nothing.
- It only touches what it generated: keys added or changed by hand in the `diff` section stay and are listed as kept; a generated workflow file that was edited is not overwritten, init names the file and what it would have changed.

## Acceptance criteria

- [ ] End-to-end (`DTA_E2E=1`): `dta init --diff --yes` on a Storybook fixture, then `dta diff`, gives a report with screenshots and no hand edits
- [ ] Re-run tests: unchanged project, switched package manager, Storybook added, hand-edited key kept, hand-edited workflow not overwritten
- [ ] CLI snapshots for the init scenarios re-recorded by name and reviewed in the same PR
- [ ] Docs: Quick start and the diff guide lead with the one-command path; the guide has a "Change your setup later" section with re-running first
- [ ] All gates pass, and the GitHub run is green
