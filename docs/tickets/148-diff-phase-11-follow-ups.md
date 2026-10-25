# TICKET-148: `dta diff` follow-ups from the Phase 11 review

**Phase:** 11 — `dta diff` with near-zero setup (follow-up)
**Priority:** Medium
**Effort:** M
**Blocked by:** —
**Status:** done (2026-10-25)
**Spec:** [diff-zero-setup](../specs/diff-zero-setup.md)

## What to build

Found when TICKET-126 to 131 were checked against their criteria (2026-10-24). Each item is small; together they make the generated setup stable and the errors point at the real docs.

### 1. Pin the generated workflows to a release (from 129)

`ACTION_REF` in `packages/cli/src/init/diff-workflows.ts` is still `main`, waiting for TICKET-090; releases exist now (`v2.0.2` … `v2.1.0`). A team's CI should not change when `main` moves.

- Generated workflows use `Fuasmattn/design-token-authority/actions/…@v<version>`, the version of the CLI that wrote them (`packageVersion()` in `src/version.ts`). Re-running `dta init` after an upgrade moves them to the new tag (the re-run logic of TICKET-131 already updates untouched files).
- When the version is unknown, fall back to `main` and say so in the init output.
- **Decide while building:** `actions/examples/*.yml` are kept equal to the template by a test. Either the examples show a fixed placeholder tag that the docs explain, or the release workflow regenerates them. Prefer the option that needs no step in the release.

### 2. Docs links to the website (from 130)

`DOCS_ROOT` in `packages/cli/src/diff-problems.ts` points at the page sources on GitHub, with the section named in brackets, "until the website has a domain (TICKET-075)". It has one: `SITE_URL` (`https://dta.martinprinz.dev`, `site/site-url.mjs`).

- Links become `<SITE_URL>/<page>/#<section-anchor>`, one source of truth for the URL shared with the site.
- `diff-problems.test.ts` checks that each linked page exists and that each section anchor matches a heading on it (Starlight's slug rule), including the page the test skips today (`reference/commands`, generated at site build).

### 3. The comment headline says "approved"

Found in the approval run of TICKET-129 (test repository, PR #2): after the label, the status turned green and the comment gained "Approved by @… for <sha>", but its headline still read "🟠 dta diff: changes to review". Maintainer decision (2026-10-24): the headline says approved.

- `headline()` in `actions/lib/dta-diff.mjs` takes the approval into account: while the approval holds for the head commit (`approvedSha === sha`), the headline is a green "approved" one (marker and wording in line with the status, e.g. `✅ **dta diff: approved**`); the "Approved by @… for <sha>" line stays below it.
- A new push (approval gone) or removing the label brings back "changes to review"; the hidden marker and state line are unchanged, so existing comments are still found and edited.

### 4. Small cleanups

- The no-browser problem says its fix twice (in the message and on the `Fix:` line); say it once, on `Fix:`.
- One lockfile list: `base-build.ts` keeps its own copy of `LOCKFILES` and its own walk to the lockfile; use the detection from `io/detect.ts` (TICKET-126) so the two cannot drift.
- An error that is not one of the known problems is rethrown in `diff.ts` without a fix or docs link; report it as an "unexpected error" problem with a link to the troubleshooting section (and the original message).
- Tests the review found missing: an end-to-end `dta diff` on a page list (only a manifest is rendered end to end today), with a page the base does not have (counts as added); `pageExists` for `/a` → `a.html` and `a/index.html`; reusing `node_modules` with pnpm and Yarn; a lockfile in the head but not in the base.

## Acceptance criteria

- [x] Generated workflows pin `@v<version>`; `main` only when the version is unknown, with a note; examples and docs follow the chosen option; tests for both
- [x] Every `Docs:` link is a website URL with a working anchor; the test checks pages and anchors for every problem
- [x] The comment headline says approved while the approval holds for the head commit, and changes back on a new push or a removed label (tests in `actions/lib/dta-diff.test.ts`); the guide's "Approving changes" section matches
- [x] The no-browser fix appears once; one lockfile list; unknown errors reported with a fix and docs link
- [x] The missing tests above
- [x] Docs: the diff guide says which version the generated workflow pins and how re-running `dta init` updates it
- [x] All gates pass, and the GitHub run is green

## Progress (2026-10-24)

- **Pinned refs:** `actionRef()` in `init/diff-workflows.ts` returns `v<version>` of the CLI (`packageVersion()`), `main` when unknown (init warns). Examples: release-it's `after:bump` runs `pnpm workflows:generate`, so each release commit carries examples pinned to its own tag; between releases they point at the last release. This repository's own workflows keep `@main` (they test the actions at HEAD). Re-running init after an upgrade moves untouched workflows to the new tag (`diff-setup.test.ts`).
- **Docs links:** `docsUrl()` builds `SITE_URL/<page>/#<anchor>`; `headingSlug()` follows github-slugger. The test checks every problem's page and heading (the generated commands page through `commandReference()`), and that `SITE_URL` equals `site/site-url.mjs`. All 15 links checked against the built site's ids.
- **Approved headline:** `headline(verdict, { approved })`; `report()` and `approve()` write it while the approval holds for the commit the comment shows. An approval that arrives before that commit's run leaves the old headline until the run reports.
- **Cleanups:** the no-browser fix only on `Fix:`; one lockfile list (`lockfileIn()` in `io/detect.ts`); any unknown error is `diffProblems.unexpected` with a fix and the troubleshooting link (exit 1 as before).
- **Found by the new end-to-end test:** `--list` accepted `/about` for `about.html`, but the screenshot server did not serve it (the run failed). `resolvePage()` in `io/static-server.ts` is now the one rule for both; the guide says how a page path maps to files.
- Tests: `actionRef`, upgrade re-run, docs links and slugs, headline states, the fix said once, unexpected errors, page lookup, pnpm and Yarn reuse, a base without a lockfile, `lockfileIn`, `resolvePage`/server, page list end to end. All gates pass; CLI end-to-end tests (Chromium) pass.
- Pushed in b81fb91; CI green (test, site, diff-e2e, package, audit). Ships with the next npm release (the maintainer releases it).
