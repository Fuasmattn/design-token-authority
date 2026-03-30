# TICKET-017: Implementation Notes & Findings

## What was built

### `dta graph` command

New CLI command that reads all token JSON files, builds a directed dependency graph of alias references, and outputs diagnostics + visualizations.

**Usage:**

```bash
dta graph                           # Console summary (default)
dta graph --format dot              # Graphviz DOT format (pipe to `dot -Tsvg`)
dta graph --format markdown         # Markdown report table
dta graph --format html             # Interactive browser visualization
dta graph --format dot -o graph.dot # Write to file instead of stdout
```

### Files added

| File | Purpose |
|------|---------|
| `src/graph.ts` | Core graph module: token file reading, graph construction, cycle detection, chain depth computation, all output formatters (console, DOT, markdown, HTML) |
| `src/graph.test.ts` | 19 tests covering graph building, cycle detection, dangling aliases, orphaned tokens, chain depth, cross-file resolution, all formatters, edge cases |
| `src/commands/graph.ts` | CLI command handler with `@clack/prompts` UI, format routing, and auto-open for HTML |

### Files modified

| File | Change |
|------|--------|
| `src/cli.ts` | Added `graph` subcommand registration |

---

## Findings from real token data

Running against the project's actual Figma export (7 files, 1,537 tokens):

| Metric | Value |
|--------|-------|
| Total tokens | 1,537 |
| Alias tokens | 1,115 (73%) |
| Raw value tokens | 422 (27%) |
| Max chain depth | 3 |
| Circular references | 0 |
| Dangling aliases | 0 |
| Orphaned tokens | 231 |

### Chain depth distribution

| Depth | Count | Meaning |
|-------|-------|---------|
| 0 | 422 | Raw primitive values (colors, numbers) |
| 1 | 390 | Direct alias to a primitive |
| 2 | 703 | Alias → alias → primitive (most common!) |
| 3 | 22 | Deepest chains: 3 hops to resolve |

### Key observations

1. **Most tokens live at depth 2.** The dominant pattern is: ScreenType/Brand token → Brand(Alias) semantic token → Primitives(Global) raw value. This confirms the 3-layer architecture works as designed.

2. **Depth-3 tokens are rare (22 out of 1,537).** These are likely ScreenType overrides that alias Brand tokens which themselves alias Primitives. Worth investigating if any are unnecessary indirection.

3. **231 orphaned primitives** — raw values in Primitives(Global) that no Brand or ScreenType token references. These are not bugs (primitives are often a superset intentionally), but they indicate potential cleanup opportunities. Examples include `alpha` variants and `alpha Inverse` variants.

4. **No circular references or dangling aliases** — the token architecture is clean. The alias resolution chain always terminates at a raw value.

5. **Brand files are identical in structure.** Both Brand(Alias).Bayernwerk and Brand(Alias).LEW have exactly 570 tokens each, confirming the multi-brand model uses the same semantic structure per brand (just different primitive targets).

6. **ScreenType files are symmetrical too** — Desktop, Mobile, Tablet each have 29 tokens. These are responsive overrides (likely spacing/typography) that alias back into the system.

---

## Ideas for designers & developers

### For designers working in Figma

- **Use `dta graph` before publishing** to catch dangling aliases early. If you rename a primitive in Figma but forget to update the alias, the graph will flag it as a dangling reference.

- **Check the orphaned tokens list** periodically. If a primitive is never referenced, it might be safe to remove — or it might be intended for future use. The graph gives you visibility.

- **The depth-3 threshold is a good health indicator.** If chain depth starts exceeding 3, it likely means unnecessary aliasing layers are being introduced. Consider flattening.

### For developers consuming tokens

- **The DOT output integrates with Graphviz** and CI. You can generate SVG diagrams automatically:
  ```bash
  dta graph --format dot | dot -Tsvg > token-deps.svg
  ```

- **The markdown output works in PRs.** On a `dta pull` workflow, generate the markdown report and post it as a PR comment to review token changes in context.

- **The HTML visualization is self-contained** (single file, no dependencies). Drop it into a docs site or share with the team for interactive exploration.

### Future enhancement ideas

1. **`--filter` flag** — Filter the graph to show only tokens matching a pattern (e.g., `--filter "Colors.foundation.brand"`) to focus on a specific subtree.

2. **Diff mode** — Compare two graph snapshots to show what aliases changed between Figma syncs. Would pair well with TICKET-020 (sync diff report).

3. **Layer-aware visualization** — Color-code by detected layer role (primitives/brand/dimension) instead of just by file, leveraging the analysis from TICKET-014.

4. **Reverse dependency lookup** — "Which tokens depend on this primitive?" Currently the graph shows forward references; a reverse index would answer "if I change this raw value, what semantic tokens are affected?"

5. **CI integration** — Add a `--ci` flag that exits with non-zero status if dangling aliases or circular references are detected. This blocks merging broken token files.

6. **JSON export** — `--format json` to output the full graph data for custom tooling or integration with design system dashboards.

7. **Token value preview** — In the HTML visualization, show color swatches for color tokens and actual numeric values inline, making it useful as a quick token reference.

8. **Orphan classification** — Distinguish "truly orphaned" primitives (never used anywhere) from "partially orphaned" ones (used in one brand but not another), which might indicate incomplete brand setup.

9. **Integration with TICKET-018 (linter)** — The graph's `buildGraph()` function returns all the data the linter needs: dangling aliases, circular refs, chain depths. The linter can import and reuse the graph directly rather than re-parsing tokens.

10. **Cost-of-change heatmap** — In the HTML visualization, size or color nodes by how many other tokens transitively depend on them. A primitive referenced by 100+ aliases is high-risk for changes.
