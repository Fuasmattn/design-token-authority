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
Brand (Alias)             semantic tokens — one mode per brand (Bayernwerk, LEW)
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
Example: `Brand(Alias).Bayernwerk.json`, `ScreenType.Desktop.json`

---

## Source code structure

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
  sync_figma_to_tokens.ts   Legacy entrypoint: pull from Figma
  sync_tokens_to_figma.ts   Legacy entrypoint: push to Figma
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

The push direction (`sync_tokens_to_figma.ts`) **never deletes** variables from Figma. It only creates new ones or updates existing ones. Deletion is intentionally out-of-scope for the push command (see TICKET-021 for `prune`).

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
npm run dta -- pull            # Pull variables from Figma → tokens/
npm run dta -- push            # Push tokens/ → Figma (typed confirmation required)
npm run dta -- push --yes      # Push without confirmation (CI/automation)
npm run dta -- build           # Generate CSS + JS from tokens/
npm run dta -- clean           # Remove all token files and build output
npm run dta -- analyze         # Inspect Figma file structure
npm run dta -- graph           # Token dependency graph (console summary)
npm run dta -- graph --format html   # Interactive HTML visualization
npm run dta -- init            # Interactive project setup wizard
npm test                       # Run Vitest test suite
npm run prettier:check         # Check code formatting

# Legacy scripts (still work)
npm run sync-figma-to-tokens   # same as dta pull
npm run sync-tokens-to-figma   # same as dta push
```

### Figma plan requirements

The Figma Variables **REST API** (`/v1/files/:key/variables/local`) is **only available on Enterprise plans**. Professional and Organization plans receive a 403 error.

**For non-Enterprise plans**, use the `--from-file` flag to import tokens exported from Figma via a plugin:

```bash
npm run dta -- pull --from-file <exported.json>
```

**Compatible Figma plugins:**

- [tokenHaus - Variable Import/Export with Links](https://www.figma.com/community/plugin/1578065513743190845/tokenhaus-variable-import-export-with-links) — tested, exports DTCG format with alias preservation and multi-mode support
- [Design Tokens (W3C) Export](https://www.figma.com/community/plugin/1377982390646186215/design-tokens-w3c-export) — exports variable collections as DTCG-format JSON
- [Design Token Exporter](https://www.figma.com/community/plugin/1590704268871516927/design-token-exporter) — W3C DTCG spec-compliant export

**Outlook:** Figma announced native variable export/import aligned with the [W3C Design Tokens Community Group spec](https://tr.designtokens.org/format/) at [Schema 2025](https://figma.obra.studio/design-tokens-community-group-w3c-release/). This is gradually rolling out and expected to be fully available by late 2026. Once available, `dta pull --from-file` will work directly with Figma's native export.

The `dta init` wizard asks which Figma plan you have and adjusts the setup flow accordingly.

### Build pipeline (current, pre-v4)

`npm run build` runs `removedollarsigns.sh` (strips `$` from token keys) then `style-dictionary build`.
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
- Run: `npm test`
- Coverage: color parsing, export conversion, import payload generation, alias resolution, edge cases
- When adding new source files, add a corresponding `*.test.ts`

---

## Code style

- **Formatter:** Prettier (config in `.prettierrc`)
  - No semicolons, single quotes, trailing commas, 100-char line width
- **TypeScript:** strict mode, ESNext modules, target ES2015
- **No `any`** unless genuinely unavoidable — prefer `unknown` and narrow
- Imports use `.js` extension (ESM requirement with tsx)
- Run `npm run prettier:check` before committing; CI enforces it

---

## CI / GitHub Actions

- `.github/workflows/test.yml` — runs on every push: prettier check + jest
- `.github/workflows/sync-figma-to-tokens.yml` — manual: pulls from Figma, opens a PR
- `.github/workflows/sync-tokens-to-figma.yml` — manual: pushes local tokens to Figma

CI secret name: `FIGMA_PERSONAL_ACCESS_TOKEN` (see TICKET-005 — currently inconsistent).

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
