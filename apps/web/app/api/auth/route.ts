import type { NextRequest } from "next/server"

import { SESSION_COOKIE, authConfigured, checkPassphrase, issueSession } from "@/lib/auth"

/** Signs an operator in. */
export async function POST(req: NextRequest) {
  if (!authConfigured()) {
    return Response.json(
      { error: "Operator authentication is not enabled on this deployment." },
      { status: 400 }
    )
  }

  const body = (await req.json().catch(() => ({}))) as { passphrase?: string }

  if (!checkPassphrase(String(body.passphrase ?? ""))) {
    // Deliberately vague and uniformly slow-pathed: there is one credential,
    // so "wrong passphrase" and "no passphrase" are the same failure.
    return Response.json({ error: "Incorrect passphrase." }, { status: 401 })
  }

  const session = issueSession()
  const res = Response.json({ ok: true })
  res.headers.append(
    "set-cookie",
    [
      `${SESSION_COOKIE}=${session.value}`,
      "Path=/",
      `Max-Age=${session.maxAge}`,
      "HttpOnly",
      "SameSite=Lax",
      // Secure is omitted on http://localhost, where the browser would
      // otherwise drop the cookie and make sign-in appear to silently fail.
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ")
  )
  return res
}

/** Signs out by expiring the cookie. */
export async function DELETE() {
  const res = Response.json({ ok: true })
  res.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  )
  return res
}
