import type { NextRequest } from "next/server"

import { ensureSeeded } from "@/lib/seed"
import {
  listDepartments,
  listEvents,
  listHoneytokens,
  listIncidents,
  resetStore,
} from "@/lib/store"

/**
 * Demo reset — returns the board to its seeded state.
 *
 * Exists because the alternative recovery path, mid-presentation, is
 * restarting the dev server in front of the audience. A failed run should cost
 * one click.
 *
 * POST only. A GET that wiped the store would fire on a browser prefetch, a
 * link preview, or a stray address-bar visit — all of which happen during a
 * demo, and all of which would clear the board at the worst moment.
 *
 * Disabled when ALLOW_DEMO_RESET is "false", so an unauthenticated destructive
 * endpoint cannot ship anywhere real by accident.
 */
export async function POST(_req: NextRequest) {
  if (process.env.ALLOW_DEMO_RESET === "false") {
    return Response.json(
      { error: "Demo reset is disabled in this environment." },
      { status: 403 }
    )
  }

  const before = {
    departments: listDepartments().length,
    honeytokens: listHoneytokens().length,
    events: listEvents(10_000).length,
    incidents: listIncidents().length,
  }

  resetStore()
  ensureSeeded()

  return Response.json(
    {
      ok: true,
      cleared: before,
      seeded: {
        departments: listDepartments().length,
        honeytokens: listHoneytokens().length,
      },
    },
    { headers: { "cache-control": "no-store" } }
  )
}
