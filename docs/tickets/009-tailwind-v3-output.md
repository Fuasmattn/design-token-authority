# TICKET-009: Add Tailwind v3 output formatter

**Phase:** 3 — Output Targets
**Priority:** High
**Effort:** M

## Summary

Add a Style Dictionary formatter that generates a Tailwind v3 `theme` config object from design tokens, enabling direct integration with Tailwind CSS projects.

## Background

Tailwind v3 uses a JavaScript/TypeScript config file (`tailwind.config.ts`) with a `theme` object mapping semantic categories (colors, spacing, fontFamily, etc.) to values. Tokens exported from Figma map naturally onto this structure.

Multi-brand support requires a decision on strategy: either generate one config per brand (separate files), or use CSS variable references so a single Tailwind config works with runtime brand switching.

## Acceptance Criteria

- [ ] New formatter `tailwind/v3` registered in Style Dictionary config
- [ ] Output file: `build/tailwind/tailwind.tokens.ts` (or `.js`)
- [ ] Covers token categories: `colors`, `spacing`, `borderRadius`, `fontSize`, `fontWeight`, `lineHeight`, `boxShadow`, `opacity`, `blur`
- [ ] Token aliases output as CSS variable references (`var(--ds-color-primary)`) to support runtime brand switching
- [ ] Output is a valid Tailwind v3 `theme.extend` object — consuming project imports and spreads it
- [ ] Enabled via `outputs.tailwind.version: 3` in project config (TICKET-008)

## Implementation Notes

```ts
// src/formatters/tailwind-v3.ts
import type { Formatter } from 'style-dictionary'

export const tailwindV3Formatter: Formatter = ({ dictionary }) => {
  const colors: Record<string, string> = {}
  const spacing: Record<string, string> = {}

  for (const token of dictionary.allTokens) {
    if (token.$type === 'color') {
      const key = token.path.slice(1).join('-')  // strip top-level group
      colors[key] = `var(--${token.name})`
    }
    if (token.$type === 'dimension' && token.path.includes('spacing')) {
      spacing[token.path.at(-1)!] = token.$value as string
    }
    // ... other categories
  }

  return [
    `import type { Config } from 'tailwindcss'`,
    ``,
    `export const tokens = {`,
    `  theme: {`,
    `    extend: {`,
    `      colors: ${JSON.stringify(colors, null, 6)},`,
    `      spacing: ${JSON.stringify(spacing, null, 6)},`,
    `    },`,
    `  },`,
    `} satisfies Partial<Config>`,
  ].join('\n')
}
```

Consuming project:
```ts
// tailwind.config.ts
import { tokens } from './build/tailwind/tailwind.tokens'
export default { ...tokens }
```

## Token Category → Tailwind Key Mapping

| Token path prefix | Tailwind key |
|---|---|
| `Colors/*` | `colors` |
| `Spacing/*` | `spacing` |
| `Typography/fontSize/*` | `fontSize` |
| `Typography/fontWeight/*` | `fontWeight` |
| `Typography/lineHeight/*` | `lineHeight` |
| `BorderRadius/*` | `borderRadius` |
| `Effects/blur/*` | `blur` |
| `Effects/opacity/*` | `opacity` |

## Dependencies

- TICKET-002 (SD v4)
- TICKET-008 (config — `outputs.tailwind.version: 3` enables this)
