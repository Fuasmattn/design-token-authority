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
  /** Command that prepares a fresh checkout of the base, run in its repo root (e.g. an install). */
  setup: path.optional(),
  /** Command that builds the static output, run at the base and the head. */
  build: path.optional(),
  /** Folder of the static output, relative to the project. */
  outDir: path,
  /**
   * Where the stories come from: a `dta.stories/1` manifest in the static output (`static-site`,
   * the default) or the `index.json` of a static Storybook build (`storybook`).
   */
  stories: z.preprocess(
    (value) =>
      value === undefined
        ? { type: 'static-site' }
        : typeof value === 'object' && value !== null && !('type' in value)
          ? { ...value, type: 'static-site' }
          : value,
    z.discriminatedUnion('type', [
      z.strictObject({
        type: z.literal('static-site'),
        /** Manifest path inside `outDir`. */
        manifest: path.default('stories/manifest.json'),
      }),
      z.strictObject({
        type: z.literal('storybook'),
        /** Storybook's index inside `outDir` (the `storybook build` output). */
        index: path.default('index.json'),
        /** Stories with one of these tags are not rendered. */
        excludeTags: z.array(z.string().min(1)).default(['skip-dta-diff']),
        /** Regular expressions; stories whose id matches one are not rendered. */
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
          .default([]),
      }),
    ]),
  ),
  /** Viewport widths for stories that do not suggest their own. */
  viewports: z.array(viewport).min(1).default([1280]),
  /** Changed-pixel ratio (0–1) a story may differ by before it counts as changed. */
  threshold: z.number().min(0).max(1).default(0),
  /** Per-pixel colour tolerance (0–1); 0 sees every colour change. */
  colorThreshold: z.number().min(0).max(1).default(0),
  /**
   * Review thresholds by cause, as changed-pixel ratios (0–1). A story explained by token
   * changes needs a review above `explained`; an unexplained story fails above `unexplained`.
   */
  thresholds: z
    .strictObject({
      explained: z.number().min(0).max(1).default(0),
      unexplained: z.number().min(0).max(1).default(0),
    })
    .prefault({}),
  /**
   * Publish hook: a command run on the report folder (path as argument and DTA_REPORT_DIR) that
   * prints the public base URL as its last stdout line, or `{ command, url }` where `url` is a
   * JSON path (`$.deployment.url`) or a regular expression to find it. `--publish` overrides it.
   */
  publish: z.union([path, z.strictObject({ command: path, url: path.optional() })]).optional(),
  /** Default base for `dta diff` (a git ref or directory); `--base` overrides it. */
  base: path.optional(),
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
