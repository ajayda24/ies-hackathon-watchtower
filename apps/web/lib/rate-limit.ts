/**
 * Fixed-window rate limiting for the public detection surfaces.
 *
 * Runs in Edge middleware, so the counters live in the instance's own memory.
 * That is a real limitation and worth stating rather than hiding: with several
 * Edge instances serving a region, a flooder gets the limit multiplied by the
 * number of instances they happen to reach. It is a speed bump, not a quota.
 *
 * It is still worth having. The threat is a flood of synthetic triggers
 * polluting the incident pipeline, and cutting a sustained flood by an order
 * of magnitude at the edge — before any function runs, before any database
 * write — removes the cheap version of that attack. The durable version needs
 * a shared counter (Vercel KV or Upstash); the interface below is deliberately
 * shaped so that swap changes one function.
 *
 * Fixed window rather than sliding: a sliding window needs a timestamp list
 * per key, and this runs on every request to an endpoint whose whole job is to
 * respond fast enough to be invisible.
 */

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  ok: boolean
  /** Requests remaining in the current window. */
  remaining: number
  /** Seconds until the window resets — sent as Retry-After on a block. */
  retryAfter: number
}

interface Bucket {
  count: number
  resetAt: number
}

/**
 * Per-endpoint rules.
 *
 * The tracking pixel is the loosest: a document with several embedded assets,
 * or a mail client prefetching, legitimately produces bursts, and a decoy that
 * fails to load its own pixel is a decoy that stopped detecting.
 *
 * The login portal is tightest. A human types a credential a handful of times;
 * anything beyond that from one address in a minute is either a script or the
 * flood this limit exists to blunt.
 */
export const RULES: Record<string, RateLimitRule> = {
  "/api/track": { limit: 60, windowMs: 60_000 },
  "/api/decoy": { limit: 20, windowMs: 60_000 },
  "/api/auth": { limit: 10, windowMs: 60_000 },
}

export function ruleFor(pathname: string): RateLimitRule | null {
  for (const [prefix, rule] of Object.entries(RULES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return rule
  }
  return null
}

// Module scope so the map survives between requests on one instance. It is
// bounded by sweeping expired buckets, so a flood of unique keys cannot grow
// it without limit.
const buckets = new Map<string, Bucket>()
let lastSweep = 0

function sweep(now: number): void {
  // Amortised: at most once per window, not on every request.
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now()
): RateLimitResult {
  sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs })
    return { ok: true, remaining: rule.limit - 1, retryAfter: 0 }
  }

  bucket.count += 1
  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)

  if (bucket.count > rule.limit) {
    return { ok: false, remaining: 0, retryAfter }
  }
  return { ok: true, remaining: rule.limit - bucket.count, retryAfter }
}

/** Test seam: the module-level map would otherwise leak between test cases. */
export function resetRateLimits(): void {
  buckets.clear()
  lastSweep = 0
}
