# Concept notes

Ideas that are not tickets yet. Each note says what the idea is, why it came up and what would have to be true before it becomes a ticket. Written during the landing-page redesign (October 2026).

## The loop has two sides

**What.** The token workflow is not one circle of design → build → verify → decide. It is two sides that meet in a pull request:

- **Design side.** A designer changes a variable in Figma and sees the result at once, in Figma. For the designer, verification of the _design_ is immediate; DTA adds nothing there.
- **Product side.** The code: components, every brand and theme, states nobody drew, places where a value was hard-coded, and increasingly agents writing styles. The designer's change says nothing about this side until it crosses over.
- **The crossing.** `dta pull` (or a token-file edit, or an agent) lands the change in the repository. There DTA checks the structure (`lint`), builds the outputs (`build`), renders the real components before and after and names the token behind each difference (`diff`), and a person decides. A fix goes back to whichever side caused it: a value in Figma, or a component in code (`audit` finds the hard-coded ones). Then around again.

**Why it matters.** The landing page and the docs should not promise designers that they will "see their change": they already do. The promise is _see what your change does to the product that already exists, and keep both sides in step_. Visualisations of the workflow should show two sides and the pull request between them, not a single ring of agile steps.

## Design-implementation parity: Figma renders next to Storybook renders

**What.** A recipe (not a core feature) that puts Figma's rendering of a frame next to the product's rendering of the matching component, at base and head of a change, so a reviewer sees whether the implementation follows the design, not only whether the implementation changed.

**Why it came up.** `dta diff` compares the product with itself over time. It cannot say whether the product matches the design. Teams ask for that, and it is the one check that would close the loop between the two sides above.

**How it could work.**

- Figma side: the Images REST endpoint renders nodes to PNG (`GET /v1/images/:key?ids=…`). Needs a file key, node ids and a token with file access; node ids come from a mapping the team maintains or from a naming convention (frame name = story id).
- Product side: the story screenshots `dta diff` already takes.
- Comparison: side by side in the report, with the same pixel diff and the same token explanation where a token changed; a stated tolerance, because fonts, anti-aliasing and sub-pixel layout differ between Figma and a browser.
- Config: `diff.figma: { fileKey, map: { 'Button/primary': '12:345', … } }` or `mapBy: 'name'`.

**What has to be true first.**

- A frame ↔ story mapping that teams will keep up to date; without it the recipe is noise.
- Honesty about tolerance: parity can only ever be "close enough", never pixel-equal. The report must say so and show the images, not only a percentage.
- It does not apply everywhere: no Storybook, no design frames per component, or components that are composed only in code. It stays a recipe in the guides, opt-in, not a default step.
- Figma plan limits: the Images endpoint works on all plans with a personal access token, unlike the Variables endpoint; worth confirming rate limits for a PR run.

**Not now.** First the landing-page redesign and the npm release. If it becomes a ticket, it belongs to the `dta diff` family (Epic 8) as "diff against design", with its own spec.
