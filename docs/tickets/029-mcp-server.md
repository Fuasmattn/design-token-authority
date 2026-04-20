# TICKET-029: MCP server exposing token graph to AI tools

**Phase:** 7 — AI Interop
**Priority:** High
**Effort:** M

## Summary

Ship a Model Context Protocol (MCP) server — `dta mcp` — that exposes the token graph as live tools any MCP client (Claude Code, Claude Desktop, Cursor, and other AI agents) can query during code generation. Unlike `DESIGN.md` (TICKET-028), which is a static snapshot, the MCP server answers questions at the moment the agent needs the answer: "what's the semantic token for `#003F8A`?", "what tokens override on mobile?", "is this hex value in the system?"

## Background

`DESIGN.md` solves the cold-start problem (the agent knows tokens exist). MCP solves the scale problem: a token system can have thousands of tokens, too many to fit in any context window. An MCP server lets the agent pull the exact subset it needs, when it needs it, against the current state of the token files — not a possibly-stale static snapshot.

This is the single most leveraged move for keeping the project relevant as AI coding agents become the primary consumers of design system context. It positions `design-token-authority` as the queryable authority behind a team's AI tooling, rather than a batch-processor that runs periodically.

## Acceptance Criteria

- [ ] New command: `dta mcp` starts an MCP server over stdio (default) or HTTP (`--transport http --port N`)
- [ ] Implements MCP tools:
  - `list_tokens(filter?)` — returns tokens filtered by category, brand, breakpoint, or name pattern
  - `get_token(name)` — returns resolved value, alias chain, code identifiers per output target
  - `find_token_by_value(value, type)` — e.g. `find_token_by_value("#003F8A", "color")` → all tokens resolving to that value
  - `list_brands()` — available brands + how to switch in each output target
  - `get_brand_override(tokenName, brand)` — per-brand resolved value for a semantic token
  - `validate_value(value, context)` — "is this value allowed in this context?" (reuses linter)
- [ ] Implements MCP resources:
  - `tokens://all` — full token graph as JSON (denormalized)
  - `tokens://design-md` — the generated `DESIGN.md` content
- [ ] Server reflects the current state of `tokens/` on each call — no caching beyond a single request
- [ ] Config example for Claude Code / Claude Desktop documented in README
- [ ] Graceful handling when tokens haven't been pulled yet (clear error, suggest `dta pull`)
- [ ] Read-only by default. A `--write` flag exposes `propose_token` (creates a pending token entry in a staging file, never touches Figma directly)

## Implementation Notes

**Dependency:** `@modelcontextprotocol/sdk` (official TypeScript SDK).

**Server skeleton:**

```ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new Server(
  { name: 'design-token-authority', version: '0.x' },
  { capabilities: { tools: {}, resources: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'get_token', description: '...', inputSchema: { /* ... */ } },
    // ...
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  switch (req.params.name) {
    case 'get_token':
      return resolveToken(req.params.arguments.name)
    // ...
  }
})

await server.connect(new StdioServerTransport())
```

**Shared code:** All handlers delegate to the same resolution, graph, and lint primitives used by `build`, `docs`, and `lint`. The MCP layer is a thin adapter — no new token logic.

**Security:** Default read-only. If `--write` is set, mutations go only to a local staging file (`tokens/.pending.json`) that a developer reviews before `dta push`. The MCP server never calls the Figma API directly.

**Client config documentation:**

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "design-tokens": {
      "command": "npx",
      "args": ["-y", "design-token-authority", "mcp"],
      "cwd": "/path/to/project"
    }
  }
}
```

**Performance:** Token graphs for medium-sized design systems (<5000 tokens) fit comfortably in memory. Load once per request; no incremental indexing needed at this scale.

## Dependencies

- TICKET-017 (dependency graph — reused for alias resolution in tools)
- TICKET-018 (linter — reused for `validate_value`)
- TICKET-028 (DESIGN.md — served as a resource)
- TICKET-008 (config — MCP section for transport + write flag)
