import type { NextRequest } from "next/server"

import { recordTrigger } from "@/lib/correlation"
import { clientIp } from "@/lib/request"
import { ensureSeeded } from "@/lib/seed"
import { listHoneytokens } from "@/lib/store"
import type { Honeytoken } from "@/lib/types"

/**
 * Mock login portal — the `use` path, and the sharpest signal in the system.
 *
 * Seeded credential content is stored as "username / password". A submission
 * matching a decoy's username means someone took a planted credential and
 * tried to authenticate with it. No legitimate process does that, so this
 * escalates immediately.
 */
async function matchCredential(
  username: string
): Promise<Honeytoken | undefined> {
  const tokens = await listHoneytokens()
  return tokens.find((token) => {
    if (token.type !== "credential") return false
    const [user] = token.content.split("/").map((s) => s.trim())
    return user?.toLowerCase() === username.trim().toLowerCase()
  })
}

export async function POST(req: NextRequest) {
  let username = ""
  let password = ""

  // Accept both JSON and form posts so the decoy page can be a plain <form>.
  const contentType = req.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    username = String(body.username ?? "")
    password = String(body.password ?? "")
  } else {
    const form = await req.formData().catch(() => null)
    username = String(form?.get("username") ?? "")
    password = String(form?.get("password") ?? "")
  }

  // Wrapped for the same reason as the tracking pixel: the response below is
  // what makes the portal indistinguishable from a real one, and a storage
  // error escaping here would return a 500 for decoy credentials only —
  // handing the attacker a way to tell planted accounts from unknown ones.
  try {
    await ensureSeeded()
    const token = await matchCredential(username)
    if (token) {
      await recordTrigger({
        token,
        eventType: "use",
        sourceIp: clientIp(req),
        details: {
          submitted_username: username,
          // Never store the submitted secret; length alone is enough to show
          // whether the planted password was used verbatim.
          submitted_password_length: password.length,
          user_agent: req.headers.get("user-agent") ?? "unknown",
          vector: "mock_login_portal",
        },
      })
    }
  } catch (err) {
    console.error("[decoy/login] failed to record use event", err)
  }

  // Uniform failure either way. The attacker must not learn they hit a decoy.
  //
  // A browser posting the portal's <form> is sent back to the portal with an
  // error flag, exactly as a real sign-in failure would be; anything else gets
  // the JSON. Returning JSON to the browser would dump a raw response body on
  // screen, which no working portal does and which breaks the illusion at the
  // exact moment the decoy is being used.
  const wantsHtml =
    !contentType.includes("application/json") &&
    (req.headers.get("accept") ?? "").includes("text/html")

  if (wantsHtml) {
    const back = new URL("/portal/login", req.url)
    back.searchParams.set("error", "1")
    const ip = new URL(req.url).searchParams.get("ip")
    if (ip) back.searchParams.set("ip", ip)
    // 303: turns the POST into a GET so a refresh does not resubmit.
    return Response.redirect(back, 303)
  }

  return Response.json(
    { ok: false, error: "Invalid username or password." },
    { status: 401 }
  )
}
