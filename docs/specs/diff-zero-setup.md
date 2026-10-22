# Spec: `dta diff` with near-zero setup

**Status:** approved (2026-10-21)
**Depends on:** [TICKET-090](../tickets/090-first-npm-release.md) (the first release; `npm create dta` and a version tag for the actions), [visual-diff](./visual-diff.md) (the engine this spec does not change)
**Related:** [TICKET-086](../tickets/086-diff-github.md) (publish hook and pull requests), [TICKET-089](../tickets/089-diff-storybook-adapter.md) (Storybook adapter), [TICKET-015](../tickets/015-init-wizard.md) (`dta init`)

## Problem

`dta diff` is the feature that sets DTA apart, and it is the hardest one to start with. A new user needs about nine manual steps before the first comment shows up in a pull request:

1. install `playwright-core` and Chromium;
2. write the `diff` section of `dta.config.ts` by hand (`dta init` does not write one);
3. choose a stories source (the `dta.stories/1` manifest is not documented for users);
4. set `diff.setup`, or the base build fails in the fresh worktree;
5. build, then `dta diff --list`;
6. run `dta diff` locally;
7. copy three workflow files and edit them for pnpm or another Node version;
8. optionally copy a publish recipe and add its secrets;
9. create the `dta-diff-approved` label by hand.

Two of the failures are silent, which costs more trust than the step count:

- **No `setup`:** the base build fails, the run continues, and every story shows up as "added".
- **No browser:** the run falls back to token changes only, locally without an error.

## Goal

A project with Storybook gets its first `dta diff` comment in a pull request in **two steps**: `npm create dta`, then open a pull request. No file is edited by hand, and it takes under ten minutes.

**Non-goal:** new diff features. This spec changes setup and robustness only.

## Solution

1. **Detect the project** (TICKET-126): Storybook, package manager, Node version, build command, git remote and default branch, each with where it came from.
2. **Base build without `setup`** (TICKET-127): reuse installed packages when the lockfile did not change, otherwise install with the command the lockfile implies.
3. **Stories as a page list** (TICKET-128): `stories: ['/', '/pricing']` for projects without Storybook, no manifest needed.
4. **One workflow file** (TICKET-129) for private and team repositories; the fork-safe three-file setup stays for public ones.
5. **`dta diff --check` and loud failures** (TICKET-130): every error names the fix and links to the docs.
6. **The init step** (TICKET-131): `dta init` (and so `npm create dta`) sets it all up; `dta init --diff` adds or updates it later.

Order: 126, 127, 128 and 130 in parallel → 129 (after 090) → 131.

## Decisions

1. **Setup lives in `dta init`.** `npm create dta` runs `dta init` (TICKET-090), so it covers `dta diff` without a second command to learn. `dta init --diff` runs only this step, for projects that are already set up.
2. **Detect first, ask only what cannot be detected.** Init prints what it found and where from ("pnpm, from pnpm-lock.yaml"), so nothing is guessed silently.
3. **Explicit config always wins** over detection, at run time and when init runs again.
4. **Re-running is how settings change.** There is no separate settings wizard: the config is typed and documented, and `dta init --diff` on an existing setup detects again, lists what it would change and asks once. It only touches what it generated.
5. **Hosting the report is not part of setup.** The default is the pull request comment plus the report as a workflow artifact. Publish recipes stay an optional upgrade, linked from the comment.
6. **One workflow file for private and team repositories, three for public ones.** The split (`workflow_run`, `pull_request_target`) exists so that pull requests from forks never run with write permissions. A repository without outside contributors does not need it.
7. **Errors name the fix.** Every `dta diff` error says what is missing, the concrete fix (a config key, a command) and links to the matching section on the website. After the release, links are website URLs, not repository paths.
8. **Agents are a first-class path.** The generated reference, `llms.txt` and the skill describe this setup, so "set up dta diff" works for a coding agent from the docs. Init's `--yes` mode is non-interactive for that reason.

## Success check

An end-to-end test (CI, `DTA_E2E=1`) runs `dta init --diff --yes` on a Storybook fixture, then `dta diff`, and expects a report with screenshots and no hand edits.

## Settled questions

Decided by the maintainer on 2026-10-21.

1. **Public or private repository: ask once.** Init asks "Will people outside your team open pull requests?" instead of detecting it, so it works offline and with any host. The answer is saved in the config, so a re-run does not ask again. Yes → the three-file setup, no → one file.
2. **Reusing `node_modules` in the base worktree: only with an identical lockfile.** Reuse happens only when the lockfile is byte-identical between base and head; if the reuse fails (native dependencies, pnpm's store layout), DTA falls back to a clean install. Any other case installs cleanly.
3. **Browser install: ask once, default yes.** Init adds `playwright-core` as a devDependency and asks whether to install it and Chromium now (default yes). `--yes` installs without asking.
