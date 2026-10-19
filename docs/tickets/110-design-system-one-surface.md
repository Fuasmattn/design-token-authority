# TICKET-110: Design system: one surface, the well's tokens, command chips, AAA

**Phase:** 10 — Landing redesign
**Priority:** High
**Effort:** M
**Blocked by:** —
**Status:** open
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decisions 8, 9, 11); accepted prototype `docs/specs/landing-redesign/prototypes/p17-page.html`

## Why

The key visual changed the page's ground: no grid paper, one plain surface, a gravity well in the hero, commands as copyable chips, every text pair AAA. The design system (DTA Drafting Table, `site/tokens` + `site/src/components/ds` + the design-system docs) describes the old ground. This ticket updates the system first, so the landing components (106, 107) and the page (108) are built on it rather than around it.

## What to build

### Tokens (`site/tokens`, built with `dta build`; `pnpm report:tokens` after)

- **Contrast.** `fg.muted` aliases a darker ink in `Theme.Light` so that it reaches 7:1 on `bg.canvas` (the prototype uses `#3E4860`-class ink, 8.1:1; pick the nearest primitive or add `ink.750`). Graphite already passes (9.5:1). Check `fg.subtle` is not used for text anywhere on the landing page (it was the footer's colour at 2.3:1; the footer moves to `fg.muted`).
- **The well.** A `well` group in both themes: `well.throat` (the colour the mesh darkens to toward the mouth: near-black, `#070b16` light / `#000` dark in the prototype), `well.mouth` (the other theme's ground: Graphite's canvas in Light, paper in Graphite), `well.glow` (the mouth's rim, the action colour at a lighter step), `well.line` (the mesh ink, usually `fg.default`), and the object faces: `well.object.orange` (three faces: `signal` steps), `well.object.blue` (`blueprint` steps), `well.object.ink` (`ink` steps) plus a highlight for the spheres. The orbit rings use existing tokens (`border.default` outer, `action.bg` inner).
- **Command chip.** Reuse the terminal tokens (`terminal.bg`, `terminal.fg`, `terminal.prompt`); if the prompt needs its own step for 7:1 on `terminal.bg` (the prototype lightened it to 8.7:1), move `terminal.prompt` up a step and `success.fg` on the terminal likewise (9.3:1).
- **Rule strong for chips.** The outline button and the control bar use a 1.5 px `border.strong` at reduced strength in the prototype (`--rule-strong`); decide whether `border.strong` stays full ink (then the outline button uses it as is) or a `border.emphasis` step is added. Do not add a shadow token: the only `box-shadow` remains the focus ring.

### Principles and docs (`site/src/content/docs/design-system/`)

- Rewrite principle 4 ("Paper you can measure on"): the grid is no longer the page's ground. One plain surface; `bg-grid` is kept only where something is literally inspected (preview panes, the diff report's thumbnails), never as a page or section background.
- Add a principle for the well (decoration, not diagram: it labels nothing, the copy carries the story) and one for contrast (AAA for text, 3:1 for edges, measured over the effective background).
- Extend the voice section: commands are shown as **chips you can copy** (`$` prompt, mono, copy icon → tick), the same component everywhere.
- Update the colour token page with the `well` group and the changed aliases; the tokens pages are generated from the files, so this is mostly the prose.

### Guards (`site/src`)

- A contrast test over the **rendered** landing page and the stories (Playwright, both themes, 1280 and 390 px): walk every text node, compute the effective background (nesting and opacity), require 7:1 (4.5:1 at ≥ 24 px or ≥ 18.66 px bold). The prototype's audit (`docs/specs/landing-redesign/prototypes/gen16.py` has the values it was tuned to) is the reference; the site version runs under `DTA_E2E=1` with the existing Chromium job.
- `components.test.ts`: keep "no colour literals" and "borders, not shadows"; add "no `bg-grid` outside the preview components" once 108 removes `.grid-paper`.

## Acceptance criteria

- [ ] Token files lint clean; `dta build` output used by the site; `pnpm report:tokens` run and committed
- [ ] Every current landing page and story text pair passes the new contrast test in both themes (fix what fails: it is the design system's job, not the page's)
- [ ] Design-system docs: principles 4 (rewritten), well, contrast; voice: command chips
- [ ] All gates pass plus the site job, and the GitHub run is green
