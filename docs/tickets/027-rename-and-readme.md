# TICKET-027: Rename project and replace README

**Phase:** 1 — Immediate Fixes
**Priority:** Medium
**Effort:** XS

## Summary

Replace the placeholder project name inherited from the Figma example repo with a
fitting name, update it in all relevant files, and replace the outdated README with a
minimal, accurate description of what this tool actually does.

## Background

The repository was forked from Figma's `variables-github-action-example` demo repo.
The package name, README title, and README content are all still the original
boilerplate. The README describes the demo project, references a now-deleted
`removedollarsigns.sh` script, and says nothing about Style Dictionary v4, the
Tailwind formatters, or the planned whitelabel architecture.

---

## Step 1 — Choose a name

The name should reflect that this is:
- A **pipeline** / **build tool** (not just a sync script)
- Figma-first (pulls variables from Figma)
- Output-agnostic (CSS, Tailwind, iOS, Android)
- Configurable per project (whitelabel)

Candidates:

| Name | Notes |
|---|---|
| `figma-token-pipeline` | Accurate, descriptive |
| `figma-token-forge` | Alliterative, tool-like |
| `token-bridge` | Generic, emphasises the sync aspect |
| `ds-pipeline` | Short, but loses Figma specificity |
| `figma-ds-sync` | Clear but undersells the output side |

The `package.json` `name` field (used as the npm package name if ever published)
should be kebab-case, all lowercase. The README title can be title-cased or have
a short tagline.

**Decision required:** pick a name before implementing.

---

## Step 2 — Files to update

| File | What changes |
|---|---|
| `package.json` | `"name"` field |
| `README.md` | Full replacement (see Step 3) |
| `CLAUDE.md` | H1 title if it references the old name (currently fine — references `dta` as the CLI command name, which is intentional) |

The GitHub Actions workflow files (`sync-figma-to-tokens.yml`, `sync-tokens-to-figma.yml`,
`test.yml`) use descriptive `name:` strings that are already correct — no changes needed.

---

## Step 3 — Minimal README

Replace the entire current README with a minimal document that is accurate to what
the tool is now, with room to grow. **Do not pad it** — sections for features not yet
built should be omitted; they will be added as tickets are implemented.

Proposed structure:

```markdown
# <project-name>

> Bi-directional sync between Figma Variables and design token JSON files,
> with multi-target output via Style Dictionary.

## What it does

- **Pull** (`sync-figma-to-tokens`) — fetches variable collections from the Figma
  Variables API and writes them as W3C DTCG-format JSON files in `tokens/`
- **Push** (`sync-tokens-to-figma`) — reads `tokens/` and writes variables back to Figma
- **Build** (`build`) — runs Style Dictionary to produce CSS custom properties,
  a JavaScript ES6 export, and Tailwind v3/v4 theme files from the token JSON

## Token format

Files follow the W3C Design Token Community Group (DTCG) draft spec with Figma
extensions. One file per Figma variable collection + mode:

    tokens/Primitives(Global).Value.json
    tokens/Brand(Alias).BrandA.json
    tokens/Brand(Alias).BrandB.json
    tokens/ScreenType.Desktop.json

## Setup

```bash
cp .env.example .env
# fill in FIGMA_FILE_KEY and FIGMA_PERSONAL_ACCESS_TOKEN
npm install
```

## Commands

```bash
npm run sync-figma-to-tokens   # Figma → tokens/
npm run sync-tokens-to-figma   # tokens/ → Figma
npm run build                  # tokens/ → build/
npm test                       # run test suite
```

## Build outputs

| File | Description |
|---|---|
| `build/css/variables.css` | CSS custom properties (`:root`) |
| `build/js/colorpalette.js` | ES6 named exports |
| `build/tailwind/tailwind.tokens.ts` | Tailwind v3 `theme.extend` object |
| `build/tailwind/tailwind.css` | Tailwind v4 `@theme` block |
```

That's it for now. Additional sections (multi-brand setup, output target docs,
CLI usage) will be added as the corresponding tickets are implemented.

---

## Acceptance Criteria

- [x] A name has been decided and recorded in this ticket
  **Chosen name:** `design-token-authority`
- [x] `package.json` `name` field updated
- [x] `README.md` replaced with the minimal version above (adjusted for chosen name)
- [x] No references to the old name `variables-github-action-example` remain in
      tracked files (check with `git grep variables-github-action-example`)
- [x] `npm test` still passes after rename

## Dependencies

None — this is a pure housekeeping task.
