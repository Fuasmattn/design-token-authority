// @ts-check
/**
 * Expressive Code's options (Starlight reads this file; the <Code> component needs them here, not
 * in astro.config.mjs). Code blocks are Graphite in both site themes (TICKET-178): one dark syntax
 * theme, and every frame colour a DTA semantic token. Each block group carries
 * data-brand="graphite", so those tokens resolve to Graphite inside it whatever the page's theme.
 * On the light theme a dark block stands out from the paper; the light frame did not (its border
 * was about 1.1:1 on the page).
 */
import { defineEcConfig } from '@astrojs/starlight/expressive-code'
import fs from 'node:fs'
import path from 'node:path'

const BRAND = 'graphite'

/**
 * A semantic token's colour in Graphite, read from the built token CSS (`pnpm tokens` runs before
 * every Astro command). Expressive Code needs one real colour for the code background: it raises
 * syntax colours to the minimum contrast against it.
 * @param {string} name token variable without the leading dashes, e.g. 'bg-subtle'
 */
function graphite(name) {
  // Not relative to this file: Astro bundles it for the <Code> component. Astro runs in site/.
  const dir = path.join(process.cwd(), 'output', 'css')
  /** @param {string} file */
  const read = (file) => {
    const full = path.join(dir, file)
    if (!fs.existsSync(full)) throw new Error(`${full} is missing: run \`pnpm tokens\` first`)
    return fs.readFileSync(full, 'utf8')
  }
  const css = read(path.join('themes', `${BRAND}.css`)) + read('base.css')
  /** @type {(variable: string) => string} */
  const resolve = (variable) => {
    const match = css.match(new RegExp(`--${variable}:\\s*([^;]+);`))
    if (!match) throw new Error(`--${variable} not found in the built token CSS`)
    const value = match[1].trim()
    const alias = value.match(/^var\(--([\w-]+)\)$/)
    return alias ? resolve(alias[1]) : value
  }
  return resolve(name)
}

export default defineEcConfig({
  themes: ['starlight-dark'],
  // Starlight's mapping goes through its --sl-color-* variables, which resolve at the page root
  // (light on the light theme); customizeTheme maps onto the tokens instead.
  useStarlightUiThemeColors: false,
  // The --ec-* variables on each block, not on :root: there the token variables they use would
  // resolve in the page's theme, before the block's data-brand applies.
  themeCssRoot: '.expressive-code',
  // AAA for code text, like every other text on the site.
  minSyntaxHighlightingColorContrast: 7,
  customizeTheme: (theme) => {
    const border = 'var(--border-default)'
    theme.bg = graphite('bg-subtle')
    theme.fg = graphite('fg-default')
    Object.assign(theme.colors, {
      'editor.background': theme.bg,
      'editor.foreground': theme.fg,
      'titleBar.border': border,
      'editorGroupHeader.tabsBorder': border,
      'titleBar.activeBackground': 'var(--bg-canvas)',
      'editorGroupHeader.tabsBackground': 'var(--bg-canvas)',
      'titleBar.activeForeground': 'var(--fg-default)',
      'tab.activeForeground': 'var(--fg-default)',
      'tab.activeBorder': 'transparent',
      'tab.activeBorderTop': 'var(--action-bg)',
      'scrollbarSlider.background': 'var(--bg-hover)',
      'scrollbarSlider.hoverBackground': 'var(--fg-subtle)',
    })
    theme.styleOverrides.frames = {
      editorBackground: 'var(--bg-subtle)',
      terminalBackground: 'var(--bg-subtle)',
      editorActiveTabBackground: 'var(--bg-subtle)',
      terminalTitlebarDotsForeground: 'var(--fg-subtle)',
      terminalTitlebarDotsOpacity: '1',
      inlineButtonForeground: 'var(--fg-default)',
      frameBoxShadowCssValue: 'none',
    }
    theme.styleOverrides.textMarkers = {
      markBackground: 'var(--bg-hover)',
      markBorderColor: 'var(--fg-subtle)',
    }
    return theme
  },
  plugins: [
    {
      name: 'DTA Graphite code blocks',
      hooks: {
        postprocessRenderedBlockGroup: ({ renderData }) => {
          renderData.groupAst.properties['data-brand'] = BRAND
        },
      },
    },
  ],
})
