# TICKET-081: Stories adapter and the `diff` config section

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** S
**Blocked by:** 070, 080
**Status:** done
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 3, 4)

## What to build

Projects describe what `dta diff` renders in `dta.config.*`: build command, output dir, stories source, viewports, thresholds. The first adapter reads the stories manifest of a static site (the DTA website from 070). `dta diff --list` prints the stories it would render.

## Acceptance criteria

- [x] Config schema gains the `diff` section (validated, documented in the generated reference)
- [x] Adapter interface (list stories → id, URL, viewports) with the static-site adapter; Storybook adapter left as a follow-up ticket
- [x] `--list` works on the website and on a fixture site
- [x] All gates pass, and the GitHub run is green

## Implementation notes

- `diffConfigSchema` lives in `@dta/visual-diff` and is embedded by the CLI config (same pattern as `lintConfigSchema`): `build`, `outDir` (required), `stories` (`type: 'static-site'`, `manifest`, default `stories/manifest.json`), `viewports` (default `[1280]`), `threshold` (0–1, default 0), `base` (default for `--base`).
- The static-site adapter is `readStoriesManifest(json, { viewports })`: validates `dta.stories/1`, falls back to the configured viewports, reports duplicate ids; never throws.
- `dta diff --list` reads the built output only (it does not run `diff.build`); a missing manifest names the build command. Formats: console, markdown, json.
- The website (`site/dta.config.ts`) has a `diff` section; `node ../bin/dta.js diff --list` in `site/` lists its 10 stories.
- "Documented in the generated reference": the schema fields carry descriptions; the reference page itself is generated in TICKET-074.
- Storybook adapter: TICKET-089.
