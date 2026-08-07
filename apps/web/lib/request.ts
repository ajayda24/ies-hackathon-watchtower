import type { NextRequest } from "next/server"

/**
 * Best-effort client IP.
 *
 * Locally every request arrives as ::1, which would collapse the whole demo
 * onto a single source and make the severity ladder look broken. A `?ip=`
 * override lets the rehearsed attack present distinct sources; in production
 * the proxy headers are authoritative.
 */
export function clientIp(req: NextRequest): string {
  const override = new URL(req.url).searchParams.get("ip")
  if (override) return override

  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()

  return req.headers.get("x-real-ip") ?? "127.0.0.1"
}
