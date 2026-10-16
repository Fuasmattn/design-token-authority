# CLAUDE.md — figma-variables-style-dictionary

This file provides context and working instructions for Claude Code when working on this project.

---

## Project vision

The goal is a **whitelabel design token pipeline tool** that:

- Syncs design tokens bi-directionally between Figma (Variables API) and JSON files
- Converts tokens to multiple output targets: CSS, Tailwind v3/v4, iOS Swift, Android XML/Compose
- Auto-discovers the structure of any Figma variable setup (multi-brand, responsive layers)
- Is configurable per-project via a `dta.config.ts` file, not hardcoded

All planned work is tracked as tickets in `docs/tickets/`. Start with `docs/tickets/000-index.md` for an overview and recommended implementation order.

**User documentation lives on the website** (`site/src/content/docs/`: Start, Guides, Reference, Contribute); the README is only pitch, quick start and links. Update the docs pages with every user-visible change, and copy command output from real runs on the fixtures. The Commands and Configuration reference pages, the published JSON Schemas and `llms.txt` are generated at site build (`site/scripts/generate-reference.ts`) from the CLI's `--help` and the config schema: change the code (option descriptions, `.describe()` on config keys), never the generated files.

---

## Architecture — the 3-layer token model

This project uses a layered design token architecture. Each layer is a Figma variable collection:

```
Primitives (Global)       raw values only — colors, sizes, no aliases
        ↓  aliased by
Brand (Alias)             semantic tokens — one mode per brand (BrandA, BrandB, …)
        ↓  overridden by
ScreenType                responsive overrides — one mode per breakpoint (Desktop, Tablet, Mobile)
```

- **Primitives** have a single mode and contain only raw values (hex colors, px numbers).
- **Brand** has one mode per brand; almost all values are aliases into Primitives.
- **ScreenType** has one mode per breakpoint; overrides spacing and typography.

Understanding this layering is critical for any work on autodiscovery, output generation, or linting.

---

## Token file format

Files follow the **W3C Design Token Community Group (DTCG) draft spec** with Figma extensions:

```json
{
  "Colors": {
    "Brand": {
      "Primary": {
        "$type": "color",
        "$value": "#003f8a",
        "$description": "Primary brand color",
        "$extensions": {
          "com.figma": {
            "hiddenFromPublishing": false,
            "scopes": ["ALL_SCOPES"],
            "codeSyntax": {}
          }
        }
      }
    }
  }
}
```

- Keys `$type`, `$value`, `$description`, `$extensions` are W3C DTCG.
- The `com.figma` extension namespace preserves Figma-specific metadata.
- Aliases use dot-notation: `{Colors.Foundation.Blue.700}` (Figma uses `/` paths; conversion happens in export/import).
- Token types: `color`, `number`, `string`, `boolean`.

**One file per collection + mode.** Filename format: `{CollectionName}.{ModeName}.json`
Example: `Brand(Alias).BrandA.json`, `ScreenType.Desktop.json`

---

## Source code structure

All code lives in `packages/*` (pnpm workspace). `dta` and `design-token-authority` start `packages/cli`:

```
packages/
  core/      token model, parse/serialize, resolve, graph, structure analysis, color
  figma/     Figma REST client, variables ⇄ model, push planning, plugin-export importers
  build/     CSS, JS, Tailwind v3/v4 outputs
  lint/      lint rules and config
  visual-diff/  dta diff engine: token change sets, screenshots compared, changes explained by token
  cli/       commands (pull, push, build, lint, graph, analyze, clean, init, diff), config loader, UI
  testkit/   private test helpers: Figma fake, snapshot capture
bin/dta.js   binary entry (runs packages/cli/src/bin.ts through tsx)
site/        the DTA website (private workspace app); site/tokens = DTA Drafting Table tokens, built with dta build
actions/     GitHub composite actions for dta diff (run, report, approve), example workflows, publish recipes
scripts/     snapshot recorder, Figma recording/schema tools, guardrails
test/        fixtures, Figma recordings, reference snapshots
```

The v1 tree (`src/`) was removed in TICKET-039; `docs/tickets/039-legacy-removal.md` records where each v1 behaviour went.

---

## Key conventions

### Alias format

- **In JSON token files:** `{Group.SubGroup.Token}` (dot-separated)
- **In Figma:** `Group/SubGroup/Token` (slash-separated)
- Conversion happens in `@dta/figma`: `variablesToModel` (Figma → JSON) and `planPush` (JSON → Figma)

### Variable uniqueness assumption

Push planning (`@dta/figma`) and alias resolution (`@dta/core`) assume variable names are unique across all collections. This assumption enables alias resolution without needing collection-qualified names. Do not break this.

### Conservative sync

The push direction (`dta push`) **never deletes** variables from Figma. It only creates new ones or updates existing ones. Deletion is intentionally out-of-scope for the push command (see TICKET-021 for `prune`).

### Push confirmation

`dta push` requires users to type `push variables to figma` to confirm before modifying the Figma file. This can be bypassed with `--yes` on the CLI or `push.skipConfirmation: true` in `dta.config.ts`.

### TypeScript imports

Source files use `.js` extensions in imports (e.g. `import { parseColor } from './color.js'`) despite being `.ts` files. This is required for ESM compatibility with `tsx` (which is also why `bin/dta.js` registers tsx). Do not change this pattern.

---

## Development workflow

### Environment setup

Copy `.env.example` to `.env` and fill in:

```
FIGMA_PERSONAL_ACCESS_TOKEN=   # Generate at figma.com > Settings > Personal access tokens
FIGMA_FILE_KEY=                # From Figma file URL: figma.com/file/<FILE_KEY>/...
```

### Available commands

```bash
pnpm dta pull            # Pull variables from Figma → tokens/
pnpm dta push            # Push tokens/ → Figma (typed confirmation required)
pnpm dta push --yes      # Push without confirmation (CI/automation)
pnpm dta build           # Generate CSS + JS from tokens/
pnpm dta clean           # Remove all token files and build output
pnpm dta analyze         # Inspect Figma file structure
pnpm dta graph           # Token dependency graph (console summary)
pnpm dta graph --format html   # Interactive HTML visualization
pnpm dta init            # Interactive project setup wizard
pnpm dta diff --tokens-only            # Token changes vs the merge base with main
pnpm dta diff --base <ref|dir> -f markdown   # ...against another base, as markdown
pnpm dta diff --list                   # Stories dta diff would render (diff section in the config)
pnpm dta diff                          # Tokens + screenshots of base and head (needs playwright-core + Chromium; report in .dta/diff)
pnpm dta diff --publish "<command>"    # ...then run a publish hook on the report folder (prints its URL); --from-report reuses the last report
pnpm site:dev                  # Website (Astro + Starlight) on its DTA-built tokens
pnpm site:build                # Website build incl. link check (CI job "site")
pnpm test                      # Run Vitest (all packages, scripts)
pnpm typecheck                 # Typecheck all packages and scripts
pnpm prettier:check            # Check code formatting
pnpm snapshot:check            # CLI output against the reference snapshots
pnpm snapshot:record --scenario <fixture>/<scenario>   # intentional output change only
```

### Figma plan requirements

The Figma Variables **REST API** (`/v1/files/:key/variables/local`) is **only available on Enterprise plans**. Professional and Organization plans receive a 403 error.

**For non-Enterprise plans**, use the `--from-file` flag to import tokens exported from Figma via a plugin:

```bash
pnpm dta pull --from-file <exported.json>
```

**Where the file comes from is up to you.** DTA does not depend on any plugin. It accepts its own documented per-mode DTCG format (`{Collection}.{Mode}.json`, JSON Schema in `docs/token-files/token-file.schema.json`) and converts a few known third-party exports through small adapters (currently tokenHaus). See the website's [Token files](site/src/content/docs/reference/token-files.mdx) reference for the format and for ways to obtain it.

**Outlook:** Figma announced native variable export/import aligned with the [W3C Design Tokens Community Group spec](https://tr.designtokens.org/format/) at [Schema 2025](https://figma.obra.studio/design-tokens-community-group-w3c-release/). This is gradually rolling out and expected to be fully available by late 2026. Once available, `dta pull --from-file` will work directly with Figma's native export.

The `dta init` wizard asks which Figma plan you have and adjusts the setup flow accordingly.

## Known tech debt

These are tracked as tickets — do not work around them, fix them at the source:

| Issue                                              | Ticket     |
| -------------------------------------------------- | ---------- |
| `meta.Mode1.json` uses Figma default mode name     | TICKET-006 |

---

## Testing

- Framework: Vitest (one project per package, plus `site` and `scripts/guardrails`)
- Test files live alongside source (`packages/*/src/**/*.test.ts`); CLI-level tests in `packages/cli/test/`, testkit tests in `packages/testkit/test/`
- Run: `pnpm test`
- When adding new source files, add a corresponding `*.test.ts`

---

## Code style

- **Formatter:** Prettier (config in `.prettierrc`)
  - No semicolons, single quotes, trailing commas, 100-char line width
- **TypeScript:** strict mode, ESNext modules, target ES2015
- **No `any`** unless genuinely unavoidable — prefer `unknown` and narrow
- Imports use `.js` extension (ESM requirement with tsx)
- Run `pnpm prettier:check` before committing; CI enforces it

---

## CI / GitHub Actions

- `.github/workflows/test.yml` — runs on every push: prettier check + typecheck + package-boundary check + vitest + snapshot check (pnpm, Node from .nvmrc); a second job builds the website (`pnpm site:build`), a third runs the `dta diff` end-to-end test with Chromium (`DTA_E2E=1`)

CI needs no Figma secrets (Figma is faked from `test/recordings/`). Locally the variable is `FIGMA_PERSONAL_ACCESS_TOKEN`.

---

## Token Engine Overhaul (Phase 8) — read before touching code

The project was rewritten package by package (strangler); parity is reached and the v1 tree is gone (TICKET-039). Epic 7 (docs site) and Epic 8 (visual-diff) follow. Background: [spec](docs/specs/token-engine-overhaul.md), [ADR 0001](docs/adr/0001-strangler-rewrite.md), [ADR 0002](docs/adr/0002-pnpm-monorepo-single-cli.md). Tickets 033+ in `docs/tickets/000-index.md` (Phase 8). Work one ticket at a time; open feature tickets wait until parity.

**Rules**

- Packages (`@dta/core`, `@dta/figma`, `@dta/build`, `@dta/lint`, `@dta/visual-diff`, `@dta/cli`, `@dta/testkit`) expose a small public API through their entry point. Import other packages only by name (`@dta/core`), never `@dta/core/src/...` or `../../core/...`. `pnpm run guardrails:boundaries` checks this.
- `@dta/core` depends on no other `@dta/*` package. Only `@dta/cli` is user-facing; `@dta/testkit` is private and dev-only.
- Don't commit or push without the maintainer's explicit go-ahead.
- Never use real customer brand names in files; use BrandA/BrandB. Say "snapshot", not "golden".

**Test seams**

- Package seam (primary): test each package through its public API only, with thorough tests inside the package.
- CLI seam: `test/snapshots/` holds reference snapshots of the CLI on `test/fixtures/*` (recorded from v1 to prove parity). A failing snapshot means the output changed: fix the code, never "re-record to pass". An intentional output change is re-recorded with `pnpm snapshot:record --scenario <fixture>/<scenario>` (every scenario named, no record-all) and reviewed as a snapshot diff in the same PR.
- Figma boundary: use `startFigmaFake` from `@dta/testkit` with `test/recordings/`; CI needs no Figma secrets. Real-Figma check: `docs/testing/figma-smoke-test.md`.

**Gates every ticket must pass** (same as CI)

```bash
pnpm run prettier:check
pnpm run typecheck
pnpm run guardrails:boundaries
pnpm test
pnpm run snapshot:check
```

---

## Tickets and planned work

All feature work is documented in `docs/tickets/`. Each ticket has:

- Summary, background, acceptance criteria
- Concrete implementation notes with code sketches
- Dependencies on other tickets

**Always check the index before starting new work:** `docs/tickets/000-index.md`

Next up: Epic 7 (docs site) and Epic 8 (visual-diff) in Phase 8 of the index; the open feature tickets of Phases 1–7 come after.
