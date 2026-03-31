export function green(msg: string) {
  return `\x1b[32m${msg}\x1b[0m`
}

export function brightRed(msg: string) {
  return `\x1b[1;31m${msg}\x1b[0m`
}

export function areSetsEqual<T>(a: Set<T>, b: Set<T>) {
  return a.size === b.size && [...a].every((item) => b.has(item))
}

// ---------------------------------------------------------------------------
// Filename sanitization
// ---------------------------------------------------------------------------

/**
 * Regex matching most emoji characters (Unicode emoji presentation sequences,
 * skin tone modifiers, variation selectors, ZWJ sequences, etc.)
 */
const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{231A}-\u{23F3}\u{23CF}\u{2934}-\u{2935}\u{25AA}-\u{25FE}\u{2702}-\u{27B0}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]|[\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}]|[●◈✴️⬜⭕❖↪🔲🕳🛠🌀🌼🎨📐📱]/gu

/**
 * Sanitize a name for use in a filename.
 * If stripEmojis is true, removes all emoji characters and cleans up resulting whitespace.
 */
export function sanitizeFileName(name: string, stripEmojis: boolean): string {
  if (stripEmojis) {
    return name.replace(EMOJI_REGEX, '').replace(/\s+/g, ' ').trim()
  }
  return name
}
