/**
 * Timestamp formatting pinned to UTC.
 *
 * Locale-dependent formatting would hydrate mismatched between server and
 * client, so every clock string in the product goes through here.
 */
const pad = (n: number) => String(n).padStart(2, "0")

export function clockTimeUtc(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

export function clockTimeMsUtc(iso: string): string {
  const d = new Date(iso)
  return `${clockTimeUtc(iso)}.${String(d.getUTCMilliseconds()).padStart(3, "0")}`
}
