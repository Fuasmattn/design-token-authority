/**
 * Regex matching most emoji characters (emoji presentation sequences, skin tone modifiers,
 * variation selectors, ZWJ sequences and a few symbols designers use in collection names).
 */
const EMOJI =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{231A}-\u{23F3}\u{23CF}\u{2934}-\u{2935}\u{25AA}-\u{25FE}\u{2702}-\u{27B0}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]|[\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}]|[●◈✴️⬜⭕❖↪🔲🕳🛠🌀🌼🎨📐📱]/gu

/** A name for use in a file name; with `stripEmojis`, emoji and the spaces around them go. */
export function sanitizeFileName(name: string, stripEmojis: boolean): string {
  return stripEmojis ? name.replace(EMOJI, '').replace(/\s+/g, ' ').trim() : name
}

/** `{Collection}.{Mode}.json` with both parts sanitized separately. */
export function sanitizeTokenFileName(fileName: string, stripEmojis: boolean): string {
  const base = fileName.replace(/\.json$/, '')
  const dot = base.indexOf('.')
  if (dot === -1) return `${sanitizeFileName(base, stripEmojis)}.json`
  const collection = sanitizeFileName(base.slice(0, dot), stripEmojis)
  const mode = sanitizeFileName(base.slice(dot + 1), stripEmojis)
  return `${collection}.${mode}.json`
}
