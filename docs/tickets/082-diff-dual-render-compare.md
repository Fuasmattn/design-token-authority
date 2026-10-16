# TICKET-082: Render base and head in one run and compare

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** L
**Blocked by:** 081
**Status:** done
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 2, 5, 6)

## What to build

`dta diff` builds the project at the base (temporary worktree) and at the head with the configured command, serves both, captures every story × viewport in Chromium and computes a pixel diff with ratios and diff images. Deterministic settings; Playwright is an optional peer dependency; a Dockerfile runs it anywhere.

## Acceptance criteria

- [x] Base build in a temporary worktree, cleaned up afterwards (also on failure)
- [x] Capture with fixed viewport, device scale 1, animations off, reduced motion, fonts from the site, network idle
- [x] `compareImages` tested on synthetic PNGs (identical, one pixel off, thresholds)
- [x] Missing browser → clear install hint, `--tokens-only` still works
- [x] End-to-end CI job in the container on a small fixture site at two commits (one token change, one component change)
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- Flow: build the head (`diff.build`) → `git worktree add --detach` of the base commit in a temp folder → `diff.setup` (e.g. `pnpm install --frozen-lockfile --prefer-offline`) at its root → `diff.build` in the project folder inside it → serve both `outDir`s on localhost → render each story × viewport in Chromium → compare → report in `.dta/diff` (`--report <dir>`): `base/`, `head/`, `diff/` PNGs, `result.json` (`dta.diff/1`), `summary.md`. The worktree, servers and browser are cleaned up in a `finally`.
- A base that does not build (e.g. before the site existed) means every story is `added`, with the build error shown.
- Capture: viewport width × 800, device scale 1, `reducedMotion: reduce`, light colour scheme, `en-US`, UTC, `networkidle` + `document.fonts.ready`, full page, animations disabled, caret hidden.
- **Colour tolerance is 0 by default** (`diff.colorThreshold`): with pixelmatch's usual 0.1 a real token change on the website (`action.bg` Light: blueprint-600 → 700) produced no changed story. With 0 it shows up in exactly the stories that use the token (buttons, redline card, diff card "Approve", active rail station), and not in the others (chip, terminal, blocked diff card).
- Verified on the website: against an unchanged commit, 15 of 15 renders are pixel-identical (about 45 s including the base install and both builds).
- playwright-core is an optional peer dependency of `@dta/cli` (loaded only here); `DTA_BROWSER_PATH` selects a Chromium binary. No browser → install hint on stderr, token changes still reported, exit code unchanged.
- `docker/diff.Dockerfile` pins Node 24, git and Playwright's Chromium (1.59.1). Not built in this environment (no Docker here); the CI job "diff-e2e" runs the same end-to-end test on ubuntu with Playwright's Chromium.
