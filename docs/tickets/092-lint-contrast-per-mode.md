# TICKET-092: `color-contrast` per mode, through aliases

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** in review

## What to build

`color-contrast` checks every configured pair in every mode (each brand, light and dark), with aliases resolved. Today it compares raw hex tokens only and the last mode read wins (a v1 quirk pinned by the parity tests, documented on the Lint rules page, 072).

## Acceptance criteria

- [x] Pairs resolve through aliases in each mode of the collection that defines them; a violation names the mode
- [x] The v1 quirk test is replaced by the new behaviour; the `lint` snapshot of `brand-ab` re-recorded if its output changes, reviewed
- [ ] Lint rules page updated; all gates pass, and the GitHub run is green

## Outcome

- **Decision: no open choice.** The contexts a pair is checked in are the ones `dta token get` already shows for a single token: each side is resolved with `resolve` from `@dta/core`, and every multi-mode collection either alias chain passes through adds its modes (a brand foreground over a single-mode background: once per brand; Brand × Theme: once per combination). Collections neither chain reaches are not multiplied in, so collections with different mode sets need no extra rule or config. The config shape is unchanged.
- **Wording:** the message keeps the v1 text and appends the context: `… is below 4.5:1 in BrandA` (several collections: `in BrandA · Dark`, in model collection order; a single-mode pair gets no suffix). `file` is the first file along either chain that is read in one of the context's modes (the brand file), else the foreground's own file; `tokenPath` stays `fg / bg` as written in the config.
- **Pairs that cannot be read** are no longer skipped silently: a side that does not resolve (unknown name, an alias that breaks in one mode, a cycle) or is not a colour gives a `contrast-unresolved` **warning** diagnostic pointing at the Lint rules page, and the other modes are still checked. An unknown name is reported once without a mode; a break in one mode names that mode. Warnings do not change the exit code (`dta lint` and `dta push` fail only on error diagnostics). Colours go through `toColor`, so `rgb()` values are compared too.
- **Before / after** (`dta lint` on `brand-ab`): v1 compared raw hex tokens only, so all three configured pairs (aliases in `Brand(Alias)`) were skipped. Now `Colors.Text.Muted` (Gray 500) on `Colors.Surface.Muted` (Gray 100) is found in both brands:

  ```txt
  |  Brand(Alias).BrandA.json
  |    warn Contrast ratio 4.39:1 between "Colors.Text.Muted" (#6b7280) and "Colors.Surface.Muted" (#f3f4f6) is below 4.5:1 in BrandA [color-contrast]
  |  Brand(Alias).BrandB.json
  |    warn Contrast ratio 4.39:1 between "Colors.Text.Muted" (#6b7280) and "Colors.Surface.Muted" (#f3f4f6) is below 4.5:1 in BrandB [color-contrast]
  |  10 warnings found.
  ```

- **Snapshots re-recorded** (by name): `brand-ab/lint` (the two lines above, `8 warnings` → `10 warnings`); `brand-ab/push-up-to-date`, `push-dry-run`, `push-dry-run-markdown`, `push-dry-run-json`, `push-yes` (only `8 lint warnings found.` → `10 lint warnings found.`, because `push` lints first). `brand-ab-problems` and `daisyui` have no contrast pairs and are unchanged.
- **Code** (`@dta/lint`): `colorContrast` in `lint.ts` works on the model (`contrastContexts` branches into the modes the chains reach); `lintTokens` passes its diagnostics in. No public API change. The schema description of the rule now says "per mode, through aliases" (generated Configuration reference).
- **Tests:** the two v1 quirk tests ("skips aliased and missing tokens", "last one winning") are replaced in `lint.test.ts` by: per-mode check through aliases naming the mode (dot and slash form), one finding per failing mode in mode order, single-mode pairs without a mode, Brand × Theme over a single-mode component token (and a collection neither side reaches does not multiply the pair), an alias broken in one mode (diagnostic for that mode, the other still checked), an unknown name (one diagnostic), non-colour values. `parity.test.ts` reads the re-recorded snapshot (comment updated). `packages/cli/src/commands/lint.test.ts`: per-mode finding and the `contrast-unresolved` warning line through the CLI.
- **Playground:** runs `lintTokens(model)` without a config (a visitor has no `dta.config.ts`), so `color-contrast` never runs there and its finding detail needs no mode; no UI change, no screenshots. First-load JS grows from 59,536 to 59,865 B gzip (`resolve` from core is now reachable from `@dta/lint`), within the 60,000 B budget.
- **Docs:** Lint rules page: the "Limits of the current version" paragraph replaced by how pairs are checked per mode, the `brand-ab` finding and a `contrast-unresolved` line from real runs (the fixture, and a scratch copy with one unknown pair); the config example lists the fixture's third pair. Brands and themes guide: the sentence on contrast limits updated. `packages/lint/README.md`: new section, quirk removed; spec decision 8 notes it is done for contrast; 039 quirk table row set to fixed; CHANGELOG entry under Unreleased.
- **Gates** (Node 24): prettier, typecheck, boundaries pass; `TERM=xterm-256color CI=true pnpm test` 1193 passed (149 skipped); `snapshot:check` 41 passed; `pnpm site:build` 137 pages, links valid; `test:contrast` 152 passed; diff e2e (`DTA_E2E=1`) 3 passed. Nothing committed or pushed.
