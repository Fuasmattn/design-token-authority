# Reference snapshots

Reference outputs of the CLI on the fixture projects in `test/fixtures/`. They were recorded from the v1 CLI (the legacy `src/` tree, removed in TICKET-039) and proved that the rewrite reproduces v1 behaviour; the reviewed, intentional differences from v1 are listed in the quirk table of `docs/tickets/039-legacy-removal.md`. The CLI snapshot test (`packages/cli/test/snapshots.test.ts`) compares every run against them.

> **These are reference snapshots, not self-recorded ones.** When the snapshot test fails, the output changed: fix the code. Re-recording to make a failing test pass would let a bug bless itself. Re-record only for an intentional output change, name every scenario you re-record, and review the diff in the same PR.

## Layout

    test/snapshots/<fixture>/<scenario>/
      stdout.txt      normalized stdout
      stderr.txt      normalized stderr (only present if non-empty)
      exit-code.txt   process exit code
      files/**        every file the command created, at its relative path

Fixtures: `brand-ab`, `daisyui`. Scenarios: `build`, `lint`, `graph-console`, `graph-dot`, `graph-markdown`, `graph-html`, `clean` and, for `brand-ab` only (served by the Figma fake from `test/recordings/`), `analyze`, `pull-api`, `pull-from-file`, `push-up-to-date`, `push-dry-run` (also `-markdown`, `-json`) and `push-yes`.

## Commands

    pnpm snapshot:check                                   # run the CLI snapshot test
    pnpm snapshot:record --scenario brand-ab/build        # re-record named scenarios from the CLI

`snapshot:record` has no "record everything" mode: every scenario must be named (`<fixture>/<scenario>`; without arguments it lists them). A changed snapshot in a PR is a visible, reviewable diff. Never edit snapshots by hand.

## Determinism

Re-capturing produces no diff (verified across repeated runs, including under CPU load). The harness:

- runs every scenario in a **fresh copy** of the fixture, so scenarios cannot affect each other
- strips ANSI codes and **emulates spinner redraws**: piped, the spinner library prints extra intermediate frames only when a phase is slow, which would make stdout timing-dependent
- replaces absolute paths with `<cwd>` / `<repo>` and normalizes line endings
- pins `LC_ALL`/`LANG` (`toLocaleString()` number formatting), `TZ=UTC`, `NO_COLOR`, `TERM=linux` (the prompt library draws ASCII symbols for `linux` and unicode box characters otherwise, so an unpinned `TERM` made CI and other machines differ from the recording), and removes `FIGMA_*` variables
- stubs `open` / `xdg-open` so `graph --format html` cannot launch a browser

## v1 quirks

The snapshots keep some v1 behaviour on purpose, and the outputs that were fixed during the rewrite were re-recorded as reviewed diffs. Both lists live in the quirk table of `docs/tickets/039-legacy-removal.md`.
