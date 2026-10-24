/** What a dimension token is for, by the words in its name (`radius`, `spacing`, `gap` …). */
export function dimensionKind(
  path: readonly string[],
): 'radius' | 'spacing' | 'font-size' | 'blur' | 'breakpoint' | null {
  const words = path.join(' ').toLowerCase()
  if (/radius|radii|rounded/.test(words)) return 'radius'
  if (/font[- ]?size|text[- ]?size/.test(words)) return 'font-size'
  if (/spacing|space|gap|padding|margin|inset/.test(words)) return 'spacing'
  if (/blur/.test(words)) return 'blur'
  if (/breakpoint|screen/.test(words)) return 'breakpoint'
  return null
}
