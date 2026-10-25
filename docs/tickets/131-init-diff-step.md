# TICKET-131: Init step for `dta diff`, re-runnable

**Phase:** 11 — `dta diff` with near-zero setup
**Priority:** High
**Effort:** M
**Blocked by:** 126, 128, 129
**Status:** done (2026-10-24)
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

- [x] End-to-end (`DTA_E2E=1`): `dta init --diff --yes` on a Storybook fixture, then `dta diff`, gives a report with screenshots and no hand edits
- [x] Re-run tests: unchanged project, switched package manager, Storybook added, hand-edited key kept, hand-edited workflow not overwritten
- [x] CLI snapshots for the init scenarios re-recorded by name and reviewed in the same PR
- [x] Docs: Quick start and the diff guide lead with the one-command path; the guide has a "Change your setup later" section with re-running first
- [x] All gates pass, and the GitHub run is green

## Notes

- `dta init --diff [--yes]` (`packages/cli/src/commands/init-diff.ts`, planning in `packages/cli/src/init/diff-setup.ts`); `dta init` ends with "Review UI changes in pull requests (dta diff)?" (yes by default when Storybook was found) and runs the same step.
- The config key is `diff.workflow: 'single' | 'split'`. `--yes` does not ask about outside contributors and writes `split`, the setup that is safe for forks.
- The `diff` section is written as a marked block (`// dta init --diff: generated {…}` … `// end of dta init --diff`); the first line records what init wrote. A re-run updates keys still as recorded, keeps keys changed by hand (listed as kept) and lines added inside the block; a `diff` section init did not write is not edited (init prints the block to paste). A JSON config gets the keys merged in.
- Workflow files end with a stamp of their content (`# dta init --diff sha256:…`); an edited file is not overwritten, init names it.
- Browser: `playwright-core` is added with the package manager when it is not a dependency, and Chromium installed when there is none (`DTA_BROWSER_PATH` or Playwright's); a failed download only warns (the setup is written; CI installs its own browser).
- Config loading: a config loaded a second time in the same process (init writes it, then reads it) is read through a temporary copy next to it, because tsx keeps the first module.
- Tests: re-runs (unchanged, npm → pnpm, page list → Storybook, a key and a line added by hand, an edited workflow, the outside-contributors question saved), and the success check end to end (`packages/cli/test/init-diff-e2e.test.ts`, in the CI job "diff-e2e": `dta init --diff --yes` on a Storybook project, then `dta diff` gives a report with screenshots).
- No init snapshot scenarios existed; the init output is covered by these tests. The `skill-add` snapshot was re-recorded by name (the skill now describes this setup).
- Docs: Quick start step 6 and the diff guide's "Before you start" lead with the one command; "Change your setup later" starts with re-running. Output copied from a run on the Storybook trial project.
- **Review (fixed):** the block is inserted after a last property without a trailing comma, at the end of the exported object (found by matching brackets, skipping strings and comments; a function after the export is left alone); a `diff` key written as shorthand counts as hand-written; keys Prettier wrapped over several lines are replaced whole; the record holds what init proposed, so a key kept by hand is kept on every later run too.
- **Changed after review with the maintainer (2026-10-22):** in a project that has a config, plain `dta init` no longer stops with "Config file already exists": it runs the diff step (set up or update) and never rewrites the config. `--diff` stays as the explicit form for scripts and agents (`dta init --diff --yes`), and also runs only this step. The docs lead with `dta init`.

### Found by running init on the site (TICKET-087)

- A static-site manifest is shown as `manifest <path>` and kept; init no longer asks for pages when the config has a page list or a manifest.
- A `diff` section written by hand in a TS/JS config is never edited: init names only the keys to add (`keyLines`); with no section and no place to insert one, it prints the whole block.
- The report workflow has one step (no checkout, install or secrets) unless the config has `diff.publish`; then init carries that command into the workflow (quoted as Prettier writes YAML) with a note where the hook's secrets go.
- In a git repository init adds `.dta/diff/` to the project's `.gitignore` unless a rule already ignores it (`git check-ignore --no-index`, so a committed report folder does not add the rule again).

## Review (2026-10-24)

- `init-diff-e2e.test.ts` runs `dta init --diff --yes` then `dta diff` on a Storybook fixture with screenshots, no hand edits (CI job `diff-e2e`); the re-run cases are in `init-diff.test.ts`; Quick start and the diff guide lead with the one-command path, "Change your setup later" starts with re-running. CI green on 3bdd228.
- No CLI snapshot scenarios exist for `init`; its output is covered by the tests above instead. Maintainer accepted that in place of re-recorded snapshots on 2026-10-24.
