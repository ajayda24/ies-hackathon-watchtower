import { recomputeSecurityLevel } from "@/lib/correlation"
import { ensureSeeded } from "@/lib/seed"
import {
  listContainmentActions,
  listDepartments,
  listEvents,
  listHoneytokens,
  listIncidents,
  storageDegraded,
  storageMode,
} from "@/lib/store"

/**
 * Single aggregate read for the dashboard. One poll refreshes the whole org
 * map, so the UI needs no request fan-out and no per-department loading states.
 *
 * Everything is fetched once and grouped in memory. The per-department numbers
 * used to be derived with per-department calls, which against a database would
 * issue roughly four queries per department every two seconds — the shape that
 * turns a polling dashboard into a load generator.
 */
export async function GET() {
  await ensureSeeded()

  const [departments, events, incidents, honeytokens, containment_actions] =
    await Promise.all([
      listDepartments(),
      listEvents(50),
      listIncidents(),
      listHoneytokens(),
      listContainmentActions(),
    ])

  // Recompute on read so the 24h window in the security-level rule ages out
  // correctly even when no new events are arriving. These write, so they run
  // together rather than serially behind each other.
  const levels = await Promise.all(
    departments.map((dept) => recomputeSecurityLevel(dept.id))
  )

  const tokensByDept = new Map<string, number>()
  for (const token of honeytokens) {
    tokensByDept.set(
      token.department_id,
      (tokensByDept.get(token.department_id) ?? 0) + 1
    )
  }

  const summary = departments.map((dept, i) => {
    const mine = incidents.filter((inc) => inc.department_id === dept.id)
    return {
      ...dept,
      security_level: levels[i]!,
      honeytoken_count: tokensByDept.get(dept.id) ?? 0,
      open_incidents: mine.filter((inc) => inc.status === "open").length,
      contained_incidents: mine.filter((inc) => inc.status === "contained")
        .length,
    }
  })

  return Response.json(
    {
      departments: summary,
      events,
      incidents,
      honeytokens,
      containment_actions,
      generated_at: new Date().toISOString(),
      // Surfaced so the UI can state where data is living rather than implying
      // persistence that is not happening.
      storage: { mode: storageMode(), degraded: storageDegraded() },
    },
    { headers: { "cache-control": "no-store" } }
  )
}
