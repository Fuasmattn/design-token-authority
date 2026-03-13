# TICKET-015: `figma-tokens init` wizard

**Phase:** 4 — Structure Intelligence
**Priority:** High
**Effort:** M

## Summary

Implement a `figma-tokens init` command that guides a user through connecting to a Figma file, runs autodiscovery (TICKET-014), confirms the detected structure interactively, and writes a `figma-tokens.config.ts` file. This is the primary onboarding experience for new projects.

## Background

Without an init wizard, onboarding a new project requires: manually reading the Figma file, understanding the collection structure, writing a config file from scratch, and wiring up CLI commands. The wizard automates all of this.

The goal is: `npx figma-tokens init` → answer a few questions → working config file.

## Acceptance Criteria

- [ ] `figma-tokens init` runs an interactive prompt sequence
- [ ] Prompts:
  1. Figma file URL or key (validates format)
  2. Figma Personal Access Token (validates by making a test API call)
  3. Runs autodiscovery (TICKET-014) and displays results
  4. Confirms or corrects detected layer roles (per collection)
  5. Confirms detected brand names (if brand collection found)
  6. Selects desired output targets (multiselect: CSS, Tailwind v3, Tailwind v4, iOS, Android XML, Android Compose)
  7. Output directory names (with defaults)
- [ ] Writes `figma-tokens.config.ts` to the current directory
- [ ] Writes `.env.example` if not present
- [ ] Fails gracefully if the Figma API call fails (bad token, wrong file key)
- [ ] Skips already-answered prompts if a partial config exists (idempotent re-run)

## Implementation Notes

Use `@clack/prompts` for a polished interactive CLI experience (spinners, confirm steps, multiselect).

```ts
import * as p from '@clack/prompts'

export async function runInit() {
  p.intro('figma-tokens init')

  const figmaKey = await p.text({
    message: 'Figma file key or URL',
    validate: (v) => extractFileKey(v) ? undefined : 'Invalid Figma URL or key',
  })

  const token = await p.password({
    message: 'Figma Personal Access Token',
  })

  const spinner = p.spinner()
  spinner.start('Connecting to Figma...')
  const analysis = await analyzeFile(figmaKey, token)
  spinner.stop(`Found ${analysis.collections.length} collections`)

  // display table, confirm roles...

  const outputs = await p.multiselect({
    message: 'Select output targets',
    options: [
      { value: 'css', label: 'CSS variables' },
      { value: 'tailwind3', label: 'Tailwind v3 theme' },
      { value: 'tailwind4', label: 'Tailwind v4 @theme' },
      { value: 'ios', label: 'iOS Swift' },
      { value: 'android-xml', label: 'Android XML' },
      { value: 'android-compose', label: 'Android Compose' },
    ],
  })

  writeConfig({ figmaKey, token, analysis, outputs })
  p.outro('Config written to figma-tokens.config.ts')
}
```

## Dependencies

- TICKET-007 (CLI — `init` is a subcommand)
- TICKET-008 (config schema — init writes a valid config)
- TICKET-014 (autodiscovery — init calls analyze internally)
