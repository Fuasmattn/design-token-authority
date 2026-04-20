# TICKET-030: `dta audit` — detect hardcoded values in AI-generated code

**Phase:** 7 — AI Interop
**Priority:** High
**Effort:** M

## Summary

Add a `dta audit <path>` command that scans a codebase for hardcoded values that should be design tokens — raw hex colors, pixel/rem values matching primitives, font stacks, etc. — and reports each occurrence with the token it should have used. Designed specifically to catch the kind of drift AI coding tools introduce when they generate UI code without checking the token system.

## Background

AI coding agents (Claude, Cursor, Copilot, v0, Stitch) will continue to generate code that ignores local design tokens, no matter how much context they get. Even with `DESIGN.md` (TICKET-028) and the MCP server (TICKET-029), the failure mode remains: agent invents `#0040A0` instead of using `var(--color-brand-primary)` whose value is `#003F8A`.

This is the governance layer. Without it, AI-assisted teams slowly drift off-system, and the token pipeline becomes ceremonial. With it, every PR can be checked and the drift is quantified.

## Acceptance Criteria

- [ ] New command: `dta audit <path>` (default `src/` if omitted)
- [ ] Detects:
  - **Raw hex colors** in CSS, SCSS, JS/TS, JSX/TSX, Swift, Kotlin, XML — flagged if an existing token resolves to the same or near-same color (configurable delta)
  - **Raw px / rem / em values** — flagged if they match a spacing/sizing primitive
  - **Hardcoded font families** — flagged if a typography token covers them
  - **Inline Tailwind arbitrary values** — `text-[#003f8a]`, `p-[12px]` when a utility class exists
- [ ] Per-finding output: file, line, column, matched value, suggested token, suggested replacement snippet
- [ ] Exit code `2` on findings at severity `error`, `0` otherwise
- [ ] `--fix` flag applies safe auto-replacements (conservative: only exact-match values, only in files with a detected framework)
- [ ] `--format sarif` emits SARIF JSON for GitHub code scanning integration
- [ ] `--ignore-path <glob>` and `.dta-audit-ignore` file support
- [ ] Configurable severity per rule in `dta.config.ts` under `audit.rules`
- [ ] Near-miss detection: exact match = `error`, ΔE < 3 color match = `warning`, so teams can catch AI colors that are visually close but not in the system
- [ ] Summary at end: "X findings in Y files; Z% of detected values are on-system"

## Implementation Notes

**Detection approach:**

1. Build a reverse index from the token set: `value → token name`, per category.
2. Walk target files with a lightweight parser per language (regex is sufficient for colors/lengths in most files; use Babel/SWC only for JSX arbitrary values).
3. For each literal found, look up in the reverse index (exact and near-miss).
4. Emit findings.

**Near-miss color matching:**

```ts
import { parseColor, colorApproximatelyEqual } from './color.js'

function findNearestToken(hex: string, tokens: ColorToken[]): { token: ColorToken; distance: number } | null {
  let best: { token: ColorToken; distance: number } | null = null
  const target = parseColor(hex)
  for (const t of tokens) {
    const d = deltaE(target, parseColor(t.resolvedValue))
    if (d < 5 && (!best || d < best.distance)) best = { token: t, distance: d }
  }
  return best
}
```

**CI integration:** Add a GitHub Actions snippet to the README that runs `dta audit --format sarif --out audit.sarif` and uploads via `github/codeql-action/upload-sarif`. Teams then see findings as PR annotations.

**False-positive tolerance:** Be conservative with `--fix`. Reporting is cheap; wrong fixes are expensive. Default behavior is reporting only.

**Coverage metric:** The "percent on-system" number is a useful health signal to track over time. Consider emitting a JSON report that CI can chart.

## Dependencies

- TICKET-017 (dependency graph — full resolved token set)
- TICKET-018 (linter — shares reporting primitives)
- TICKET-008 (config — `audit.rules`, severity)
- TICKET-007 (CLI subcommand)
