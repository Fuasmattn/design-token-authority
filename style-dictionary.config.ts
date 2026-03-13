import StyleDictionary from 'style-dictionary'

/**
 * Style Dictionary v4 build configuration.
 *
 * Token files in tokens/ use the W3C DTCG format ($type, $value, $description, $extensions).
 * SD v4 reads this format natively — no preprocessing needed.
 *
 * Current output targets:
 *   - CSS custom properties  → build/css/variables.css
 *   - JavaScript ES6 exports → build/js/colorpalette.js
 *
 * Additional output targets (Tailwind, iOS, Android) are tracked in docs/tickets/.
 */
const sd = new StyleDictionary({
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'build/css/',
      files: [
        {
          destination: 'variables.css',
          format: 'css/variables',
          options: {
            outputReferences: true,
          },
        },
      ],
    },
    js: {
      transformGroup: 'js',
      buildPath: 'build/js/',
      files: [
        {
          destination: 'colorpalette.js',
          format: 'javascript/es6',
        },
      ],
    },
  },
})

await sd.buildAllPlatforms()
