import type { NextRequest } from "next/server"

import { ensureSeeded } from "@/lib/seed"
import {
  getDepartment,
  listContainmentActions,
  listHoneytokens,
  listIncidentEvents,
  listIncidents,
} from "@/lib/store"

/** Full detail for one incident: correlated events, decoys, containment log. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/incidents/[id]">
) {
  ensureSeeded()
  const { id } = await ctx.params

  const incident = listIncidents().find((i) => i.id === id)
  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 })
  }

  const events = listIncidentEvents(incident.id)
  const tokenIds = new Set(events.map((e) => e.token_id))

  return Response.json(
    {
      incident,
      department: getDepartment(incident.department_id) ?? null,
      events,
      honeytokens: listHoneytokens().filter((t) => tokenIds.has(t.id)),
      containment_actions: listContainmentActions(incident.id),
    },
    { headers: { "cache-control": "no-store" } }
  )
}
