# @dta/visual-diff

The engine behind `dta diff`. Spec: [docs/specs/visual-diff.md](../../docs/specs/visual-diff.md). Internal package: only `@dta/cli` uses it.

It answers "which tokens changed?" (`diffTokens`), "which stories look different?" (`compareStories`, `compareImages`) and "which token change explains it?" (`planReverts`, `attributePixels`, `reviewStories`). `renderReportHtml(result)` renders the review report.

```ts
import { parseTokenFiles } from '@dta/core'
import { diffTokens, renderTokenChangesMarkdown, toJson } from '@dta/visual-diff'

const set = diffTokens(parseTokenFiles(baseFiles).model, parseTokenFiles(headFiles).model)
renderTokenChangesMarkdown(set, { base: 'merge base with main (1a2b3c4)' })
```

`diffTokens(base, head)` is pure and compares per collection, mode and token:

| Kind                | Meaning                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `changed`           | the value (or type) written in this mode differs; colours compare by hex value (`#FFF` = `#ffffff`)                                       |
| `added` / `removed` | the token has a value in this mode on one side only                                                                                       |
| `affected`          | written the same (an alias), but it resolves to a different value; `causes` names the changed, added or removed tokens in its alias chain |

Each change carries `before` / `after` as `{ raw, resolved? }`. A token resolves in its own mode; aliases into other collections read their first mode (as `resolve` in `@dta/core` does). Descriptions and `$extensions` are not compared, they do not change how a token looks.

`toJson` output is versioned by `schema: "dta.diff.tokens/1"`.

## Config and stories

`diffConfigSchema` is the `diff` section of `dta.config.*` (embedded by the CLI):

```ts
diff: {
  build: 'pnpm build',        // builds the static output (base and head, TICKET-082)
  outDir: 'dist',             // where the static output is
  stories: { type: 'static-site', manifest: 'stories/manifest.json' },
  viewports: [1280],          // for stories that suggest none
  threshold: 0,               // changed-pixel ratio that still counts as unchanged
  colorThreshold: 0,          // per-pixel colour tolerance (0 sees every colour step)
  thresholds: { explained: 0, unexplained: 0 }, // review thresholds by cause (below)
  base: 'origin/main',        // optional default for --base
}
```

`readStoriesManifest(json, { viewports })` is the static-site adapter: it reads a `dta.stories/1` manifest (the DTA website writes one at `/stories/manifest.json`) into `StoryRef`s (`id`, `title`, `url`, `viewports`) and returns problems as diagnostics. `readStorybookIndex(json, { viewports, excludeTags, exclude })` is the Storybook adapter (`stories: { type: 'storybook' }`): it reads `index.json` (v4/v5) of a static Storybook build, keeps entries of type `story` (no docs), drops excluded tags (default `skip-dta-diff`) and ids matching `exclude`, and renders each through `/iframe.html?id=<id>&viewMode=story`. Its `StoryRef`s carry `ready`, a JavaScript expression the capture waits for (Storybook's `sb-show-main` body class).

## Comparing stories

`compareStories({ base, head, capture, threshold, colorThreshold })` renders every story of both sides at each viewport through the injected `capture(side, story, viewport)` (the CLI uses headless Chromium) and classifies it as `unchanged`, `changed`, `added` or `removed`. `compareImages(a, b, { colorThreshold })` is the pixel diff (pixelmatch): changed pixels, ratio, and a diff PNG with changes in redline orange.

The colour tolerance defaults to **0**: pixelmatch's usual 0.1 hides a change from one step of a colour scale to the next (blueprint-600 → 700 on the DTA website), which is exactly what token review must see. Anti-aliased pixels are still ignored.

## Explaining changes by token

Element-level attribution by revert ([TICKET-083](../../docs/tickets/083-diff-attribution-spike.md)):

1. `planReverts(set, baseBindings, headBindings)` turns the token change set into CSS that puts each changed, added or removed token (and the `affected` tokens it causes) back to its base value, in the selector the build wrote it under. The bindings come from `cssBindings` in `@dta/build` (the CLI computes them for both sides). Leaves are grouped per collection · mode, so a page tries a group first and splits only groups that change something.
2. In the head page, `DEPENDENTS_SCRIPT` applies each revert and records the elements whose computed style (incl. `::before`/`::after`) or box changes: the token's dependents, with their head and reverted (base) boxes.
3. `attributePixels(mask, width, height, dependents)` maps the changed pixels of the comparison to those boxes (2 px tolerance). A story is **explained** when every changed pixel lies in some dependent's box; otherwise it reports the unexplained pixel count and their bounding region. A pixel may count for several tokens.
4. `reviewStories(results, causes, thresholds)` groups explained stories by token change and lists unexplained ones, with a verdict: `fail` when an unexplained story changed more than `thresholds.unexplained`, else `review` when an explained story changed more than `thresholds.explained` or stories were added or removed, else `pass`.

Attribution is by region: a component change inside an element that a changed token also restyles or moves counts as explained by that token (in the dogfood run, a Chip radius change next to a `space.2` change). Review the token group's samples with that in mind.

Values a build writes out as literals (JS, Tailwind config) or that JavaScript reads at runtime cannot be reverted in CSS; the pixels they change stay unexplained.

`result.json` (`toDiffJson`, schema `dta.diff/1`) is documented in [docs/diff/result.md](../../docs/diff/result.md); its JSON Schema is generated from `diffResultSchema`.

## Report

The CLI writes the report folder (default `.dta/diff/`): `index.html`, `result.json`, `summary.md` and `base/`, `head/`, `diff/` PNGs per story and viewport. Everything links relatively, so the folder opens from disk or from any static host.

- `renderReportHtml(result)` (from a parsed `result.json`): verdict and counts, then explained changes grouped by token change (before → after with swatches, two samples, a contact sheet of the rest), unexplained stories one by one (dashed redline around the region), added and removed stories, a table of all stories and the token changes. Each changed story shows baseline, candidate and diff, and a drag-to-compare slider (a native range input, so it works with the keyboard) with a diff overlay toggle and redline labels naming the tokens on their elements.
- Styled with DTA Drafting Table, the website's design system: `src/report/tokens-css.ts` is built by DTA from `site/tokens` (`pnpm report:tokens`; a site test fails when it is stale). Light by default, Graphite with the system's dark preference or the toggle. Fonts fall back to system fonts (the report ships no font files).
- `renderSummaryMarkdown` writes `summary.md` for a pull-request comment: within GitHub's 65,536-character limit, tables are cut with "… and N more" when needed.
