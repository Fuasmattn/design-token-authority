# `dta diff` result (`dta.diff/1`)

`dta diff` writes `result.json` to its report folder (default `.dta/diff/`) and prints the same document with `--format json` when stories were rendered. [`result.schema.json`](./result.schema.json) is its JSON Schema (draft 2020-12), generated from `diffResultSchema` in `@dta/visual-diff` with `pnpm run schema:generate`; a test fails when it is out of date.

Within version `dta.diff/1` fields are only added. A change that removes or renames a field, or changes its meaning, bumps the version.

## Top level

| Field     | Meaning                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `schema`  | Always `"dta.diff/1"`                                                                                      |
| `base`    | How the base was chosen, e.g. `merge base with origin/main (1a2b3c4)`                                      |
| `verdict` | `pass` (nothing to look at), `review` (explained or new changes), `fail` (unexplained above the threshold) |
| `review`  | The changes grouped by cause (below)                                                                       |
| `tokens`  | `counts` and `changes` of the token change set (as `dta diff --tokens-only --format json`)                 |
| `stories` | One entry per story and viewport                                                                           |

## Stories

| Field                            | Meaning                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `id`, `title`, `url`, `viewport` | From the stories manifest                                                    |
| `status`                         | `unchanged`, `changed`, `added` or `removed`                                 |
| `ratio`                          | Changed pixels / all pixels (0–1)                                            |
| `changedPixels`                  | Number of changed pixels                                                     |
| `images`                         | `base`, `head` and `diff` PNG paths inside the report folder                 |
| `attribution`                    | Changed stories only: which token changes explain the changed pixels (below) |

`attribution`:

| Field               | Meaning                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `explained`         | Every changed pixel lies in the box of an element a changed token affects                                                                                                                        |
| `tokens`            | Per token change (`id`: `name (Collection · Mode)`): `dependents` (elements), `pixels` it explains, `elements` (up to five labels such as `button.primary`). Pixels may count for several tokens |
| `unexplainedPixels` | Changed pixels no token change explains                                                                                                                                                          |
| `unexplainedRegion` | `{ x, y, width, height }` around them                                                                                                                                                            |
| `ms`                | Time the attribution took for this story                                                                                                                                                         |

## Review

| Field              | Meaning                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changed`          | Changed stories (story × viewport)                                                                                                                         |
| `explained`        | Of those, fully explained by token changes                                                                                                                 |
| `tokens`           | Per token change: `before` / `after`, the `stories` (`id@viewport`) it explains, `needsReview` (one of them changed more than `diff.thresholds.explained`) |
| `unexplained`      | Per unexplained story: `ratio`, `pixels`, `region`, `failing` (more than `diff.thresholds.unexplained`)                                                    |
| `added`, `removed` | Stories only in the head or only in the base                                                                                                               |

With `--fail-on-change`, `dta diff` exits with code 1 unless the verdict is `pass`. Approving a review (a label on the pull request) follows in TICKET-086.
