"use client"

/**
 * Alert tones for the operator console.
 *
 * Synthesised with Web Audio rather than loaded as files: no asset to fetch,
 * no decode delay on the first incident, and nothing that can 404 on a
 * projector five minutes into a demo.
 *
 * The important decision here is what does NOT make a sound. An `access`
 * event is deliberately silent, because the platform's central claim is that
 * reading a decoy is weak evidence — a backup job or a search indexer
 * produces the same event all night. Sounding an alarm for it would be the
 * alert fatigue this product exists to avoid, demonstrated live. Only `use`
 * has no innocent explanation, so only `use` is audible.
 */

type Ctx = AudioContext & { __wtUnlocked?: boolean }

let ctx: Ctx | null = null

/**
 * Browsers refuse to start audio until the user has interacted with the page.
 * Called from a click handler, this creates or resumes the context so later
 * programmatic tones are permitted.
 */
export async function unlockAudio(): Promise<boolean> {
  try {
    ctx ??= new AudioContext() as Ctx
    if (ctx.state === "suspended") await ctx.resume()
    ctx.__wtUnlocked = ctx.state === "running"
    return Boolean(ctx.__wtUnlocked)
  } catch {
    return false
  }
}

export function audioReady(): boolean {
  return ctx?.state === "running"
}

/** One shaped tone. Gain ramps rather than switches, or the speaker clicks. */
function tone(
  startAt: number,
  freq: number,
  durationSec: number,
  peak: number,
  type: OscillatorType = "square"
): void {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, startAt)

  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec)

  osc.connect(gain).connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + durationSec + 0.02)
}

/**
 * Incident alarm — a decoy's contents were used.
 *
 * Three descending pulses: urgent enough to turn heads in a room, short
 * enough not to talk over. Severity changes the pitch and the count, so a
 * critical is audibly different from a medium without anyone reading the
 * screen.
 */
export function playIncidentAlarm(severity: string): void {
  if (!ctx || ctx.state !== "running") return

  const now = ctx.currentTime
  const critical = severity === "critical" || severity === "high"
  const pulses = critical ? 3 : 2
  const base = critical ? 880 : 660

  for (let i = 0; i < pulses; i++) {
    const at = now + i * 0.19
    tone(at, base - i * 90, 0.13, 0.14)
  }
}

/**
 * Containment confirmation — a short two-note rise, played after the alarm.
 *
 * Distinct from the alarm on purpose: the demo's point is that the response
 * already happened, and hearing the resolution land is what makes that
 * land in a room.
 */
export function playContainedChime(): void {
  if (!ctx || ctx.state !== "running") return
  const now = ctx.currentTime + 0.62
  tone(now, 523, 0.1, 0.09, "sine")
  tone(now + 0.11, 784, 0.16, 0.09, "sine")
}
