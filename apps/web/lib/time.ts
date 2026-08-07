/**
 * Timestamp formatting.
 *
 * Two families, and the split matters:
 *
 * `*Utc` is for anything rendered on the server — AI prompts, report bodies,
 * SIEM payloads. The server's timezone is not the viewer's, so a "local" time
 * produced there would be local to a datacentre and wrong for everyone.
 *
 * `*Local` is for the browser, where the operator's own clock is what makes an
 * incident legible ("22:13 — that was ten minutes ago"). These must never run
 * during server rendering: the server would format in its zone, the client in
 * the viewer's, and React would report a hydration mismatch. `useClock()` in
 * components/wt.tsx enforces that by returning UTC until after mount.
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

export function clockTimeLocal(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function clockTimeMsLocal(iso: string): string {
  const d = new Date(iso)
  return `${clockTimeLocal(iso)}.${String(d.getMilliseconds()).padStart(3, "0")}`
}

/**
 * Short zone label for the clock in the top bar — "IST", "GMT+5:30", "UTC".
 *
 * Falls back to a fixed offset string when the runtime has no short name, and
 * to "UTC" when called before mount.
 */
export function zoneLabel(): string {
  try {
    const name = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value
    return name ?? "UTC"
  } catch {
    return "UTC"
  }
}

/**
 * Elapsed milliseconds rendered the way an operator reads latency.
 *
 * Precision rises as the number shrinks. Correlation against an in-memory
 * store finishes in a fraction of a millisecond, and a whole-number format
 * would print that as "0ms" — a result that reads as broken instead of fast.
 * Values under 1ms therefore keep two decimals, and sub-second values keep
 * millisecond precision rather than rounding to "0s".
 */
export function formatLatency(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)}ms`
  if (ms < 10) return `${ms.toFixed(1)}ms`
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`
  return `${Math.round(ms / 1000)}s`
}
