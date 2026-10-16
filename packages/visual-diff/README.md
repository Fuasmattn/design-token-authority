# @dta/visual-diff

The engine behind `dta diff`. Spec: [docs/specs/visual-diff.md](../../docs/specs/visual-diff.md). Internal package: only `@dta/cli` uses it.

It answers "which tokens changed?" (`diffTokens`) and "which stories look different?" (`compareStories`, `compareImages`). Attributing visual changes to tokens follows in 083/084, the HTML report in 085.

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
  base: 'origin/main',        // optional default for --base
}
```

`readStoriesManifest(json, { viewports })` is the static-site adapter: it reads a `dta.stories/1` manifest (the DTA website writes one at `/stories/manifest.json`) into `StoryRef`s (`id`, `title`, `url`, `viewports`) and returns problems as diagnostics. A Storybook adapter follows (TICKET-089).

## Comparing stories

`compareStories({ base, head, capture, threshold, colorThreshold })` renders every story of both sides at each viewport through the injected `capture(side, story, viewport)` (the CLI uses headless Chromium) and classifies it as `unchanged`, `changed`, `added` or `removed`. `compareImages(a, b, { colorThreshold })` is the pixel diff (pixelmatch): changed pixels, ratio, and a diff PNG with changes in redline orange.

The colour tolerance defaults to **0**: pixelmatch's usual 0.1 hides a change from one step of a colour scale to the next (blueprint-600 → 700 on the DTA website), which is exactly what token review must see. Anti-aliased pixels are still ignored.
