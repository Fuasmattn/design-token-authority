# TICKET-083: Spike: record which CSS variables each element uses

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** S
**Blocked by:** 082
**Status:** done
**Spec:** [visual-diff](../specs/visual-diff.md) (decision 8, open question 1)

## What to build

A time-boxed spike answers whether DTA can reliably record, per rendered element, which CSS custom properties resolve on it (including inheritance, shorthands, `calc()`), and at what cost. The result is a short write-up in the ticket and a recommendation: element-level or story-level attribution for version 1.

## Acceptance criteria

- [x] Prototype on the website's stories; cases that work and cases that do not, with examples
- [x] Runtime cost per story measured
- [x] Recommendation recorded; 084's acceptance criteria adjusted accordingly
- [x] No production code merged except tests or fixtures that 084 reuses (none merged; the prototype is described below)

## Findings

### Setup

The 10 website stories (`site/dist`, built at d5c70f6), Chromium 1194 through playwright-core, 1280 px, the same deterministic settings as `dta diff`. Three methods were tried:

| Method         | How                                                                                                                                                                                                                                                                                           | Verdict                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **A. Static**  | CDP `CSS.getMatchedStylesForNode` per element; collect `var(--x)` in matched, inline, pseudo-element and inherited declarations; expand chains through custom-property definitions                                                                                                            | Works, but over-counts and is the slowest |
| **B. Perturb** | Set one custom property to a sentinel everywhere (`*, :root { --x: rgb(1,2,3) !important }`), diff `getComputedStyle` of every element and `::before`/`::after`                                                                                                                               | Exact for "uses", but ignores modes       |
| **C. Revert**  | Apply the head; for each changed token, put back its **base** value in its own selector (`[data-brand="light"] { --action-bg: var(--blueprint-600) }`), record which elements' computed style or box changes; map changed pixels to those elements' boxes (head and base box, 2 px tolerance) | **Recommended**                           |

### Accuracy

Simulated change set on the website: `action.bg` (Theme · Light) blueprint-600 → 700 and `space.2` (Primitives) 8 → 12 px.

| Story                                | Changed px | Explained by `action.bg` | Explained by `space.2` | Unexplained |
| ------------------------------------ | ---------: | -----------------------: | ---------------------: | ----------: |
| button--variants                     |      6,516 |       6,107 (2 elements) |                    910 |           0 |
| chip--states                         |      2,380 |                        — |                  2,380 |           0 |
| redline--radius                      |     44,354 |                8,913 (1) |                 44,354 |           0 |
| redline--spacing                     |        211 |                  211 (1) |                      — |           0 |
| diff-card--review                    |     16,313 |                6,771 (1) |                  9,542 |           0 |
| diff-card--blocked                   |      9,601 |                        — |                  9,601 |           0 |
| workflow-rail--default               |      9,323 |                2,245 (1) |                  9,323 |           0 |
| command-button, text-field, terminal |          0 |                        — |                      — |           0 |

Every changed pixel traced to a changed token; stories that do not use either token showed neither pixels nor dependents. With `action.bg` alone (method A/B run), 5,910 of 5,911 changed pixels in button--variants fell inside the boxes of its dependents; the one outside was an anti-aliased edge, which the 2 px tolerance of method C covers.

**What works**

- Chains: `--action-bg: var(--blueprint-600)` on `[data-brand]`, reverted or perturbed at either end (B and C both find the 1–3 elements that use `blueprint-600` through `action.bg`).
- Modes: C reverts only in the changed mode's selector, so the graphite half of each ThemePair is correctly not attributed (B, which perturbs everywhere, counts 4 dependents in button--variants instead of 2).
- `calc()`: `font-size: calc(var(--type-label-size) * 1px)` is found by all three methods.
- Shorthands: `border: var(--stroke-ink) solid var(--border-strong)`, `padding: 0 var(--space-2)`.
- Inheritance: `color: var(--fg-default)` on `body` reaches every text element that does not set its own colour (B/C count them exactly; A over-counts, see below).
- Pseudo-elements: B/C read `::before`/`::after` computed styles.
- Layout moves: when `space.2` grows, elements below move; C compares boxes too, so moved siblings are dependents and their pixels are explained.

**What does not work, or only with care**

- **A over-counts inheritance**: it lists `--font-sans` for all 47 elements of diff-card--review, but 14 set their own `font-family` (mono). Correct inheritance needs a full cascade per property, which is what the browser's computed style already is. A is dropped.
- **Perturbation over-reaches on layout**: perturbing `--space-2` to a sentinel moves almost everything (29 dependents in diff-card--review vs. 2 static declarations). That is fine for explaining pixels, but "uses" and "moved because of" are different; C reports both kinds and 085 can show them apart.
- **Overlapping boxes**: a container whose padding changed covers all pixels inside it, so a pixel can be explained by two tokens (redline--radius: `space.2` covers the `action.bg` pixels too). Attribution is per story and token, not an exclusive pixel partition.
- **Not visible to CSS**: values a build inlines as literals (e.g. `base.css` resolves primitives with `outputReferences: false`; JS output `colorpalette.js`; Tailwind config values) and values JavaScript reads at runtime (canvas, charts) are invisible to B and C. Such pixels stay **unexplained**, which is the honest result. The primitives case is handled by reverting the semantic variables that reference the primitive (DTA knows the alias graph: `affected` entries of the change set).
- **States**: `:hover`/`:focus` rules never match in a static render. The screenshots do not show them either, so there is nothing to explain. Stories that need a state must render it (a forced-state story variant).
- **Shadow DOM, iframes**: not on the website; `querySelectorAll` does not cross them. Out of scope for version 1.
- **Media queries and responsive layers**: the revert rule must use the same selector and `@media` the build wrote. `@dta/build` owns those (`[data-brand="…"]`, `:root`), so 084 asks the build for them rather than parsing CSS.

### Cost

| Step                        | Per story (10 stories, 17–61 elements) |
| --------------------------- | -------------------------------------- |
| A static (CDP, per node)    | 100–360 ms, ~6 ms per element          |
| B one perturbation          | 22–63 ms                               |
| C revert, per changed token | 60–200 ms (two snapshots incl. boxes)  |
| Screenshot (for scale)      | 120–220 ms                             |

C runs only on stories whose pixels changed and only for tokens in the change set, so cost is `changed stories × changed tokens × ~0.1 s`. A 50-token change across 100 changed stories would add about 8 minutes; for large change sets 084 reverts all changed tokens of one collection·mode at once first and splits only when a story is not fully explained by the group (bisection), which keeps the common case at a few reverts per story.

## Recommendation

**Element-level attribution by revert (method C) for version 1**, done in the head page after the screenshot:

1. For each changed story, revert each changed token (or group) in its build selector to its base value, snapshot computed styles and boxes, and collect the dependent elements.
2. A changed pixel is explained when it lies in a dependent's head or base box (2 px tolerance). A story is **explained** when all of its changed pixels are explained, otherwise **unexplained** with the unexplained pixel count and region.
3. Tokens whose CSS variable is not referenced on the page produce no dependents; pixels they cannot explain stay unexplained.

Story-level attribution ("this story uses tokens X, Y") falls out of the same data and is what the report summarises; there is no need for a separate coarse mode. Open question 1 of the spec is settled this way.

### Prototype core (for 084)

```js
// in the head page, after the screenshot
const snapshot = () =>
  [...document.querySelectorAll('body, body *')].map((el) => {
    let style = ''
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo)
      if (pseudo && cs.content === 'none') continue
      for (let i = 0; i < cs.length; i++)
        if (!cs[i].startsWith('--')) style += cs[i] + ':' + cs.getPropertyValue(cs[i]) + ';'
    }
    const r = el.getBoundingClientRect()
    return {
      style,
      box: [r.left + scrollX, r.top + scrollY, r.right + scrollX, r.bottom + scrollY],
    }
  })
// revert: <style>[data-brand="light"] { --action-bg: var(--blueprint-600); }</style>
// dependents = elements whose style or box differs between snapshot() before and after the revert
```
