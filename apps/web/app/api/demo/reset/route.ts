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

  const [departments, honeytokens, events, incidents] = await Promise.all([
    listDepartments(),
    listHoneytokens(),
    listEvents(10_000),
    listIncidents(),
  ])
  const before = {
    departments: departments.length,
    honeytokens: honeytokens.length,
    events: events.length,
    incidents: incidents.length,
  }

  await resetStore()
  await ensureSeeded()

  const [seededDepts, seededTokens] = await Promise.all([
    listDepartments(),
    listHoneytokens(),
  ])

  return Response.json(
    {
      ok: true,
      cleared: before,
      seeded: {
        departments: seededDepts.length,
        honeytokens: seededTokens.length,
      },
    },
    { headers: { "cache-control": "no-store" } }
  )
}
