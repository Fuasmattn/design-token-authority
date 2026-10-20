# TICKET-120: Status colours for success, warning and error

**Phase:** 8 — Token Engine Overhaul, the design system
**Priority:** High
**Effort:** M
**Blocked by:** —
**Status:** open (proposal on the design canvas board "Proposal · status colours", 2026-10-19; values to be confirmed by the maintainer)

## Problem

The design system has no status colours. Errors and warnings are told apart only by shape (filled square, open ring) in ink, success borrows `sage` ad hoc, and `signal` (redline orange) is reserved for redlines and diffs and must never mean "error". Lint findings, failed builds (119), checks and the summary line need colours people read at a glance (maintainer, 2026-10-19).

## What to build

- **Primitives:** `crimson` and `ochre` scales next to the existing `sage`; values per the proposal (light: error text `#8c151c`, marker `#c42b30`, subtle `#fde4e1`; warning `#5e3f00` / `#7d5a00` / `#faecc8`; success `#27512f` / `#3c7646` / `#e1eee2`. Graphite: error `#ffb3ad` / `#f0736b` / `#3d1b19`; warning `#f2d08a` / `#f0c64a` / `#3a2d10`; success `#9ad3a2` / `#7fb887` / `#1c2a1e`).
- **Semantic tokens per theme:** `status.{success,warning,error}.{text,marker,subtle}`; text reaches 7:1 on canvas, surface and its own subtle; markers ≥ 3:1 (non-text). Info stays `action`; `signal` stays for redlines and diffs only.
- **Contrast and colour-vision check (2026-10-19):** all text pairs ≥ 7:1 on canvas, surface, `bg-subtle` and their own subtle in both themes (lowest: light success text on `bg-subtle` 7.19); markers ≥ 3:1 on all four (lowest: light warning marker on `bg-subtle` 4.97). Simulated protanopia/deuteranopia: the first warning marker (`#a86f00`, graphite `#dfa93a`) was almost indistinguishable from `signal` (ΔE 7), so the markers moved to `#7d5a00` / `#f0c64a` (ΔE ≥ 12 to signal, ≥ 9 to error). The CI contrast test must cover these pairs; the shapes and words carry the meaning for everyone.
- **Shapes stay:** colour adds to the markers (dot = success, open ring = warning, filled square = error) and the words; never colour alone.
- **Apply:** Findings, Checks, SummaryLine counts, the Outputs "build failed" block, TokenInput/diagnostics, the `dta diff` report verdicts, the Terminal's success line (`terminal-success`) where it fits; a status banner pattern (subtle background + complete 2px marker-colour outline, per principle 3).
- **Docs:** a Status colours section in the design system (tokens, when to use which, never `signal` for errors, shape + word + colour), token pages, component docs and stories updated; AAA contrast test covers every status pair in both themes.

## Acceptance criteria

- [ ] Primitives and semantic status tokens built with `dta build`; contrast test proves the pairs
- [ ] Components and the report use them; no status literals; stories and docs updated
- [ ] Design-system docs: status colours rule and examples
- [ ] All gates pass plus the site job, and the GitHub run is green
