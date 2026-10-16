# @dta/visual-diff

The engine behind `dta diff`. Spec: [docs/specs/visual-diff.md](../../docs/specs/visual-diff.md). Internal package: only `@dta/cli` uses it.

So far it answers "which tokens changed between two token sets?". Rendering stories, pixel diffs and attributing visual changes to tokens follow in tickets 081–085.

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
