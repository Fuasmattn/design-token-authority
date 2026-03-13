# TICKET-024: AI-assisted config generation

**Phase:** 6 — Documentation & Visualization
**Priority:** Low
**Effort:** L

## Summary

Add an AI-powered assistant mode to the CLI that takes a Figma file analysis and a natural language description of the desired output, and generates a complete project config with custom Style Dictionary transforms and formatters. Bridges the gap for projects with unusual token structures that don't fit the standard heuristics.

## Background

The autodiscovery (TICKET-014) and init wizard (TICKET-015) handle common patterns well. But real-world design systems often have idiosyncratic naming conventions, unusual collection structures, or output requirements that don't map cleanly to the standard config options.

An AI assistant can handle these edge cases by understanding intent from a description and generating the necessary config — similar to how AI code assistants work for general programming tasks.

## Acceptance Criteria

- [ ] `dtf ai` subcommand (or `dtf init --ai`)
- [ ] Sends the Figma file analysis (collection names, mode names, alias ratios, sample token names) to a Claude API call
- [ ] User can describe their needs in natural language: "I need iOS output with a ThemeManager class, and the brand should be selectable at runtime"
- [ ] AI returns: a complete `dtf.config.ts`, any needed custom transforms, any needed custom formatters
- [ ] Output is shown to the user for review before writing to disk
- [ ] `ANTHROPIC_API_KEY` environment variable required; graceful error if absent
- [ ] The prompt engineering is well-documented so it can be improved iteratively

## Implementation Notes

**Claude API usage:**

```ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

async function generateConfig(analysis: CollectionAnalysis[], userDescription: string) {
  const systemPrompt = `You are an expert in design systems and the design-token-farm CLI tool.
Given a Figma file structure analysis and a user's requirements, generate a valid dtf.config.ts file.
Include any custom Style Dictionary transforms or formatters if the standard ones are insufficient.
Return only valid TypeScript code with no explanation.`

  const userMessage = `
## Figma File Structure
${JSON.stringify(analysis, null, 2)}

## User Requirements
${userDescription}

## Available Config Options
${JSON.stringify(CONFIG_SCHEMA_DESCRIPTION, null, 2)}
`

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: userMessage }],
    system: systemPrompt,
  })

  return response.content[0].text
}
```

**Iteration loop:** Show the generated config, allow the user to describe corrections in natural language, regenerate. At most 3 iterations before falling back to manual editing.

**Privacy:** The analysis sent to the API contains collection names, mode names, and sample token names — no actual token values. Document this clearly so users understand what leaves their machine.

## Dependencies

- TICKET-007 (CLI subcommand)
- TICKET-008 (config schema — AI generates a config conforming to this schema)
- TICKET-014 (autodiscovery — analysis output is the AI's input)
- TICKET-015 (init wizard — AI mode is an enhanced path through init)
