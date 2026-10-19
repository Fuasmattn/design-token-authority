import * as z from 'zod'

/**
 * Runtime schemas for the parts of the Figma Variables API that DTA reads. Strict about the
 * fields we rely on, lenient about anything else Figma adds (unknown keys are dropped).
 * Types are derived from the schemas so what is validated is what the code works with.
 */

const Rgba = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number().optional(),
})

const Alias = z.object({
  type: z.literal('VARIABLE_ALIAS'),
  id: z.string(),
})

const VariableValue = z.union([z.boolean(), z.number(), z.string(), Alias, Rgba])

const CodeSyntax = z.object({
  WEB: z.string().optional(),
  ANDROID: z.string().optional(),
  iOS: z.string().optional(),
})

export const LocalVariableSchema = z.object({
  id: z.string(),
  name: z.string(),
  variableCollectionId: z.string(),
  resolvedType: z.enum(['BOOLEAN', 'COLOR', 'FLOAT', 'STRING']),
  valuesByMode: z.record(z.string(), VariableValue),
  remote: z.boolean(),
  description: z.string(),
  hiddenFromPublishing: z.boolean(),
  scopes: z.array(z.string()),
  codeSyntax: CodeSyntax,
})

export const LocalVariableCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  modes: z.array(z.object({ modeId: z.string(), name: z.string() })),
  defaultModeId: z.string(),
  remote: z.boolean(),
  variableIds: z.array(z.string()),
})

export const LocalVariablesResponseSchema = z.object({
  status: z.number(),
  error: z.literal(false),
  meta: z.object({
    variables: z.record(z.string(), LocalVariableSchema),
    variableCollections: z.record(z.string(), LocalVariableCollectionSchema),
  }),
})

export const PostVariablesResponseSchema = z.object({
  status: z.number(),
  error: z.literal(false),
  meta: z.object({ tempIdToRealId: z.record(z.string(), z.string()) }),
})

export type LocalVariable = z.infer<typeof LocalVariableSchema>
export type LocalVariableCollection = z.infer<typeof LocalVariableCollectionSchema>
export type LocalVariablesResponse = z.infer<typeof LocalVariablesResponseSchema>
export type PostVariablesResult = z.infer<typeof PostVariablesResponseSchema>
