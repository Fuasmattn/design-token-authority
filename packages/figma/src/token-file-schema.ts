import { z } from 'zod'

/**
 * The documented input format: one JSON file per collection and mode, named
 * `{Collection}.{Mode}.json`, in the W3C Design Tokens (DTCG) shape with Figma extensions.
 * See docs/token-files/input-format.md. The JSON Schema in docs/token-files is generated
 * from this schema (`pnpm run schema:generate`).
 */

const FigmaExtension = z
  .looseObject({
    hiddenFromPublishing: z.boolean().optional(),
    scopes: z.array(z.string()).optional(),
    codeSyntax: z
      .looseObject({
        WEB: z.string().optional(),
        ANDROID: z.string().optional(),
        iOS: z.string().optional(),
      })
      .optional(),
  })
  .describe('Figma-specific variable metadata, kept when pushing to Figma.')

const Extensions = z.looseObject({ 'com.figma': FigmaExtension.optional() })

const TokenType = z.enum(['color', 'number', 'string', 'boolean'])

const Token = z
  .object({
    $type: TokenType,
    $value: z
      .union([z.string(), z.number(), z.boolean()])
      .describe('A raw value, or an alias such as "{Colors.Brand.Primary}".'),
    $description: z.string().optional(),
    $extensions: Extensions.optional(),
  })
  .describe('A design token: one variable in one mode.')

type Node = z.infer<typeof Token> | { [key: string]: unknown }

const Group: z.ZodType<Node> = z
  .object({
    $description: z.string().optional(),
    $extensions: Extensions.optional(),
  })
  .catchall(z.lazy(() => TokenOrGroup))
  .describe('A group of tokens and further groups. Group names become the variable path.')

const TokenOrGroup: z.ZodType<Node> = z.union([Token, Group])

/** The content of one `{Collection}.{Mode}.json` file. */
export const tokenFileSchema = Group

export type TokenFileContent = z.infer<typeof tokenFileSchema>

/** The JSON Schema (draft 2020-12) of one token file, for editors and third-party exporters. */
export function tokenFileJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(tokenFileSchema, { target: 'draft-2020-12' }) as Record<string, unknown>
}
