/**
 * JSON Schema of what `dta token get|find|list --format json` prints (`dta.token/1`). Published
 * on the website at /schemas/dta.token.schema.json; the tests validate real output against it.
 */
const value = { type: ['string', 'number', 'boolean'] }
const type = { enum: ['color', 'number', 'string', 'boolean'] }
const modes = {
  type: 'object',
  description:
    'The modes of multi-mode collections the resolution went through, e.g. {"Brand(Alias)": "BrandB"}; empty when none',
  additionalProperties: { type: 'string' },
}
const code = {
  type: 'object',
  description:
    'The names `dta build` gives the token in code; missing when the build does not write the token (a multi-mode collection with no mode in `brands`)',
  required: ['css'],
  additionalProperties: false,
  properties: {
    css: { type: 'string', description: 'CSS custom property, e.g. --colors-brand-primary' },
    tailwind: {
      type: 'string',
      description: 'Tailwind v4 theme variable, when the token maps to a utility namespace',
    },
  },
}
const base = (kind: string) => ({
  schema: { const: 'dta.token/1' },
  kind: { const: kind },
})

export function tokenJsonSchema(): Record<string, unknown> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'dta token --format json',
    description: 'Output of dta token get, find and list with --format json (version dta.token/1).',
    oneOf: [
      {
        title: 'dta token get',
        type: 'object',
        required: ['schema', 'kind', 'name', 'type', 'collection', 'readings'],
        additionalProperties: false,
        properties: {
          ...base('token'),
          name: { type: 'string' },
          type,
          collection: { type: 'string' },
          description: { type: 'string' },
          readings: {
            type: 'array',
            description: 'One reading per distinct mode combination the alias chain goes through',
            items: {
              type: 'object',
              required: ['modes', 'chain'],
              additionalProperties: false,
              properties: {
                modes,
                raw: { ...value, description: 'The value as written, a value or an {alias}' },
                value: { ...value, description: 'The resolved value' },
                chain: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Token names along the alias chain, the token itself first',
                },
                error: { type: 'string', description: 'Why the token did not resolve' },
              },
            },
          },
          code,
        },
      },
      {
        title: 'dta token get, unknown name (exit code 1)',
        type: 'object',
        required: ['schema', 'kind', 'name', 'suggestions'],
        additionalProperties: false,
        properties: {
          ...base('unknown'),
          name: { type: 'string' },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
      },
      {
        title: 'dta token find',
        type: 'object',
        required: ['schema', 'kind', 'query', 'matches'],
        additionalProperties: false,
        properties: {
          ...base('matches'),
          query: { type: 'string' },
          matches: {
            type: 'array',
            description:
              'Deepest alias chain first: component and semantic tokens before primitives',
            items: {
              type: 'object',
              required: ['name', 'type', 'collection', 'modes', 'value', 'depth'],
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                type,
                collection: { type: 'string' },
                modes,
                value,
                depth: { type: 'integer', description: 'Alias steps to the value; 0 holds it' },
                code,
              },
            },
          },
        },
      },
      {
        title: 'dta token list',
        type: 'object',
        required: ['schema', 'kind', 'tokens'],
        additionalProperties: false,
        properties: {
          ...base('list'),
          tokens: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'type', 'collection', 'alias'],
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                type,
                collection: { type: 'string' },
                alias: { type: 'boolean', description: 'The value is an alias in every mode' },
              },
            },
          },
        },
      },
    ],
  }
}
