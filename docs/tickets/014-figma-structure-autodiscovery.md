# TICKET-014: Figma variable structure autodiscovery

**Phase:** 4 — Structure Intelligence
**Priority:** High
**Effort:** L

## Summary

Build an analyzer that reads a Figma file's variable collections and infers the design system layering (primitives, semantic/alias, brand, dimension/responsive) using heuristics. Outputs a candidate config that the user can confirm or adjust.

## Background

Currently the collection-to-layer mapping is implicit: the filename convention `{Collection}.{Mode}.json` carries structure, but nothing in the code understands *what role* each collection plays. When onboarding a new project, the user has to figure this out manually.

Good heuristics for each layer type:
- **Primitives:** High alias-to-value ratio is low (mostly raw values); mode count is 1; variable names are concrete (`grey-50`, `12px`)
- **Semantic/alias:** High alias ratio (>80% of values are `VARIABLE_ALIAS`); modes correspond to themes
- **Brand:** Multiple modes with identical variable names; mode names match brand names (contain company names, or named arbitrarily but consistently)
- **Dimension/responsive:** Mode names match known patterns: `Desktop`, `Mobile`, `Tablet`, `sm`, `md`, `lg`, `xs`

## Acceptance Criteria

- [ ] New command `figma-tokens analyze` (or part of `figma-tokens init`, see TICKET-015)
- [ ] Fetches all variable collections from the Figma file
- [ ] For each collection, computes:
  - Total variable count
  - Alias ratio (% of values that are `VARIABLE_ALIAS`)
  - Mode count and mode names
  - Inferred layer role: `primitives` | `brand` | `dimension` | `semantic` | `unknown`
  - Confidence score (0–1) for the inferred role
- [ ] Outputs a structured analysis report to the console (table + summary)
- [ ] Outputs a candidate `layers` block for the project config
- [ ] Handles edge cases: collections with mixed alias/value ratios, unusual mode counts

## Implementation Notes

```ts
interface CollectionAnalysis {
  collectionId: string
  name: string
  modeCount: number
  modeNames: string[]
  variableCount: number
  aliasRatio: number       // 0–1
  inferredRole: LayerRole
  confidence: number       // 0–1
  notes: string[]          // human-readable observations
}

const DIMENSION_MODE_PATTERNS = [/desktop/i, /mobile/i, /tablet/i, /^sm$/i, /^md$/i, /^lg$/i, /^xl$/i]
const BRAND_MODE_PATTERNS = [/^[A-Z][a-z]+$/]  // proper nouns, arbitrary names

function inferRole(analysis: Partial<CollectionAnalysis>): LayerRole {
  if (analysis.modeCount === 1 && analysis.aliasRatio! < 0.1) return 'primitives'
  if (analysis.modeNames!.every(n => DIMENSION_MODE_PATTERNS.some(p => p.test(n)))) return 'dimension'
  if (analysis.aliasRatio! > 0.8) return analysis.modeCount! > 1 ? 'brand' : 'semantic'
  return 'unknown'
}
```

**Console output:**
```
Collection Analysis
───────────────────────────────────────────────────────
Collection           Vars   Alias%  Modes   Inferred Role      Conf.
Primitives(Global)    412      3%   1       primitives         0.97
Brand(Alias)         1840     91%   2       brand              0.94
ScreenType            162     78%   3       dimension          0.89
meta                    6      0%   1       primitives         0.71 ⚠
───────────────────────────────────────────────────────

⚠ Low confidence on "meta" — only 6 variables, consider reviewing manually

Suggested layers config:
  layers: {
    primitives: 'Primitives(Global)',
    brand: 'Brand(Alias)',
    dimension: 'ScreenType',
  }
  brands: ['Bayernwerk', 'LEW']
```

## Dependencies

- TICKET-007 (CLI — `analyze` is a subcommand)
- TICKET-008 (config — feeds into config generation)
- TICKET-015 (init wizard — uses this internally)

---

## Implementation Comments

**2026-03-13 — Implemented.**

- Core analyzer in `src/analyze.ts`: exports `analyzeCollections()` and
  `formatAnalysisReport()`.
- Heuristics implemented as specified: alias ratio, mode count, dimension mode
  name patterns (Desktop/Mobile/Tablet + t-shirt sizes sm/md/lg/xl).
- Confidence scoring: high for clear signals (>0.9), reduced for small collections
  (<10 vars) or ambiguous alias ratios.
- `figma-tokens analyze` subcommand added to CLI (`src/commands/analyze.ts`).
- 11 test cases in `src/analyze.test.ts` covering all layer roles, edge cases
  (remote collections, empty files, small collections), and report formatting.
