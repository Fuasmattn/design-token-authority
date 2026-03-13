# CLAUDE.md — figma-variables-style-dictionary

This file provides context and working instructions for Claude Code when working on this project.

---

## Project vision

The goal is a **whitelabel design token pipeline tool** that:
- Syncs design tokens bi-directionally between Figma (Variables API) and JSON files
- Converts tokens to multiple output targets: CSS, Tailwind v3/v4, iOS Swift, Android XML/Compose
- Auto-discovers the structure of any Figma variable setup (multi-brand, responsive layers)
- Is configurable per-project via a `figma-tokens.config.ts` file, not hardcoded

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
  figma_api.ts          Figma REST API wrapper — getLocalVariables(), postVariables()
  token_types.ts        TypeScript interfaces: Token, TokensFile, TokenOrTokenGroup
  token_export.ts       Figma API response → token JSON files (export direction)
  token_import.ts       Token JSON files → Figma API POST payload (import direction)
  color.ts              Color utilities: parseColor(), rgbToHex(), colorApproximatelyEqual()
  utils.ts              Console color helpers, areSetsEqual()
  sync_figma_to_tokens.ts   CLI entrypoint: pull from Figma
  sync_tokens_to_figma.ts   CLI entrypoint: push to Figma
  *.test.ts             Jest tests alongside source files
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
npm run sync-figma-to-tokens   # Pull variables from Figma → tokens/
npm run sync-tokens-to-figma   # Push tokens/ → Figma
npm run build                  # Generate CSS + JS from tokens/ (see known issues)
npm test                       # Run Jest test suite
npm run prettier:check         # Check code formatting
```

### Build pipeline (current, pre-v4)
`npm run build` runs `removedollarsigns.sh` (strips `$` from token keys) then `style-dictionary build`.
⚠️ This mutates token files. After a build run, token files may have `type`/`value` instead of `$type`/`$value`.
**This will be fixed by TICKET-002 (upgrade to Style Dictionary v4).**

---

## Known tech debt

These are tracked as tickets — do not work around them, fix them at the source:

| Issue | Ticket |
|---|---|
| Credentials in `.env` committed to git | TICKET-001 |
| Style Dictionary v3 (use v4) | TICKET-002 |
| `removedollarsigns.sh` mutates source files | TICKET-002 (fixed by v4) |
| CSS blur/opacity values missing units | TICKET-003 |
| Redundant segment names in CSS vars (`blur-blur-`) | TICKET-004 |
| Inconsistent env var names across local and CI | TICKET-005 |
| `meta.Mode1.json` uses Figma default mode name | TICKET-006 |

---

## Testing

- Framework: Jest + ts-jest
- Test files live alongside source: `color.test.ts`, `token_export.test.ts`, `token_import.test.ts`
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
