# TICKET-002: Upgrade Style Dictionary from v3 to v4

**Status:** ✅ Done — commit `89a638f`
**Phase:** 1 — Foundation
**Priority:** High
**Effort:** M

## Summary

Style Dictionary v4 introduces native support for the W3C Design Token Community Group (DTCG) spec, including `$type`/`$value` token properties. This eliminates the brittle `removedollarsigns.sh` preprocessing hack and unlocks better transforms, improved TypeScript support, and cleaner reference resolution.

## Background

The current build pipeline requires running `removedollarsigns.sh` before Style Dictionary processes tokens, because v3 does not understand the `$`-prefixed W3C format (`$type`, `$value`, `$description`). This script mutates source files in-place, which is fragile and confusing.

Style Dictionary v4 (released 2024) handles `$type`/`$value` natively and has a fully TypeScript-native API.

Key v4 changes relevant to this project:
- Native DTCG `$type`/`$value` support — no preprocessing needed
- Config written in TypeScript (`style-dictionary.config.ts`)
- Improved transform/format API with async support
- Better reference (`{alias}`) resolution with cross-file support
- Built-in `log` levels for cleaner output

## Acceptance Criteria

- [x] `style-dictionary` upgraded to `^4.4.0` in `package.json`
- [x] `removedollarsigns.sh` deleted (`cleanup.sh` kept — it's a separate utility that removes token files before a fresh pull)
- [x] `config.json` migrated to `style-dictionary.config.ts`
- [x] `npm run build` works without any file mutation preprocessing
- [x] Token source files retain their `$type`/`$value` keys unchanged (restored from stripped state via `scripts/restore-dtcg-keys.mjs`)

## Implementation Notes

v4 config shape (TypeScript):
```ts
import StyleDictionary from 'style-dictionary'

const sd = new StyleDictionary({
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'build/css/',
      files: [{
        destination: 'variables.css',
        format: 'css/variables',
        options: { outputReferences: true },
      }],
    },
    js: {
      transformGroup: 'js',
      buildPath: 'build/js/',
      files: [{
        destination: 'tokens.mjs',
        format: 'javascript/es6',
      }],
    },
  },
})

await sd.buildAllPlatforms()
```

Migration guide: https://styledictionary.com/version-4/migration/

## Dependencies

- None — can be done independently, but should precede TICKET-003 and TICKET-007+
