# TICKET-137: Several modifiers at once (axes)

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** L
**Blocked by:** 134, 136
**Status:** open
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decisions 8, 9; slice 6)

## What to build

- The model gains axes: one per modifier or multi-mode collection; a token's values are keyed by the contexts of every axis that overrides it, and resolution takes one context per axis (`ModeSelection` grows into that).
- Later entries in `resolutionOrder` win, as in the report; resolution happens after flattening.
- CSS: base on `:root`, then each modifier's overrides under its own attribute selector (`[data-brand="b"]`, `[data-theme="dark"]`) in resolution order, aliases as `var()`; one stylesheet covers every combination.
- Resolved outputs (`base.css`, JS, Tailwind v3) per permutation, only for the combinations the config selects.
- `dta diff`, `dta token get`, lint (contrast per combination) and the playground pick a context per axis.
- Existing brands and breakpoints become axes without changing their output (snapshots unchanged).

## Acceptance criteria

- [ ] A brand × theme fixture: every combination's resolved values match a resolver run per input (test)
- [ ] Browser test: `data-brand` and `data-theme` on one element give the resolver's values for all four combinations
- [ ] Existing snapshots unchanged
- [ ] Brands and themes guide rewritten around axes; the Learn page lists no gap left
- [ ] All gates pass, and the GitHub run is green
