# TICKET-180: Attribution misses outlines and text moved by a sibling's margin

**Phase:** 13 — Maintenance
**Priority:** Medium
**Effort:** S (part 1), M (part 2)
**Status:** open (2026-11-02)
**Spec:** [visual-diff](../specs/visual-diff.md)
**Issues:** #60 (part 1, good first issue), #61 (part 2)

## Problem

The sample pull request #59 changes three tokens (`action.bg`, `radius.md`, `space.2`). `dta diff` explains 99 of 105 changed stories, but reports 6 as unexplained although every changed pixel there comes from those tokens. The verdict is 🔴 for a change that is fully caused by tokens.

Attribution puts each changed token back to its base value in the head page and records the elements whose computed style or box changes (`DEPENDENTS_SCRIPT`). Changed pixels inside a dependent's box, `BOX_TOLERANCE` (2 px) larger on every side, are explained. Two cases fall outside that:

1. **Outlines and shadows drawn further out than 2 px.** `token-rows--default` (1280 and 390): edited rows have `outline: 1px dashed var(--action-bg); outline-offset: 4px`. The `li` is a dependent, but its outline sits 4–5 px outside its box, so the outline's colour change is unexplained.
2. **Text moved by a sibling's margin.** `structure-table--brand-ab` and `--selectable` (1280 and 390): `<p><span class="…brands-label">Brands</span> BrandA, BrandB</p>`. `space.2` is the span's `margin-right`. The span is a dependent, but its box excludes the margin and stays the same; the text node after it moves 2 px, and the `p` around it changes neither style nor box. No dependent box covers the moved text.

## What to build

1. **Ink overflow.** Each dependent's box grows by what it paints outside its border box: `outline-width + outline-offset` (when the outline style is not `none`), and the extent of each `box-shadow` (offset, blur and spread). `BOX_TOLERANCE` stays for anti-aliasing. Both the head and the base box.
2. **Inline content a dependent pushes.** When a dependent's margin changes, the content it pushes is explained too. Options to decide in the spec: count the parent's content box (simple, may over-explain), or record text-node rects in the snapshot and treat a moved text node as a dependent of the same token (precise, more snapshot work). Pick one, with a note in the visual-diff spec.

## Acceptance criteria

- [ ] Part 1: a story with an outline at `outline-offset: 4px` in a changed token's colour is explained (`attribution.test.ts`, through the public API)
- [ ] Part 2: a story whose text moves because a sibling's margin uses a changed token is explained
- [ ] Re-running #59's change explains all 105 changed stories; no story that was unexplained for an unrelated reason becomes explained
- [ ] Gates green; the docs page on reading a `dta diff` report says what counts as explained

## Notes

- Found with the README hero work (ticket 179). Evidence: #59's report, stories `token-rows--default@1280` (region 481×143 at 37,132) and `structure-table--brand-ab@1280` (region 747×13 at 101,681).
- Part 1 is self-contained (one function, a test fixture with an outline): `good first issue` #60. Part 2 needs the design decision first: #61.
