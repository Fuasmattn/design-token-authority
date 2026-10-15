# Legacy snapshots

Reference outputs of the **frozen legacy pipeline** (`src/`), captured from the fixture projects in `test/fixtures/`. The new `@dta/*` pipeline must reproduce them (see `docs/specs/token-engine-overhaul.md`, TICKET-035/036).

> **These are reference snapshots, not self-recorded ones.** They are recorded from the frozen legacy pipeline, never from the code under test. When a test fails, do not "update the snapshot" to make it pass: that would let the rewrite bless its own bugs. The only things that may change a snapshot are `pnpm snapshot:capture` (always runs the legacy code) and a deliberate, reviewed output change.

## Layout

    test/snapshots/<fixture>/<scenario>/
      stdout.txt      normalized stdout
      stderr.txt      normalized stderr (only present if non-empty)
      exit-code.txt   process exit code
      files/**        every file the command created, at its relative path

Fixtures: `brand-ab`, `daisyui`. Scenarios: `build`, `lint`, `graph-console`, `graph-dot`, `graph-markdown`, `graph-html`.

## Commands

    pnpm snapshot:capture   # regenerate test/snapshots/ from the legacy pipeline
    pnpm snapshot:check     # re-capture to a temp dir and fail on any difference

Only regenerate on purpose. A changed snapshot in a PR is a visible, reviewable diff. Never edit snapshots by hand.

## Determinism

Re-capturing produces no diff (verified across repeated runs, including under CPU load). The harness:

- runs every scenario in a **fresh copy** of the fixture, so scenarios cannot affect each other
- strips ANSI codes and **emulates spinner redraws**: piped, the spinner library prints extra intermediate frames only when a phase is slow, which would make stdout timing-dependent
- replaces absolute paths with `<cwd>` / `<repo>` and normalizes line endings
- pins `LC_ALL`/`LANG` (`toLocaleString()` number formatting), `TZ=UTC`, `NO_COLOR`, `TERM=linux` (the prompt library draws ASCII symbols for `linux` and unicode box characters otherwise, so an unpinned `TERM` made CI and other machines differ from the recording), and removes `FIGMA_*` variables
- stubs `open` / `xdg-open` so `graph --format html` cannot launch a browser

## Known legacy quirks (captured as-is, not fixed)

1. The build summary prints `build/js/colorpalette.js`, but the file is written to `output/js/colorpalette.js` (see `files/output/js/`).
2. The version is hardcoded as `0.1.0` in `src/theme.ts` and `src/cli.ts`, while `package.json` says `1.0.0`.
3. `graph --format html` always tries to open the result in a browser (`open` / `xdg-open`) and prints "Opening visualization in browser...".
4. `lint` exits `2` when there are errors and `0` when there are only warnings (`daisyui` covers the former, `brand-ab` the latter).
5. The `graph` console report truncates long lists ("... and 898 more").
6. Piped spinner output depends on timing (handled by the harness, see above).
