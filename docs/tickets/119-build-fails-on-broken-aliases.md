# TICKET-119: `dta build` must not write broken CSS for dangling or circular aliases

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** High
**Effort:** S
**Blocked by:** —
**Status:** done (pending the GitHub run)

## Problem

Found with the "Example with problems" fixture (TICKET-113, 2026-10-19): `dta build` on `test/fixtures/brand-ab-problems` writes `--Muted: var(--Muted);` for a circular alias and leaves `{Colors.Foundation.Orange.550}` unresolved in the output for a dangling one, with only a warning and exit code 0. The files look fine and break in the browser. The new build snapshot records this behaviour as it is.

## What to build

Dangling and circular aliases are build errors: `dta build` reports them as diagnostics (same wording as `dta lint`), writes no broken declarations, and exits non-zero; the playground's Outputs tab shows the errors instead of files (it already does for build errors). Decide whether the build stops entirely or skips only the affected tokens with an error exit; record it.

## Acceptance criteria

- [x] `dta build` on `brand-ab-problems` exits non-zero with the two alias errors; no `var(--X)` self-references or `{…}` left in any output
- [x] Build snapshot of `brand-ab-problems` re-recorded by name; all other snapshots unchanged
- [x] Playground Outputs tab shows the errors for the example with problems (e2e)
- [ ] All gates pass, and the GitHub run is green (gates pass locally; GitHub run pending, nothing committed or pushed)

## Outcome

- **Decision: the build stops entirely; `dta build` writes nothing while there are errors** (and exits 1, like every other "cannot be built" case; `dta lint` keeps exit 2). The alternative, writing the files without the broken tokens and exiting non-zero, would leave a project whose output folder is partly rebuilt (some files new, the broken tokens missing, the rest from an earlier build) and looks fine to anyone who misses the exit code; a CI step that ignores the code would ship it. With all or nothing the folder always holds one consistent build (the last good one, or none), and the error is the only result. The CLI says so: `Nothing was written: fix the errors above and build again.` before `Build failed.`; the `context` file (DESIGN.md) is not written either.
- **The package still never produces a broken declaration.** `buildOutputs` reports the errors and leaves out every token that cannot resolve (the dangling alias, the members of a cycle, and every alias whose chain runs into one of them) from every output, so no file it returns holds a `var()` that refers to itself or an unresolved `{…}`, in CSS, Tailwind v4/v3 or JS. The other files still come back with the error diagnostics: `dta diff` reads the CSS of both sides through `cssBindings`, and a base with a broken alias (a PR that fixes it) still gives bindings for the tokens that resolve (a token missing on one side is reverted with `initial`, which is what the base's browser did with the invalid declaration). Callers that write files check `hasErrors` first: `dta build`, the playground (it already hid files on errors), and now `site/scripts/report-tokens.ts`, which throws on errors instead of baking partial CSS into the report.
- **Shared wording** (`@dta/core`, new `alias-problems.ts`): `danglingAliasMessage`, `circularAliasMessage` (the `dta lint` messages, now used by `no-dangling-aliases` and `no-circular-aliases` too, so the two cannot drift) and `aliasProblems(graph, include)` → error diagnostics plus the set of unresolvable graph nodes. Codes `dangling-alias` and `circular-alias`, the ones `resolve` (and so `dta token get`) already uses; the lint rule names stay lint's. One error per dangling alias per file (the dedupe key now includes the file) and one per cycle, with the file the token is in (a cycle names its first member's file; lint still prints "(unknown file)" for cycles, kept for parity). Detection runs on the whole model's alias graph (`analyzeGraph`, the same graph lint uses), limited to the collections the build reads, so an alias into a collection that `collections` leaves out is not dangling: it stays the `broken-reference` warning it was.
- **Doc link (114's mechanism):** new doc id `lint-rules`. The CLI prints `See site/src/content/docs/reference/lint-rules.mdx.` (a test checks every `DOC_PATHS` file exists), the website links "Lint rules reference" (`/reference/lint-rules/`). `formatDiagnostic` puts a full stop after a message without one when a docs pointer follows (only the new diagnostics are affected; the existing ones end with a full stop).
- **CLI output** on `brand-ab-problems` (exit code 1, nothing written):

  ```txt
  x  error [dangling-alias] Alias {Colors.Foundation.Orange.550} references non-existent token "Colors.Foundation.Orange.550". See site/src/content/docs/reference/lint-rules.mdx. (Brand(Alias).BrandB.json)
  x  error [circular-alias] Circular alias chain: Brand(Alias).BrandA/Colors/Surface/Muted → Brand(Alias).BrandA/Colors/Text/Muted → Brand(Alias).BrandA/Colors/Surface/Muted. See site/src/content/docs/reference/lint-rules.mdx. (Brand(Alias).BrandA.json)
  |  Nothing was written: fix the errors above and build again.
  —  Build failed.
  ```

- **Snapshot:** only `brand-ab-problems/build` re-recorded (`pnpm snapshot:record --scenario brand-ab-problems/build`): `exit-code.txt` 0 → 1; `stdout.txt` loses the `broken-reference` warning, the steps and the file list and gains the two errors, the nothing-written line and `Build failed.`; `files/` is gone (the eleven files with `--Accent: {Colors.Foundation.Orange.550};`, `--Muted: var(--Muted);` and the unresolved Tailwind values). The other 40 snapshots are unchanged (`snapshot:check` 41 passed). `test/snapshots/README.md` and `test/fixtures/README.md` (expected behaviour: build exits 1 with 2 errors, writes nothing) say so.
- **Playground:** the Outputs tab of "Example with problems" shows the "Build" findings with the two lines and their "See the Lint rules reference." links, the summary "The build has errors: dta build writes no files until they are fixed." (failed), no files, `Outputs · 0`; the summary strip says `build failed` instead of `0 output files`; "Download all (.zip)" and the "N files as dta build writes them" hint are hidden while the build fails, and the CLI hand-off says "Once the errors are fixed, dta build writes the files on your machine…".
- **Tests:** `@dta/core` `alias-problems.test.ts` (wording, files and paths, transitive unresolvable set, `include`, the fixture's two errors equal to lint's messages), `DOC_PATHS` files exist; `@dta/build`: the two old warning tests became error tests (dangling once per file, cycle with the aliases that run into it left out, exact theme CSS), alias into a left-out collection stays a warning, the fixture's errors and no broken declaration in any output format, `cssBindings` with a broken alias; CLI `build.test.ts`: exit 1, the lines, nothing written (also no DESIGN.md), an earlier build's files left untouched; `site/src/playground/outputs.test.ts`: the playground's diagnostics for the example equal what `dta build` prints, which exits 1 and writes no `output/`; `playground.e2e.test.ts` (1280 and 390): the Build findings, both lines with links, `Outputs · 0`, `build failed`, no files, no download, nothing wider than the screen, no page error; `contrast.e2e.test.ts`: new state "example with problems, build errors", AAA in Light and Graphite at 1280 and 390.
- **Docs:** Lint rules ("Broken aliases fail the build", with the CLI output), Outputs ("When the build fails"), Exit codes (`dta build` row), CI guide; `packages/build/README.md` contract and `docs/specs/build-package.md` decision 6.
- **Gates:** prettier, typecheck, boundaries, `pnpm test` (1154 passed with Chromium; 1052 + 102 skipped without), `snapshot:check` (41 passed), `pnpm site:build` (118 pages, links valid), `test:contrast` with Chromium (105 passed). Node 24.14.1. GitHub run: pending, nothing committed or pushed.
- **Screenshots** (not committed, session scratchpad): `119-outputs-{1280,390}-{light,dark}.png` (the Outputs tab of the example with problems), `119-cli.txt` (the CLI run on a copy of the fixture).
- **Left open:** `broken-reference` (an alias that only breaks within one build: into a collection `collections` leaves out, or into a multi-mode collection that lacks the brand) is still a warning and still writes the unresolved `{…}`; making it an error too is a separate decision (it changes builds that filter collections today). Cycles that exist only through a cross-collection alias read in a non-first mode are not seen by `analyzeGraph` (it reads other collections in their first mode, as `resolve` does by default); none of the fixtures has one.
