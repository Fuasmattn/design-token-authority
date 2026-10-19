# TICKET-106: Design-system components for the redesigned landing page

**Phase:** 10 — Landing redesign
**Priority:** High
**Effort:** M
**Blocked by:** 110, 105
**Status:** open
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decisions 1, 2, 6, 9, 11); accepted prototype `docs/specs/landing-redesign/prototypes/p17-page.html` (`gen16.py` for the exact spacing and sizes)

Revised 2026-10-18 with the spec: `ExampleCard`/`BeforeAfter` became one button in two states, `CommandChip` and `Facts` were added, `LoopPath` moved to 107 as `GravityWell`.

## What to build

Under `site/src/components/ds`, each with a docs page in `design-system/components/` and at least one story (phone width too where the layout changes):

- **`CommandChip`**: a `<button>` that copies its command. `$` prompt in `terminal.prompt`, the command in mono, a copy icon at the end (inline SVG mask, `currentColor`) that becomes a tick for 1.6 s after copying; `terminal.bg`/`terminal.fg`; `aria-label="Copy: <command>"`; sizes default (scene commands) and large (the hero and final calls, 14 px mono, 14/18 px padding). Clipboard through `navigator.clipboard` with the tick shown either way. This replaces `CommandButton` on the landing page; retire `CommandButton` if nothing else uses it (check the docs pages), otherwise keep both and say which to use.
- **`Scene`**: kicker (number and title, `action.text`, 13 px mono weight 500), heading, one paragraph, a `CommandChip`, and a slot for the embedded example; alternates sides on desktop, stacks on phones; spacing per the prototype (quiet surface, `--space-36` between scenes).
- **`ExampleButton`**: the Orbit Burger "Launch order · 12 min" button in two states, `state: 'main' | 'change'` (Nova 500 / radius 8 vs Nova 600 / radius 24), reading the example token set of 105; **large text** (19 px bold) so the brand orange passes 4.5:1 in both states. With a `label` ("main" muted, "this change" in `action.text`). Two of them side by side are scene 02; they stack on phones under 560 px.
- **`TokenRows`**: a short list of token rows on the Orbit Burger surface (swatch, name, value in mono; 13 px, 16/18 px padding, 18 px between rows), edited rows with the new value in Nova and a dashed `action.bg` outline at 4 px offset.
- **`Checks`**: the check list (lint passed, diff pending) on `bg.surface` with a `border.default` hairline, and the approve action in `action.text` with the action foreground (AAA in both themes).
- **`Facts`**: four big words (26 px, 30 px on desktop) each under a 1.5 px `border.strong` rule, one muted line beneath; four columns on desktop, two on tablet, a list on phones; no glyphs.
- Retire `DiffCard` from the landing page (keep its docs page and story until TICKET-109) and the `Redline` from the scenes.

Rules: token variables only; no borders except the ones named here; no shadows except the focus ring; the guards in `components.test.ts`, `stories.test.ts` and the contrast test of 110 must pass.

## Acceptance criteria

- [ ] Seven components with docs pages and stories; `dta diff --list` shows the new stories
- [ ] Phone width checked (390 px, no horizontal scroll) for each
- [ ] Every story passes the contrast test (110) in both themes
- [ ] All gates pass plus the site job, and the GitHub run is green
