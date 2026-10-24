# `dta diff` result (`dta.diff/1`)

`dta diff` writes `result.json` to its report folder (default `.dta/diff/`, next to `index.html`, `summary.md` and the PNGs) and prints the same document with `--format json` when stories were rendered. [`result.schema.json`](./result.schema.json) is its JSON Schema (draft 2020-12), generated from `diffResultSchema` in `@dta/visual-diff` with `pnpm run schema:generate`; a test fails when it is out of date.

Within version `dta.diff/1` fields are only added. A change that removes or renames a field, or changes its meaning, bumps the version.

## Top level

| Field     | Meaning                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| `schema`  | Always `"dta.diff/1"`                                                                                                |
| `base`    | How the base was chosen, e.g. `merge base with origin/main (1a2b3c4)`                                                |
| `head`    | What was rendered "with this change" (below). Optional: absent outside git and in results written before TICKET-123  |
| `verdict` | `pass` (nothing to look at), `review` (explained or new changes), `fail` (unexplained above the threshold)           |
| `review`  | The changes grouped by cause (below)                                                                                 |
| `publish` | `{ url, report }` when a publish hook ran: the folder's public URL (image paths resolve against it) and `index.html` |
| `tokens`  | `counts` and `changes` of the token change set (as `dta diff --tokens-only --format json`)                           |
| `stories` | One entry per story and viewport                                                                                     |

## Head

`dta diff` renders the checkout it runs in, including changes not yet committed. `head` records which one, so the report can name both sides ("Before: main · 2ee9b31", "With this change: feature/x · 9f3c1a2"):

| Field         | Meaning                                                                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ref`         | The branch, without `refs/heads/` (`feature/x`). Absent on a detached HEAD, as in most CI checkouts of a pull request                                                                                 |
| `sha`         | The full commit hash HEAD pointed at                                                                                                                                                                  |
| `uncommitted` | `true` when the repository had uncommitted changes when the run started: any edited, staged or untracked file that is not ignored, anywhere in the repository (not only in the paths the stories use) |

The report shows it as `feature/x · 9f3c1a2`, `9f3c1a2` when detached, with `+ uncommitted changes` when `uncommitted` is true, and "working tree" when `head` is absent.

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

| Field               | Meaning                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `explained`         | Every changed pixel lies in the box of an element a changed token affects                                                                                                                                                                              |
| `tokens`            | Per token change (`id`: `name (Collection · Mode)`): `dependents` (elements), `pixels` it explains, `elements` (up to five labels such as `button.primary`), `regions` (up to five of their boxes, largest first). Pixels may count for several tokens |
| `unexplainedPixels` | Changed pixels no token change explains                                                                                                                                                                                                                |
| `unexplainedRegion` | `{ x, y, width, height }` around them                                                                                                                                                                                                                  |
| `ms`                | Time the attribution took for this story                                                                                                                                                                                                               |

## Review

| Field              | Meaning                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changed`          | Changed stories (story × viewport)                                                                                                                         |
| `explained`        | Of those, fully explained by token changes                                                                                                                 |
| `tokens`           | Per token change: `before` / `after`, the `stories` (`id@viewport`) it explains, `needsReview` (one of them changed more than `diff.thresholds.explained`) |
| `unexplained`      | Per unexplained story: `ratio`, `pixels`, `region`, `failing` (more than `diff.thresholds.unexplained`)                                                    |
| `added`, `removed` | Stories only in the head or only in the base                                                                                                               |

With `--fail-on-change`, `dta diff` exits with code 1 unless the verdict is `pass`. Approving a review (a label on the pull request) follows in TICKET-086.
