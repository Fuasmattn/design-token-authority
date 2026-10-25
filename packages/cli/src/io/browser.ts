/**
 * Headless Chromium through playwright-core, an optional peer dependency: only `dta diff`
 * loads it. `DTA_BROWSER_PATH` points at a Chromium binary when Playwright's own download
 * is not installed (containers, CI images).
 */
export class BrowserUnavailableError extends Error {
  constructor(reason: string) {
    // What to do is the problem's Fix line (diffProblems.noBrowser), said once (TICKET-148).
    super(`No browser for screenshots (${reason}).`)
    this.name = 'BrowserUnavailableError'
  }
}

export interface Screenshotter {
  /**
   * Full-page PNG of `url` at `width` px, deterministic settings, or null on HTTP errors.
   * `ready`: a JavaScript expression to wait for after network idle (e.g. Storybook's render).
   */
  capture(url: string, width: number, ready?: string): Promise<Uint8Array | null>
  /**
   * Loads `url` like `capture` and hands `use` a function that runs `script` (a function
   * expression) with `arg` in that page; returns what `use` returns, or null on HTTP errors.
   */
  inspect<T>(
    url: string,
    width: number,
    ready: string | undefined,
    use: (run: (script: string, arg: unknown) => Promise<unknown>) => Promise<T>,
  ): Promise<T | null>
  close(): Promise<void>
}

/** The small part of playwright-core this module uses. */
interface Page {
  goto(url: string, options: object): Promise<{ ok(): boolean } | null>
  evaluate(expression: string): Promise<unknown>
  waitForFunction(expression: string, arg: unknown, options: object): Promise<unknown>
  screenshot(options: object): Promise<Uint8Array>
}
interface Browser {
  newContext(options: object): Promise<{
    newPage(): Promise<Page>
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
  /** Opens `url` at `width` with the deterministic settings and hands the page to `use`. */
  async function withPage<T>(
    url: string,
    width: number,
    ready: string | undefined,
    use: (page: Page) => Promise<T>,
  ): Promise<T | null> {
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
      if (ready) await page.waitForFunction(ready, undefined, { timeout: 30_000 })
      await page.evaluate('document.fonts.ready.then(() => true)')
      return await use(page)
    } finally {
      await context.close()
    }
  }

  return {
    capture: (url, width, ready) =>
      withPage(url, width, ready, (page) =>
        page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
      ),
    inspect: (url, width, ready, use) =>
      withPage(url, width, ready, (page) =>
        use((script, arg) => page.evaluate(`(${script})(${JSON.stringify(arg)})`)),
      ),
    close: () => browser.close(),
  }
}
