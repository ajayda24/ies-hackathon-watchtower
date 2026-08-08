import type { NextRequest } from "next/server"

import { buildProfile } from "@/lib/profile"
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
  await ensureSeeded()
  const { id } = await ctx.params

  const incidents = await listIncidents()
  const incident = incidents.find((i) => i.id === id)
  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 })
  }

  const events = await listIncidentEvents(incident.id)
  const tokenIds = new Set(events.map((e) => e.token_id))

  const [department, honeytokens, containment_actions] = await Promise.all([
    getDepartment(incident.department_id),
    listHoneytokens(),
    listContainmentActions(incident.id),
  ])

  const involved = honeytokens.filter((t) => tokenIds.has(t.id))

  // Derived on read rather than stored. A profile is a view over the events,
  // so persisting it would let it drift out of date the moment another event
  // correlates into this incident.
  const profile = buildProfile(events, new Map(honeytokens.map((t) => [t.id, t])))

  return Response.json(
    {
      incident,
      department: department ?? null,
      events,
      honeytokens: involved,
      containment_actions,
      profile,
    },
    { headers: { "cache-control": "no-store" } }
  )
}
