import type { Diagnostic } from '@dta/core'
import { z } from 'zod'

/** Shape id of a stories manifest (written by the DTA website, read by `dta diff`). */
export const STORIES_SCHEMA = 'dta.stories/1'

const path = z.string().min(1)
const viewport = z.number().int().positive().max(8000)

/**
 * The `diff` section of `dta.config.*`: how to build the project and where its stories are.
 * Embedded by the CLI config schema.
 */
export const diffConfigSchema = z.strictObject({
  setup: path
    .optional()
    .describe(
      "Optional command that prepares the fresh checkout of the base, run in its repo root. Without it, dta diff reuses your installed packages when the lockfile did not change, and otherwise runs the lockfile's clean install (npm ci, pnpm install --frozen-lockfile, …).",
    ),
  build: path
    .optional()
    .describe('Command that builds the static output, run at the base and the head.'),
  outDir: path.describe('Folder of the static output, relative to the project.'),
  // A union rather than a preprocessed discriminated union, so that the JSON Schema of the
  // config describes the input: `stories` and its `type` may be left out.
  stories: z
    .union([
      z
        .array(
          z
            .string()
            .startsWith('/', 'a page path starts with "/" (for example "/pricing")')
            .describe('A page of the static output, e.g. "/" or "/pricing".'),
        )
        .min(1)
        .describe('Pages of the static output, rendered as they are: no manifest needed.'),
      z.strictObject({
        type: z.literal('static-site').default('static-site'),
        manifest: path
          .default('stories/manifest.json')
          .describe('Path of the dta.stories/1 manifest inside `outDir`.'),
      }),
      z.strictObject({
        type: z.literal('storybook'),
        index: path
          .default('index.json')
          .describe("Storybook's index inside `outDir` (the `storybook build` output)."),
        excludeTags: z
          .array(z.string().min(1))
          .default(['skip-dta-diff'])
          .describe('Stories with one of these tags are not rendered.'),
        exclude: z
          .array(
            z.string().refine((pattern) => {
              try {
                new RegExp(pattern)
                return true
              } catch {
                return false
              }
            }, 'not a valid regular expression'),
          )
          .default([])
          .describe('Regular expressions; stories whose id matches one are not rendered.'),
      }),
    ])
    .default({ type: 'static-site', manifest: 'stories/manifest.json' })
    .describe(
      'Where the stories come from: a list of pages (`["/", "/pricing"]`), a dta.stories/1 manifest in the static output (`static-site`, the default) or the index of a static Storybook build (`storybook`).',
    ),
  viewports: z
    .array(viewport)
    .min(1)
    .default([1280])
    .describe('Viewport widths for stories that do not suggest their own.'),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe('Changed-pixel ratio (0–1) a story may differ by before it counts as changed.'),
  colorThreshold: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe(
      'Per-pixel colour tolerance (0–1); 0 sees every colour change. The scale is a perceptual (OKLab) distance, 1 is black against white.',
    ),
  thresholds: z
    .strictObject({
      explained: z
        .number()
        .min(0)
        .max(1)
        .default(0)
        .describe('A story explained by token changes needs a review above this ratio.'),
      unexplained: z
        .number()
        .min(0)
        .max(1)
        .default(0)
        .describe('A story no token change explains fails above this ratio.'),
    })
    .prefault({})
    .describe('Review thresholds by cause, as changed-pixel ratios (0–1).'),
  publish: z
    .union([
      path,
      z.strictObject({
        command: path.describe('The publish command.'),
        url: path
          .optional()
          .describe('JSON path or regular expression that finds the URL in its output.'),
      }),
    ])
    .optional()
    .describe(
      'Publish hook: a command run on the report folder (path as argument and DTA_REPORT_DIR) that prints the public base URL as its last stdout line, or `{ command, url }` where `url` is a JSON path (`$.deployment.url`) or a regular expression to find it. `--publish` overrides it.',
    ),
  base: path
    .optional()
    .describe('Default base for `dta diff` (a git ref or directory); `--base` overrides it.'),
  workflow: z
    .enum(['single', 'split'])
    .optional()
    .describe(
      'The GitHub workflow `dta init` writes: `single` (one file, for repositories without outside contributors) or `split` (three files, safe for pull requests from forks). Saved so a re-run does not ask again.',
    ),
})

export type DiffConfigInput = z.input<typeof diffConfigSchema>
export type DiffConfig = z.output<typeof diffConfigSchema>

/** One story `dta diff` renders: a page of the built output, at one or more widths. */
export interface StoryRef {
  id: string
  title: string
  /** Path inside the static output, e.g. `/stories/button/variants/`. */
  url: string
  viewports: number[]
  /**
   * Optional JavaScript expression the page must make true before the screenshot (after network
   * idle), e.g. Storybook's "story rendered" body class.
   */
  ready?: string
}

const manifestSchema = z.object({
  schema: z.literal(STORIES_SCHEMA),
  stories: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      url: z.string().startsWith('/'),
      viewports: z.array(viewport).min(1).optional(),
    }),
  ),
})

/**
 * Static-site adapter: reads a stories manifest (already parsed JSON). Problems come back as
 * diagnostics; the function never throws on bad input.
 */
export function readStoriesManifest(
  manifest: unknown,
  options: { viewports: number[] },
): { stories: StoryRef[]; diagnostics: Diagnostic[] } {
  const parsed = manifestSchema.safeParse(manifest)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    return {
      stories: [],
      diagnostics: [
        {
          severity: 'error',
          code: 'invalid-manifest',
          message: `Not a ${STORIES_SCHEMA} stories manifest: ${issues}`,
        },
      ],
    }
  }

  const diagnostics: Diagnostic[] = []
  const seen = new Set<string>()
  const stories: StoryRef[] = []
  for (const story of parsed.data.stories) {
    if (seen.has(story.id)) {
      diagnostics.push({
        severity: 'error',
        code: 'duplicate-story',
        message: `Story id "${story.id}" appears more than once in the manifest.`,
      })
      continue
    }
    seen.add(story.id)
    stories.push({
      id: story.id,
      title: story.title,
      url: story.url,
      viewports: story.viewports ?? options.viewports,
    })
  }
  return { stories, diagnostics }
}

/**
 * Page-list adapter (TICKET-128): each path of `diff.stories` becomes a story with the path as its
 * title and a file-safe id (`/` → `home`, `/docs/intro/` → `docs-intro`).
 */
export function pageStories(
  paths: readonly string[],
  options: { viewports: number[] },
): { stories: StoryRef[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = []
  const stories: StoryRef[] = []
  const seen = new Set<string>()
  for (const url of paths) {
    const id =
      url
        .split(/[?#]/)[0]
        .toLowerCase()
        .replace(/\.html?$/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'home'
    if (seen.has(id)) {
      diagnostics.push({
        severity: 'error',
        code: 'duplicate-story',
        message: `The pages "${url}" and an earlier one both become the story "${id}"; list each page once.`,
      })
      continue
    }
    seen.add(id)
    stories.push({ id, title: url, url, viewports: options.viewports })
  }
  return { stories, diagnostics }
}

/** Storybook adds one of these classes to the iframe's body once a story has rendered (or failed). */
export const STORYBOOK_READY =
  "['sb-show-main', 'sb-show-errordisplay', 'sb-show-nopreview'].some((c) => document.body.classList.contains(c))"

const storybookIndexSchema = z.object({
  v: z.number().int(),
  entries: z.record(
    z.string(),
    z.looseObject({
      type: z.string(),
      id: z.string().min(1),
      title: z.string(),
      name: z.string(),
      tags: z.array(z.string()).optional(),
    }),
  ),
})

/**
 * Storybook adapter: the `index.json` of a static Storybook build (v4 and v5) to stories. Only
 * entries of type `story` are rendered, through `iframe.html` (the story without Storybook's UI);
 * docs entries, excluded tags and ids matching `exclude` are left out. Problems come back as
 * diagnostics; the function never throws on bad input.
 */
export function readStorybookIndex(
  index: unknown,
  options: { viewports: number[]; excludeTags?: string[]; exclude?: string[] },
): { stories: StoryRef[]; diagnostics: Diagnostic[] } {
  const parsed = storybookIndexSchema.safeParse(index)
  if (!parsed.success || parsed.data.v < 4) {
    const stories3 = typeof index === 'object' && index !== null && 'stories' in index
    return {
      stories: [],
      diagnostics: [
        {
          severity: 'error',
          code: 'invalid-storybook-index',
          message: stories3
            ? 'This is a stories.json of Storybook 6 or older; dta diff reads index.json (Storybook 7+).'
            : `Not a Storybook index.json (v4 or v5): ${parsed.success ? `version ${parsed.data.v}` : parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`,
        },
      ],
    }
  }
  const excludeTags = new Set(options.excludeTags ?? [])
  const exclude = (options.exclude ?? []).map((pattern) => new RegExp(pattern))
  const stories = Object.values(parsed.data.entries)
    .filter((entry) => entry.type === 'story')
    .filter((entry) => !(entry.tags ?? []).some((tag) => excludeTags.has(tag)))
    .filter((entry) => !exclude.some((regex) => regex.test(entry.id)))
    .map((entry) => ({
      id: entry.id,
      title: `${entry.title} / ${entry.name}`,
      url: `/iframe.html?id=${encodeURIComponent(entry.id)}&viewMode=story`,
      viewports: options.viewports,
      ready: STORYBOOK_READY,
    }))
  return { stories, diagnostics: [] }
}
