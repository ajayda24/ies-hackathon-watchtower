import { NextResponse, type NextRequest } from "next/server"

/**
 * Gates the operator console behind a passphrase.
 *
 * Runs on the Edge runtime, which has no `node:crypto` — so the HMAC is
 * recomputed here with Web Crypto rather than importing lib/auth.ts. The two
 * implementations must produce the same digest; the shared format is
 * "<expiry-ms>.<hex hmac-sha256 of expiry, keyed by the passphrase>".
 *
 * What is deliberately NOT protected:
 *
 *   /portal/login   the fake login portal an attacker is meant to reach
 *   /share/*        decoy documents, likewise
 *   /api/decoy/*    the `use` detection surface
 *   /api/track/*    the `access` detection surface
 *
 * Those four are the product. Putting a login in front of a honeytoken would
 * mean only authenticated users could trigger it, which defeats the entire
 * mechanism — the whole point is that an intruder reaches them freely.
 */

const SESSION_COOKIE = "wt_operator"

/** Paths that must stay reachable without a session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/portal",
  "/share",
  "/api/decoy",
  "/api/track",
  "/api/auth",
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

async function verify(value: string | undefined, secret: string) {
  if (!value) return false
  const [expiryRaw, mac] = value.split(".")
  if (!expiryRaw || !mac) return false

  const expiry = Number(expiryRaw)
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(expiryRaw)
  )
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Constant-time compare: `===` returns on the first differing byte, which
  // leaks how much of a forged signature was right.
  if (mac.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < mac.length; i++) {
    diff |= mac.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

export async function middleware(req: NextRequest) {
  const secret = process.env.OPERATOR_PASSPHRASE
  // Unset means the console is open. The demo runs this way by default, and
  // /scope says so rather than leaving it to be discovered.
  if (!secret) return

  const { pathname, search } = req.nextUrl
  if (isPublic(pathname)) return

  if (await verify(req.cookies.get(SESSION_COOKIE)?.value, secret)) {
    return
  }

  // API routes get a status, not a redirect — a fetch following a 307 to an
  // HTML login page fails as a confusing JSON parse error instead of a 401.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  // Preserved so a deep link survives the login round-trip.
  url.searchParams.set("next", pathname + search)
  return NextResponse.redirect(url)
}

export const config = {
  // Skips Next internals and static assets; everything else is evaluated
  // above, where the public list decides.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
