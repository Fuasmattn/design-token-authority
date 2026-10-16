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

**Active code lives in `packages/*`** (all commands are ported; `dta` and `design-token-authority` start `packages/cli`):

```
packages/
  core/      token model, parse/serialize, resolve, graph, structure analysis, color
  figma/     Figma REST client, variables ⇄ model, push planning, plugin-export importers
  build/     CSS, JS, Tailwind v3/v4 outputs
  lint/      lint rules and config
  docs/      docs-site HTML generator
  cli/       commands (pull, push, build, lint, graph, analyze, clean, init), config loader, UI
  testkit/   private test helpers: Figma fake, snapshot capture
bin/dta.js   binary entry (runs packages/cli/src/bin.ts)
```

The `src/` tree below is the **frozen legacy reference** that `pnpm snapshot:check` still records from. TICKET-039 deletes it.

```
src/
  cli.ts                CLI entrypoint (design-token-authority / dta)
  analyze.ts            Figma structure autodiscovery — analyzeCollections()
  figma_api.ts          Figma REST API wrapper — getLocalVariables(), postVariables()
  token_types.ts        TypeScript interfaces: Token, TokensFile, TokenOrTokenGroup
  token_export.ts       Figma API response → token JSON files (export direction)
  token_import.ts       Token JSON files → Figma API POST payload (import direction)
  color.ts              Color utilities: parseColor(), rgbToHex(), colorApproximatelyEqual()
  utils.ts              Console color helpers, areSetsEqual()
  config/
    schema.ts           Config type definitions + validation (dta.config.ts)
    loader.ts           Runtime config file loader
    index.ts            Public re-exports
  graph.ts              Token dependency graph: build, analyze, detect cycles/dangling/orphans, visualize
  commands/
    pull.ts             dta pull
    push.ts             dta push
    build.ts            dta build
    clean.ts            dta clean (remove tokens + output)
    init.ts             dta init (wizard)
    analyze.ts          dta analyze
    graph.ts            dta graph (dependency analysis + visualization)
  importers/
    tokenhaus.ts        tokenHaus plugin export → per-mode token files
    detect.ts           Auto-detect import file format (tokenhaus vs dtcg-per-mode)
    index.ts            Public re-exports
  formatters/
    tailwind-v3.ts      Tailwind v3 theme.extend formatter
    tailwind-v4.ts      Tailwind v4 @theme CSS formatter
  *.test.ts             Vitest tests alongside source files
```

---

## Key conventions

### Alias format

- **In JSON token files:** `{Group.SubGroup.Token}` (dot-separated)
- **In Figma:** `Group/SubGroup/Token` (slash-separated)
- Conversion happens in `token_export.ts` (Figma → JSON) and `token_import.ts` (JSON → Figma)

### Variable uniqueness assumption

`token_import.ts` assumes variable names are unique across all collections. This assumption enables alias resolution without needing collection-qualified names. Do not break this.

### Conservative sync

The push direction (`dta push`) **never deletes** variables from Figma. It only creates new ones or updates existing ones. Deletion is intentionally out-of-scope for the push command (see TICKET-021 for `prune`).

### Push confirmation

`dta push` requires users to type `push variables to figma` to confirm before modifying the Figma file. This can be bypassed with `--yes` on the CLI or `push.skipConfirmation: true` in `dta.config.ts`.

### TypeScript imports

Source files use `.js` extensions in imports (e.g. `import { rgbToHex } from './color.js'`) despite being `.ts` files. This is required for ESM compatibility with `tsx`. Do not change this pattern.

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
pnpm test                      # Run Vitest (legacy + all packages)
pnpm typecheck                 # Typecheck legacy + all packages
pnpm prettier:check         # Check code formatting
```

### Figma plan requirements

The Figma Variables **REST API** (`/v1/files/:key/variables/local`) is **only available on Enterprise plans**. Professional and Organization plans receive a 403 error.

**For non-Enterprise plans**, use the `--from-file` flag to import tokens exported from Figma via a plugin:

```bash
pnpm dta pull --from-file <exported.json>
```

**Where the file comes from is up to you.** DTA does not depend on any plugin. It accepts its own documented per-mode DTCG format (`{Collection}.{Mode}.json`, JSON Schema in `docs/token-files/token-file.schema.json`) and converts a few known third-party exports through small adapters (currently tokenHaus). See [docs/token-files/input-format.md](docs/token-files/input-format.md) for the format and for ways to obtain it.

**Outlook:** Figma announced native variable export/import aligned with the [W3C Design Tokens Community Group spec](https://tr.designtokens.org/format/) at [Schema 2025](https://figma.obra.studio/design-tokens-community-group-w3c-release/). This is gradually rolling out and expected to be fully available by late 2026. Once available, `dta pull --from-file` will work directly with Figma's native export.

The `dta init` wizard asks which Figma plan you have and adjusts the setup flow accordingly.

### Build pipeline (current, pre-v4)

`pnpm build` runs `removedollarsigns.sh` (strips `$` from token keys) then `style-dictionary build`.
⚠️ This mutates token files. After a build run, token files may have `type`/`value` instead of `$type`/`$value`.
**This will be fixed by TICKET-002 (upgrade to Style Dictionary v4).**

---

## Known tech debt

These are tracked as tickets — do not work around them, fix them at the source:

| Issue                                              | Ticket                   |
| -------------------------------------------------- | ------------------------ |
| Credentials in `.env` committed to git             | TICKET-001               |
| Style Dictionary v3 (use v4)                       | TICKET-002               |
| `removedollarsigns.sh` mutates source files        | TICKET-002 (fixed by v4) |
| CSS blur/opacity values missing units              | TICKET-003               |
| Redundant segment names in CSS vars (`blur-blur-`) | TICKET-004               |
| Inconsistent env var names across local and CI     | TICKET-005               |
| `meta.Mode1.json` uses Figma default mode name     | TICKET-006               |

---

## Testing

- Framework: Vitest
- Test files live alongside source: `color.test.ts`, `token_export.test.ts`, `token_import.test.ts`, `config/schema.test.ts`, `analyze.test.ts`, `cli.test.ts`, `commands/init.test.ts`, `graph.test.ts`
- Run: `pnpm test`
- Coverage: color parsing, export conversion, import payload generation, alias resolution, edge cases
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

- `.github/workflows/test.yml` — runs on every push: prettier check + typecheck + package-boundary check + vitest + snapshot check (pnpm, Node from .nvmrc)
- `.github/workflows/guardrails.yml` — on pull requests: fails if legacy `src/` changes (unless labeled `legacy-exception`)

CI secret name: `FIGMA_PERSONAL_ACCESS_TOKEN` (see TICKET-005 — currently inconsistent).

---

## Token Engine Overhaul (Phase 8) — read before touching code

The project is being rewritten package by package (strangler). Background: [spec](docs/specs/token-engine-overhaul.md), [ADR 0001](docs/adr/0001-strangler-rewrite.md), [ADR 0002](docs/adr/0002-pnpm-monorepo-single-cli.md). Tickets 033+ in `docs/tickets/000-index.md` (Phase 8). Work one ticket at a time; open feature tickets wait until parity.

**Rules**

- Legacy `src/` is **frozen**: it is the parity reference. Do not edit it (CI fails the PR unless a maintainer adds the `legacy-exception` label). New code goes in `packages/*`.
- Packages (`@dta/core`, `@dta/testkit`, `@dta/cli`; later `figma`, `build`, `lint`) expose a small public API through their entry point. Import other packages only by name (`@dta/core`), never `@dta/core/src/...` or `../../core/...`. `pnpm run guardrails:boundaries` checks this.
- `@dta/core` depends on no other `@dta/*` package. Only `@dta/cli` is user-facing; `@dta/testkit` is private and dev-only.
- Porting a legacy behaviour? Update its row in `docs/tickets/039-legacy-removal.md` (parity table) in the same PR; delete the matching legacy files in that same PR (label `legacy-exception`) once its row is proven.
- Don't commit or push without the maintainer's explicit go-ahead.
- Never use real customer brand names in files; use BrandA/BrandB. Say "snapshot", not "golden".

**Test seams**

- Package seam (primary): test each package through its public API only, with thorough tests inside the package.
- CLI seam (parity): `test/snapshots/` holds reference snapshots recorded from the frozen legacy CLI on `test/fixtures/*`. Never regenerate them from new code or "update to pass"; an intentional output change is a reviewed snapshot diff. Reviewed, intentional differences are listed in `INTENDED_CHANGES` in `packages/cli/test/snapshots.test.ts` (and in the quirk table of TICKET-039); the `PENDING` list is empty.
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

Recommended starting sequence:

1. TICKET-001 + TICKET-005 (credentials + env names, one PR)
2. TICKET-002 (Style Dictionary v4 — unblocks most other work)
3. TICKET-008 → TICKET-007 (config schema then CLI)
4. Output targets (009–013) based on immediate project needs
