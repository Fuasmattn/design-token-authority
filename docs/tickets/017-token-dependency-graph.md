# TICKET-017: Token alias dependency graph

**Phase:** 4 — Structure Intelligence
**Priority:** Low
**Effort:** M

## Summary

Build a utility that computes and visualizes the alias dependency graph across token files — showing which tokens reference which, how deep the alias chains are, and flagging circular references or dangling aliases.

## Background

In the current system, aliases like `{Colors.Foundation.Primary.500}` in a brand token file point to a primitive token. With multiple layers (primitives → brand → dimension), alias chains can become deep or accidentally circular. Currently there is no way to inspect this without manually tracing through JSON files.

This is primarily a diagnostic and documentation tool, but also forms the basis for the plausibility checks in TICKET-018.

## Acceptance Criteria

- [ ] New command: `dta graph` (or `dta analyze --graph`)
- [ ] Reads all token files from the configured tokens directory
- [ ] Builds a directed graph of all alias references
- [ ] Detects and reports: circular references, dangling aliases (pointing to non-existent tokens), orphaned tokens (defined but never referenced)
- [ ] Reports maximum alias chain depth per token
- [ ] Optional: outputs graph as DOT format (`--format dot`) for rendering with Graphviz
- [ ] Optional: outputs a summary as Markdown table

## Implementation Notes

Graph construction:
```ts
type Node = { id: string; path: string[]; value: string | number | boolean | AliasRef }
type AliasRef = { type: 'alias'; target: string }

function buildGraph(tokensByFile: Record<string, TokensFile>): Map<string, Node> {
  const graph = new Map<string, Node>()
  // flatten all tokens to id → node
  // link aliases by matching {path.to.token} strings to node IDs
  // detect cycles with DFS
}
```

**Circular reference detection:** Standard DFS with a visited + in-stack set. Report the cycle path.

**Console output example:**
```
Token Dependency Graph
─────────────────────
Total tokens:       2,420
Alias tokens:       1,840  (76%)
Max chain depth:    3
Circular refs:      0
Dangling aliases:   2  ⚠

⚠ Dangling aliases:
  Brand(Alias).BrandA > Colors.Interactive.Focus
    → {Colors.Foundation.Focus.Default} — not found in any token file

  Brand(Alias).BrandB > Colors.Interactive.Focus
    → {Colors.Foundation.Focus.Default} — not found in any token file
```

## Dependencies

- TICKET-007 (CLI subcommand)
- TICKET-018 (linter reuses the graph for validation rules)
