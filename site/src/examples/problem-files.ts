/**
 * A tiny token set that breaks the default lint rules, for the stories of the playground's lint
 * view: a dangling alias and Figma's default mode name. The stories show what the playground
 * really prints for it.
 */
export const PROBLEM_FILES = [
  {
    fileName: 'Primitives.Mode 1.json',
    content: JSON.stringify({
      Colors: { Blue: { '700': { $type: 'color', $value: '#0057b8' } } },
    }),
  },
  {
    fileName: 'Brand.BrandA.json',
    content: JSON.stringify({
      Colors: {
        Primary: { $type: 'color', $value: '{Colors.Blue.700}' },
        Accent: { $type: 'color', $value: '{Colors.Orange.500}' },
      },
    }),
  },
]
