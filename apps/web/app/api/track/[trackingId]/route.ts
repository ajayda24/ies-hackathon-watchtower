import type { NextRequest } from "next/server"

import { recordTrigger } from "@/lib/correlation"
import { clientIp } from "@/lib/request"
import { ensureSeeded } from "@/lib/seed"
import { getHoneytokenByTrackingId } from "@/lib/store"

/** 1x1 transparent GIF. */
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
)

/**
 * Document tracking pixel — the `access` path.
 *
 * Embedded in a decoy document; fires when the document is opened. This is the
 * *soft* signal: it proves someone looked, not that they acted on it, so it
 * never escalates to an incident on its own.
 *
 * Always returns the pixel, even for an unknown tracking id — an attacker
 * should never be able to tell a live decoy from a dead link.
 */
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/track/[trackingId]">
) {
  const { trackingId } = await ctx.params

  // Logging must never decide whether the pixel is served. A storage error
  // that escaped this block would return a 500, and a broken image where a
  // document expects one tells the attacker this file is instrumented — the
  // one thing the decoy cannot afford to reveal. Fail silently, serve the GIF.
  try {
    await ensureSeeded()
    const token = await getHoneytokenByTrackingId(trackingId)
    if (token) {
      await recordTrigger({
        token,
        eventType: "access",
        sourceIp: clientIp(req),
        details: {
          user_agent: req.headers.get("user-agent") ?? "unknown",
          referer: req.headers.get("referer") ?? null,
          vector: "document_tracking_pixel",
        },
      })
    }
  } catch (err) {
    console.error("[track] failed to record access event", err)
  }

  return new Response(new Uint8Array(PIXEL), {
    headers: {
      "content-type": "image/gif",
      // Must not cache: a cached pixel means the second open never reports.
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  })
}
