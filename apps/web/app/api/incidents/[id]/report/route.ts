import type { NextRequest } from "next/server"

import { writeReport } from "@/lib/ai/generate-decoy"
import { ORG_NAME } from "@/lib/org"
import { ensureSeeded } from "@/lib/seed"
import { clockTimeUtc } from "@/lib/time"
import {
  getDepartment,
  listContainmentActions,
  listHoneytokens,
  listIncidentEvents,
  listIncidents,
} from "@/lib/store"

/**
 * Incident report — the third AI call.
 *
 * Returns Markdown for the document view. Like the narrative, the prompt
 * carries only facts already in the store; the model's job is structure and
 * plain language, never inference about who the attacker was.
 */
export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/incidents/[id]/report">
) {
  await ensureSeeded()
  const { id } = await ctx.params

  const incidents = await listIncidents()
  const incident = incidents.find((i) => i.id === id)
  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 })
  }

  const [department, events, actions, allTokens] = await Promise.all([
    getDepartment(incident.department_id),
    listIncidentEvents(incident.id),
    listContainmentActions(incident.id),
    listHoneytokens(),
  ])
  const tokens = new Map(allTokens.map((t) => [t.id, t]))

  const timeline = events
    .map((e) => {
      const token = tokens.get(e.token_id)
      const verb =
        e.event_type === "use"
          ? "submitted the decoy's contents to a login form (strong signal)"
          : "opened the decoy file (weak signal on its own)"
      return `- ${clockTimeUtc(e.timestamp)} UTC — ${e.source_ip} ${verb}. Decoy: "${token?.name ?? "unknown"}" at ${token?.location ?? "unknown path"}. Technique: ${e.mitre_id} ${e.mitre_name}.`
    })
    .join("\n")

  const containment =
    actions.length > 0
      ? actions
          .map((a) => `- ${clockTimeUtc(a.timestamp)} UTC — ${a.action}: ${a.details}`)
          .join("\n")
      : "- No automated containment fired: severity stayed below the threshold."

  const span = incidentSpan(events)

  const prompt = `Organisation: ${ORG_NAME}
Department affected: ${department?.name ?? "unknown"}
Incident reference: ${incident.id}
Opened: ${clockTimeUtc(incident.created_at)} UTC
Severity: ${incident.severity}
Status: ${incident.status}
Source address observed: ${incident.source_ip}
Duration of observed activity: ${span}

Events, in order:
${timeline}

Automated response:
${containment}

Facts you may rely on:
- Every item listed is a decoy planted by this platform. None grants access to any real system or record, so nothing real was reached.
- Opening a decoy file is weak evidence — a backup job or search indexer produces the same event. Submitting a decoy's contents to a login form is strong evidence, because no legitimate process does that.
- Containment here means the decoy credential was revoked and an alert raised. The platform deliberately does not block network addresses, because this organisation's systems share outbound addresses and a wrong block would take real services offline.
- The evidence identifies a source address and a sequence of actions. It does not identify a person, an organisation, or a country.
- This detection does not depend on the account being stolen or the intruder being external. Someone inside the organisation, holding entirely valid credentials, still has no legitimate reason to use a decoy — so the signal is the same whether the source is an outsider, a compromised host, or an insider. Do not assert which of those it was; the evidence cannot distinguish them.

Write the report.`

  const result = await writeReport(prompt)
  if (!result) {
    return Response.json(
      { error: "No AI provider configured", configured: false },
      { status: 503 }
    )
  }

  return Response.json(
    {
      ...result,
      incident_id: incident.id,
      department: department?.name ?? null,
      severity: incident.severity,
      status: incident.status,
      generated_at: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } }
  )
}

/** Human-readable span between first and last correlated event. */
function incidentSpan(events: Array<{ timestamp: string }>): string {
  if (events.length < 2) return "single event"
  const times = events.map((e) => new Date(e.timestamp).getTime()).sort()
  const seconds = Math.round((times[times.length - 1]! - times[0]!) / 1000)
  if (seconds < 60) return `${seconds} seconds`
  return `${Math.round(seconds / 60)} minutes`
}
