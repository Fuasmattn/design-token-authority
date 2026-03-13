# design-token-farm

> Bi-directional sync between Figma Variables and design token JSON files,
> with multi-target output via Style Dictionary.

## What it does

- **Pull** (`sync-figma-to-tokens`) — fetches variable collections from the Figma Variables API and writes them as W3C DTCG-format JSON files in `tokens/`
- **Push** (`sync-tokens-to-figma`) — reads `tokens/` and writes variables back to Figma
- **Build** (`build`) — runs Style Dictionary to produce CSS custom properties, a JavaScript ES6 export, and Tailwind v3/v4 theme files from the token JSON

## Token format

Files follow the W3C Design Token Community Group (DTCG) draft spec with Figma extensions. One file per Figma variable collection + mode:

```
tokens/Primitives(Global).Value.json
tokens/Brand(Alias).Bayernwerk.json
tokens/Brand(Alias).LEW.json
tokens/ScreenType.Desktop.json
```

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
