# Spec: Landing page redesign — one story, quietly told

**Status:** approved (2026-10-17, after seven mockup rounds with the maintainer)
**Depends on:** [docs-site](./docs-site.md) (site, tokens, design system), [agent-interop](./agent-interop.md) (the commands the page shows), [TICKET-090](../tickets/090-first-npm-release.md) (`npm create dta` works as written)
**Replaces:** the landing layout of TICKET-071/096/098/099 (hero + problem + how + workflow + agents + trust + cards)
**Reference mockups:** [`landing-redesign/`](./landing-redesign/) (throwaway HTML, literal colours; the look, not the code)

## Why

The current page lists things: three numbered problems, five numbered steps, three numbered points, three more. Restyling the lists did not help (five variants tried); the research behind the redesign ([Evil Martians, 100 dev-tool landing pages](https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025)) ranks plain feature lists as the weakest way to present a tool and favours a problem-led story shown through the product itself. Two more findings shaped the result:

1. **Designers already see their change in Figma.** The page must never promise "see your change". The promise is: see what your change does to the product that already exists, and keep design and product in step. (See [concept-notes](./concept-notes.md), "The loop has two sides".)
2. **The abstraction was the problem, not the palette.** The diff card (three blocks: baseline, candidate, diff) had to be decoded. A concrete component before and after, with the token named on it, needs no decoding.

## The page

Hero → the loop → one change in four scenes → facts → final call to action. Everything else goes.

1. **Hero.** The live headline stays, with the type-cycling "agents." and the current subline. Two actions: `npm create dta` (CommandButton) and "Read the quick start" (outline). No visual in the hero: the loop below is the first picture.
2. **The loop** (first section). Heading: _Design on one lane, product on the other._ One paragraph: designers see their change in Figma at once; what they cannot see is what it does to the product; DTA sits where the two meet and sends each fix back to the side that caused it. The diagram is the **two-lane path** (decision 3).
3. **One change, four scenes.** Each scene: a numbered kicker, one heading, one short paragraph, the command, and one example embedded in the canvas (no border, no card chrome). Examples are **Orbit Burger** (decision 2).
   - 01 _Something changes_ — "A change lands as a pull request." Token rows with two edited values. `dta pull`.
   - 02 _The pull request shows the differences_ — "There are differences to review. DTA knows whether tokens caused them." The Orbit Burger card before and after (radius 8 → 24, obvious; brand colour 500 → 600, easy to miss), two lines underneath: which token caused what share of the differences. `dta diff`.
   - 03 _A person decides_ — "Approve by token, not by screenshot." Checks (lint passed, diff pending) and the approve action. `dta build`.
   - 04 _Your agent uses the same commands_ — "It looks the token up before it writes a value." Real `dta token find` and `dta audit` output. `dta skill add`.
4. **Facts.** Four short lines, no boxes: open source; your structure (DTCG); every Figma plan; deterministic.
5. **Final call to action.** "Start with one command." and `npm create dta`. No dark band: the page stays on one surface.

Nothing numbered beyond the scene kickers. No FAQ, no cards, no "why trust it", no bento.

## Decisions

1. **Quiet surface.** One background. Examples sit on it as soft shapes (`--bg-surface`) without borders; dark objects are only the terminal and the Orbit Burger cards. White space roughly doubles against the current page (`--space-36` between scenes).

2. **Orbit Burger** is the example product: a space burger delivery app. Deep-violet surfaces, a mint accent, "Nova" orange for the brand colour, a CSS-drawn burger with dashed orbit rings, copy such as "Saturn Smash · Double patty, ring sauce, zero-g pickles · Launch order · 12 min". The palette is deliberately not ours, so examples read as a customer's UI, never as part of the page. Per the site rule (no colour literals), its colours become an **example token collection** built with `dta build` like the rest (TICKET-105); and the example becomes a **real fixture with stories**, so the numbers on the page come from a real `dta diff` run, not from copy.

3. **The loop is a two-lane path, not a circle and not a workbench.** Design lane above, product lane below, pull-request nodes between them; time runs left to right, so iteration is visible as the path bouncing (change → PR → story shows a difference → fix back to design → PR → approved → outputs rebuilt). No lane lines: every node is a label that names its side ("Figma · Nova 500 → 600", "story · button darker", "product · outputs rebuilt"), so the diagram also works cropped and on phones. The isometric workbench version was drawn and rejected for taking too much space; it stays in the reference folder.

4. **Flat or risen.** The diagram's motion is in the shadows and has two states only. At rest every label is plain text on the surface. The one node the change has reached lifts (3 px) with the soft double shadow (dark lower-right, light upper-left) and settles back when the change moves on. No pressed or inset state. The path draws itself one segment ahead of the capsule; the return to design draws in signal red; a red capsule with a faint halo travels the path and rests about 6 % of the cycle at each of the seven stations (one cycle ≈ 14 s, ease-in-out on arrival, linear in between). `prefers-reduced-motion`: the full path drawn, everything flat, no capsule. Hover pauses.

5. **Honesty rule, unchanged.** Every command on the page exists (`landing.test.ts` checks against `COMMAND_NAMES`); `npm create dta` is shown unmarked by maintainer decision (098); outputs shown as real are real (the agent scene; the diff numbers once the fixture exists); illustrative text is labelled.

6. **Design system first.** New UI becomes components under `site/src/components/ds` with a docs page and stories before the page uses them (CLAUDE.md rule): `Scene`, `ExampleCard` (Orbit Burger, before/after), `TokenRows`, `Checks`, `LoopPath`. The current `DiffCard` is retired from the landing page (kept for the design-system docs until the diff report moves, TICKET-109).

7. **The diff report follows.** The before/after presentation (rendered story with the changed region outlined in signal red and the token callout on the change) replaces the three-thumbnail row in the `dta diff` report in a later ticket (TICKET-109); the landing page does not wait for it.

## Status note (2026-10-18)

The prototype session after approval changed the direction of decisions 3 and 4: the loop becomes an **orbit-inspection key visual in the hero** (a token crosses into the pull request, is taken apart as shapes, sends a finding to the side that can fix it, ships), and the separate loop section goes. Decisions below are kept as approved until the fine-tuning round is done; see [landing-redesign/HANDOFF.md](./landing-redesign/HANDOFF.md) for what will change and why.

## Open items (not blocking)

- A figure for the hero was wanted earlier (the workbench, the mascot). The redesign has no hero visual on purpose; revisit after launch.
- Figma-render vs Storybook parity: future recipe, see [concept-notes](./concept-notes.md).

## Tickets

[105](../tickets/105-orbit-burger-example.md) · [106](../tickets/106-landing-components.md) · [107](../tickets/107-loop-path-diagram.md) · [108](../tickets/108-landing-rebuild.md) · [109](../tickets/109-diff-report-before-after.md)

Order: 105 → 106 → 107 → 108 (109 later, independent).
