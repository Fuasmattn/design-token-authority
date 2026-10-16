## dta diff: token changes

Base: `origin/plan/token-engine-overhaul (3f02117)` · **1 changed**

### Changed (1)

| Token | Collection · mode | Before | After |
| --- | --- | --- | --- |
| `action.bg` | Theme · Light | `{blueprint.600}` → `#2f55d4` | `{blueprint.700}` → `#2443ac` |

## dta diff: stories

**Fail: unexplained changes above the threshold** · 9 changed · 6 unchanged · 6 explained by token changes, 3 unexplained

### By token change

- `action.bg` (Theme · Light) `{blueprint.600}` → `#2f55d4` → `{blueprint.700}` → `#2443ac` explains 6 stories: `button--variants@1280`, `button--variants@390`, `redline--radius@1280`, `redline--spacing@1280`, `workflow-rail--default@1280`, `workflow-rail--default@390`

### Unexplained

| Story | Changed pixels | Region | Over threshold |
| --- | --- | --- | --- |
| `chip--states@1280` | 475 (0.046%) | 946×28 at 33,59 | yes |
| `diff-card--review@1280` | 153 (0.69%) | 710×28 at 348,84 | yes |
| `diff-card--blocked@1280` | 153 (0.015%) | 718×28 at 340,84 | yes |

### Stories

| Story | Viewport | Status | Changed pixels | Cause |
| --- | --- | --- | --- | --- |
| `button--variants` | 1280px | changed | 0.61% | `action.bg` |
| `button--variants` | 390px | changed | 1.99% | `action.bg` |
| `chip--states` | 1280px | changed | 0.046% | unexplained |
| `redline--radius` | 1280px | changed | 0.85% | `action.bg` |
| `redline--spacing` | 1280px | changed | 0.021% | `action.bg` |
| `diff-card--review` | 1280px | changed | 0.69% | unexplained (partly `action.bg`) |
| `diff-card--blocked` | 1280px | changed | 0.015% | unexplained |
| `workflow-rail--default` | 1280px | changed | 0.22% | `action.bg` |
| `workflow-rail--default` | 390px | changed | 0.72% | `action.bg` |
