/**
 * The publish hook (spec decision 11): a project command that uploads the report folder
 * somewhere and prints where. DTA knows no hosting provider; it only reads the URL back.
 */

/**
 * The report's public base URL from the hook's stdout. Without `pattern`: the last non-empty
 * line. A pattern starting with `$.` is a path into the JSON the hook printed (whole stdout or
 * its last line, e.g. `$.deployment.url`); any other pattern is a regular expression whose first
 * group (or whole match) is the URL. Returns null unless the result is an http(s) URL.
 */
export function extractPublishUrl(stdout: string, pattern?: string): string | null {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  let found: unknown
  if (!pattern) {
    found = lines.at(-1)
  } else if (pattern.startsWith('$.')) {
    const parse = (text: string | undefined): unknown => {
      try {
        return text === undefined ? undefined : JSON.parse(text)
      } catch {
        return undefined
      }
    }
    let node = parse(stdout.trim()) ?? parse(lines.at(-1))
    for (const key of pattern.slice(2).split('.').filter(Boolean)) {
      node =
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[key]
          : undefined
    }
    found = node
  } else {
    let regex: RegExp
    try {
      regex = new RegExp(pattern)
    } catch {
      return null
    }
    const match = regex.exec(stdout)
    found = match ? (match[1] ?? match[0]) : undefined
  }
  if (typeof found !== 'string') return null
  const url = found.trim().replace(/\/+$/, '')
  return /^https?:\/\/\S+$/.test(url) ? url : null
}
