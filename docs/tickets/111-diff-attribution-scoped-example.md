# TICKET-111: `dta diff` attribution for the Orbit Burger example (scoped selectors)

**Phase:** 10 — Landing redesign
**Priority:** Medium
**Effort:** M
**Blocked by:** 108
**Status:** in progress
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decision 2: "the numbers on the page come from a real `dta diff` run")

## Problem

The Orbit Burger example (105) is one brand with one mode, built by the site into one stylesheet scoped per state (`[data-example="orbit-burger"][data-state="main" | "change"]`, `site/scripts/build-example.ts`), because the page shows both states at once. `dta diff` run in `site/examples/orbit-burger` against a base where `tokens/` equals `tokens-base/` (recorded 2026-10-18 in the 108 outcome) renders the site's stories at both states and finds the changed pixels, but attribution explains none of them: its revert rules come from `dta build`'s own selectors (`:root` for a single-mode collection), and a `:root { --colors-brand-primary: … !important }` never reaches an element that declares the variable itself under the scoped selector.

So scene 02's "explains N % of the differences" lines stay illustrative and labelled (`DIFF_SHARES.real = false`, the honesty test checks the label).

## What to build

One of:

1. **Attribution through the page's own declarations.** `planReverts` derives the revert rule from where the variable is actually declared in the rendered page (every rule that declares `--colors-brand-primary`, from the page's stylesheets), not only from the build's selectors. Then any project whose build output is re-scoped still gets explained.
2. **A `diff.attribution.selectors` config**, mapping a collection · mode to the selector(s) the project declares it under, so the site can say `Brand · OrbitBurger → [data-example="orbit-burger"][data-state="change"]`.

**Decided (maintainer, 2026-10-20): option 1**, attribution through the page's own declarations: re-scoped CSS (themes per wrapper or component) is common, and it needs no config. Option 2 is not built.

Then record the run (`dta diff --base <sha>` in `site/examples/orbit-burger`, with a throwaway commit holding the main state), replace `DIFF_SHARES` with the real shares and set `real: true`; the illustrative note disappears from the page.

## Acceptance criteria

- [ ] Attribution explains the Orbit Burger stories' changes by `Radius.Card` and `Colors.Brand.Primary`
- [ ] `DIFF_SHARES` on the landing page comes from a recorded run, `real: true`, no illustrative note
- [ ] All gates pass plus the site job, and the GitHub run is green

## Outcome

_(open)_
