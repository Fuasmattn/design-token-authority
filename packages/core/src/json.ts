/**
 * JSON.parse for token and resolver files that leaves out every "__proto__" key, at any depth
 * (TICKET-175). JSON.parse keeps it as an own key, but code that copies the data into a new object
 * (`obj[key] = value`, deepmerge) sets that object's prototype instead: Style Dictionary looped on
 * a token group named "__proto__". The caller reports how many were left out.
 */
export function parseTokenJson(content: string): { value: unknown; reservedKeys: number } {
  let reservedKeys = 0
  const value: unknown = JSON.parse(content, (key, child: unknown) => {
    if (key !== '__proto__') return child
    reservedKeys++
    return undefined
  })
  return { value, reservedKeys }
}

/** The message for a file that had "__proto__" keys. */
export function reservedKeyMessage(fileName: string, count: number): string {
  return `"${fileName}" contains ${count === 1 ? 'a "__proto__" key' : `${count} "__proto__" keys`}; JavaScript reserves the name, so ${count === 1 ? 'it is' : 'they are'} left out.`
}
