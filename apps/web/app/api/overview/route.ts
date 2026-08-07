import { recomputeSecurityLevel } from "@/lib/correlation"
import { ensureSeeded } from "@/lib/seed"
import {
  listContainmentActions,
  listDepartments,
  listEvents,
  listHoneytokens,
  listIncidents,
} from "@/lib/store"

/**
 * Single aggregate read for the dashboard. One poll refreshes the whole org
 * map, so the UI needs no request fan-out and no per-department loading states.
 */
export async function GET() {
  ensureSeeded()

  const departments = listDepartments().map((dept) => {
    // Recompute on read so the 24h window in the security-level rule ages out
    // correctly even when no new events are arriving.
    const security_level = recomputeSecurityLevel(dept.id)
    const incidents = listIncidents(dept.id)
    return {
      ...dept,
      security_level,
      honeytoken_count: listHoneytokens(dept.id).length,
      open_incidents: incidents.filter((i) => i.status === "open").length,
      contained_incidents: incidents.filter((i) => i.status === "contained")
        .length,
    }
  })

  return Response.json(
    {
      departments,
      events: listEvents(50),
      incidents: listIncidents(),
      honeytokens: listHoneytokens(),
      containment_actions: listContainmentActions(),
      generated_at: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } }
  )
}
