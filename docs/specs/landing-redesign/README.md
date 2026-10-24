# Landing redesign — reference mockups

Throwaway HTML from the design rounds of 2026-10-17. They use literal colours and ad-hoc CSS on purpose: they show the look, not the code. The site itself follows the token and design-system rules in CLAUDE.md.

| File | What it shows |
| --- | --- |
| `page-concept.astro.txt` | The whole page (round 7): hero, four scenes with Orbit Burger, facts, final call to action. Copy is close to final; see the spec for the agreed wording. |
| `loop-path.html` | The two-lane loop with the flat-or-risen animation: the original decisions 3 and 4, **superseded** on 2026-10-18 by the gravity well. Kept as rejected. |
| `loop-finishes.html` | The same diagram in a material finish (A) and the blended finish (B) that was chosen, before the lane lines were removed. |
| `loop-workbench-rejected.html` | The isometric workbench version of the loop, drawn in the style of the HeroBench canvas drafts. Rejected: too much space for one diagram. |

| `prototypes/` | The animated prototypes of 17–18 Oct with their Python generators (seven stations → four stations → exploded token → orbit → the gravity well). **The accepted page is `p17-page.html`** (`python3 gen16.py`; the hero renderer is `gen15.py`, which gen16 builds on, and gen6/7/8 hold the scene styles and copy it reuses). `p16-page.html` is the hero alone. The dead-end iterations between p6 and p16 were deleted; the spec's decisions 3, 4 and 8–11 record what was tried. |

The prototype's control bar (tilt, size, position, x/y) exists to find the defaults and is not part of the design; the chosen setting is tilt 64, size S, position A, x +8, y 0.

Spec: [../landing-redesign.md](../landing-redesign.md).
