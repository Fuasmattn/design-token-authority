/**
 * Headless Chromium through playwright-core, an optional peer dependency: only `dta diff`
 * loads it. `DTA_BROWSER_PATH` points at a Chromium binary when Playwright's own download
 * is not installed (containers, CI images).
 */
export class BrowserUnavailableError extends Error {
  constructor(reason: string) {
    super(
      `No browser for screenshots (${reason}). Install it with \`npm i -D playwright-core\` and ` +
        '`npx playwright install chromium`, or set DTA_BROWSER_PATH to a Chromium binary.',
    )
    this.name = 'BrowserUnavailableError'
  }
}

export interface Screenshotter {
  /** Full-page PNG of `url` at `width` px, deterministic settings, or null on HTTP errors. */
  capture(url: string, width: number): Promise<Uint8Array | null>
  close(): Promise<void>
}

/** The small part of playwright-core this module uses. */
interface Browser {
  newContext(options: object): Promise<{
    newPage(): Promise<{
      goto(url: string, options: object): Promise<{ ok(): boolean } | null>
      evaluate(expression: string): Promise<unknown>
      screenshot(options: object): Promise<Uint8Array>
    }>
    close(): Promise<void>
  }>
  close(): Promise<void>
}
interface PlaywrightCore {
  chromium: { launch(options: { executablePath?: string }): Promise<Browser> }
}

export async function launchScreenshotter(): Promise<Screenshotter> {
  let playwright: PlaywrightCore
  try {
    playwright = (await import('playwright-core')) as unknown as PlaywrightCore
  } catch {
    throw new BrowserUnavailableError('playwright-core is not installed')
  }
  let browser: Browser
  try {
    browser = await playwright.chromium.launch({
      executablePath: process.env.DTA_BROWSER_PATH || undefined,
    })
  } catch (error) {
    throw new BrowserUnavailableError(String((error as Error).message).split('\n')[0])
  }
  return {
    async capture(url, width) {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        colorScheme: 'light',
        locale: 'en-US',
        timezoneId: 'UTC',
      })
      try {
        const page = await context.newPage()
        const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
        if (!response || !response.ok()) return null
        await page.evaluate('document.fonts.ready.then(() => true)')
        return await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
      } finally {
        await context.close()
      }
    },
    close: () => browser.close(),
  }
}
