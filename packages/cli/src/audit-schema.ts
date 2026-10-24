/**
 * JSON Schema of `dta audit --format json` (`dta.audit/1`). Published on the website at
 * /schemas/dta.audit.schema.json; the tests validate real output against it.
 */
export function auditJsonSchema(): Record<string, unknown> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'dta audit --format json',
    description:
      'Hard-coded values in code that equal a token (version dta.audit/1). Findings in the baseline are counted, not listed.',
    type: 'object',
    required: ['schema', 'findings', 'baselined', 'files'],
    additionalProperties: false,
    properties: {
      schema: { const: 'dta.audit/1' },
      findings: {
        type: 'array',
        description: 'Findings not in the baseline, by file and position',
        items: {
          type: 'object',
          required: ['file', 'line', 'column', 'value', 'kind', 'context', 'token'],
          additionalProperties: false,
          properties: {
            file: { type: 'string', description: 'Relative to the project, with forward slashes' },
            line: { type: 'integer', minimum: 1 },
            column: { type: 'integer', minimum: 1 },
            value: { type: 'string', description: 'The value as written, e.g. #2f55d4 or 16px' },
            kind: { enum: ['color', 'spacing', 'radius', 'stroke', 'font-size', 'font-family'] },
            context: {
              type: 'string',
              description: 'The CSS property, object key or Tailwind utility (bg-[…]) it is in',
            },
            token: { type: 'string', description: 'The token to use instead' },
            code: {
              type: 'object',
              description: 'The names `dta build` gives that token; missing when it is not built',
              required: ['css'],
              additionalProperties: false,
              properties: { css: { type: 'string' }, tailwind: { type: 'string' } },
            },
          },
        },
      },
      baselined: { type: 'integer', minimum: 0, description: 'Findings the baseline accepts' },
      files: { type: 'integer', minimum: 0, description: 'Files scanned' },
    },
  }
}
