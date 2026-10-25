# TICKET-147: `dta audit`: size tokens for widths and heights, not for paddings

**Phase:** 8 — Token Engine Overhaul (follow-up)
**Priority:** Medium
**Effort:** M
**Blocked by:** 146
**Status:** done (2026-10-24)

## What to build

Found in TICKET-146: the site got `size.icon` (20, Figma scope `WIDTH_HEIGHT`), and `dta audit` then suggested it for four `padding: … 20px` and `margin: 20px` values. Two gaps cause it:

1. `kindsOf` in `packages/cli/src/audit/match.ts` maps `WIDTH_HEIGHT` to "spacing", the same kind as `GAP`, so a size token is offered wherever a padding is.
2. The detector (`detect.ts`, `lengthKind`) never looks at `width`, `height` or their relatives, so a size token can never be suggested where it belongs.

The audit promises "hard-coded values that equal a token"; today it ignores a whole Figma scope. Maintainer decision (2026-10-24): fix it fully (option B), not only stop the wrong suggestion.

## Design

**A new kind, `size`,** next to color, spacing, radius, stroke, font-size and font-family.

**Scope → kind follows Figma's meaning of each scope** (one table in `match.ts`):

| Figma scope     | Kind      | Properties it is suggested for                                                                                                 |
| --------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GAP`           | spacing   | margin, padding, gap, inset, top/right/bottom/left, scroll-margin/-padding (unchanged)                                         |
| `WIDTH_HEIGHT`  | **size**  | width, height, min-/max-width, min-/max-height, inline-size, block-size, min-/max-inline-size, min-/max-block-size, flex-basis |
| `CORNER_RADIUS` | radius    | unchanged                                                                                                                      |
| `STROKE_FLOAT`  | stroke    | unchanged                                                                                                                      |
| `FONT_SIZE`     | font-size | unchanged                                                                                                                      |

A token with several scopes is a candidate for each of their kinds (`GAP` + `WIDTH_HEIGHT` → spacing and size). Tokens without scopes (DTCG files, `ALL_SCOPES`) keep the name rule, extended: a segment `size`, `sizes`, `sizing`, `width`, `height` or `dimension` means size, unless the name already says font size.

**Detection** in all three places the audit reads:

- CSS/SCSS declarations, style attributes and CSS in template literals: the size properties above.
- JS/TS style objects: the same keys (`width: '20px'`, `minHeight: '44px'`).
- Tailwind arbitrary values: `w-[…]`, `h-[…]`, `size-[…]`, `min-w-[…]`, `min-h-[…]`, `max-w-[…]`, `max-h-[…]`, `basis-[…]`.

**At-rule conditions are not declarations:** `@media (max-width: 760px)`, `@container (min-width: …)` and `@supports (…)` are skipped (today they are only safe because widths were never read).

**JSON output:** `kind` gains `size` (`dta.audit/1` schema enum). Additive; consumers that validate the enum strictly need the new schema.

## Rollout

Teams that run `dta audit` in CI may see new findings after upgrading (widths and heights that equal a size token). The commit is a `feat(audit)` so the release is a minor version and the changelog says it; the CI guide gets one sentence: fix them, or accept them with `dta audit --update-baseline`.

## Acceptance criteria

- [x] `match.test.ts`: a `WIDTH_HEIGHT` token is suggested for `size` candidates, never for `spacing`; `GAP` + `WIDTH_HEIGHT` for both; name rule for unscoped tokens (`size.icon` → size, `font.size.body` → font-size only)
- [x] `detect.test.ts`: the size properties in CSS, JS objects and Tailwind; `line-height` and `border-width` are not size; `@media`/`@container`/`@supports` conditions are skipped
- [x] JSON schema enum includes `size`; the schema test validates real output
- [x] Site dogfood: the size hits are fixed with `var(--size-target)` / `var(--size-icon)` (no new baseline entries); the four `size.icon` entries leave `site/.dta/audit-baseline.json`; `site/audit.test.ts` back to "2 more in the baseline"
- [x] Snapshots unchanged, or re-recorded per scenario and reviewed if a fixture is affected
- [x] CI guide (`guides/ci.mdx`): the kinds sentence lists size; one sentence on new findings after upgrading
- [x] All gates pass

## Progress (2026-10-24)

- `match.ts`: one `SCOPE_KINDS` table; unscoped tokens named `size`, `width`, `height` … are sizes unless the name says font size. `detect.ts`: size properties in CSS, JS objects and Tailwind; at-rule conditions blanked. Schema enum has `size`.
- Snapshots unchanged; the guide's `brand-ab` example output is the same on a real run.
- Site: the four `size.icon` paddings left the baseline by themselves (2 entries again). Of the 27 new findings, 18 now use tokens (17 touch targets → `size-target`, the burger glyph → `size-icon`); 9 only share a value (the logo's drawn squares, the diff card's numbered marker, the playground checkbox, the docs colour swatch, a story frame) and carry `dta-audit-ignore` with the reason.
- Pushed in 3124544; CI green.
