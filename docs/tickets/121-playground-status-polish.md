# TICKET-121: Polish after the status colours (paths, selected finding, CopyButton, review colour)

**Phase:** 8 — Token Engine Overhaul, Epic 7b (playground)
**Priority:** Low
**Effort:** S
**Blocked by:** 120
**Status:** open

## What to build

Small things left open by 120 and noticed on its screenshots (2026-10-19):

1. **Token paths break at `/`, never mid-word.** The status banner (in `Findings.css`) breaks "Surface/Muted" as "Surface/Mu-ted" because the text uses `overflow-wrap: anywhere`. Token paths (and dotted alias ids) should break after a `/` or `.` and keep each segment whole; a single segment wider than its box may still break as a last resort. One shared way to render a path (e.g. a `<wbr>` after each separator, or a small `TokenPath` helper in `site/src/components/ds`), used everywhere a path can wrap: the banner, `Findings` lines and details, `DetailPanel`, `OutputFiles`, `SourceBar`, `CliHandoff`.
2. **A selected finding keeps its severity marker (decision needed).** Today the selected line turns label, detail and marker to `action-text`, so a selected error loses its `status-error-marker` square. Proposal: the row keeps the action tint (selection) but the marker keeps its status colour and shape, so selection and severity are both visible at once. Alternative: keep today's behaviour (selection wins). Contrast of the status marker on `action-subtle` must be checked (3:1 for the non-text marker, both themes).
3. **CopyButton "Not copied" gets the error marker.** "Copied" has the pass dot in `status-success-marker`; "Not copied" has none, so the failure relies on the word alone in a spot where success has a shape. Add the error square in `status-error-marker` (shape + word, not colour alone); the shared grid cell keeps the width stable.
4. **"Review" vs "changes to review" (decision needed).** The `dta diff` report's "review" verdict uses the action tint (`packages/visual-diff/src/report/html.ts`, `VERDICT`), Checks' "changes to review" uses `signal`. Both mean "a diff a person looks at" and are deliberately not statuses (120). Proposal: the report follows Checks and uses `signal` (signal orange is for changes/diffs, which this is); the action tint stays for actions. Alternative: keep both and record why they differ.

## Acceptance criteria

- [ ] 1: no token path breaks inside a segment at 390 or 1280 (e2e check on a long path in the banner, the lint panel and the detail panel); one shared helper
- [ ] 2: decided by the maintainer and applied; Findings docs and stories (incl. a selected error line, phone width) updated
- [ ] 3: error marker on "Not copied"; CopyButton docs and a story for the failed state
- [ ] 4: decided by the maintainer and applied (report, Checks or docs); Status colours page records the decision
- [ ] AAA text contrast and 3:1 markers in both themes (`test:contrast`), layout shift 0
- [ ] Screenshots 1280 and 390, light and dark, shown before pushing
- [ ] All gates pass plus the site job, and the GitHub run is green

## Outcome

_(open)_
