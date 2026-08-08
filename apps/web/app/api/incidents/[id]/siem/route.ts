import type { NextRequest } from "next/server"

import { ORG_NAME } from "@/lib/org"
import { ensureSeeded } from "@/lib/seed"
import { buildSiemPayload, forwardToSiem } from "@/lib/siem"
import {
  getDepartment,
  listContainmentActions,
  listIncidentEvents,
  listIncidents,
} from "@/lib/store"

/** GET previews the payload; POST attempts to forward it. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/incidents/[id]/siem">
) {
  const built = await build(ctx)
  if ("error" in built) return built.error
  return Response.json(built.payload, {
    headers: { "cache-control": "no-store" },
  })
}

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/incidents/[id]/siem">
) {
  const built = await build(ctx)
  if ("error" in built) return built.error
  const result = await forwardToSiem(built.payload)
  return Response.json({ ...result, payload: built.payload })
}

async function build(ctx: RouteContext<"/api/incidents/[id]/siem">) {
  await ensureSeeded()
  const { id } = await ctx.params
  const incidents = await listIncidents()
  const incident = incidents.find((i) => i.id === id)
  if (!incident) {
    return {
      error: Response.json({ error: "Incident not found" }, { status: 404 }),
    } as const
  }

  const [department, events, actions] = await Promise.all([
    getDepartment(incident.department_id),
    listIncidentEvents(incident.id),
    listContainmentActions(incident.id),
  ])

  return {
    payload: buildSiemPayload({
      incident,
      department,
      events,
      actions,
      organizationName: ORG_NAME,
    }),
  } as const
}
