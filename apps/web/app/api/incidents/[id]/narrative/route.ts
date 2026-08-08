import type { NextRequest } from "next/server"

import { writeNarrative } from "@/lib/ai/generate-decoy"
import { clockTimeUtc } from "@/lib/time"
import { ORG_NAME } from "@/lib/org"
import { ensureSeeded } from "@/lib/seed"
import {
  getDepartment,
  listContainmentActions,
  listHoneytokens,
  listIncidentEvents,
  listIncidents,
} from "@/lib/store"

/**
 * AI attribution narrative — the second of the platform's AI calls.
 *
 * On demand rather than automatic: an incident opens in under a second, and
 * blocking containment on a model round-trip would put the slowest part of the
 * stack in the most time-critical path. The timeline shows its rule-derived
 * summary until an operator asks for this.
 */
export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/incidents/[id]/narrative">
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

  // The prompt carries only facts already in the store. Nothing is inferred
  // here, so the model has no room to invent a technique or a motive.
  const timeline = events
    .map((e) => {
      const token = tokens.get(e.token_id)
      const verb =
        e.event_type === "use"
          ? "submitted the decoy's contents to a login form"
          : "opened the decoy file"
      return `- ${clockTimeUtc(e.timestamp)} UTC — ${e.source_ip} ${verb} ("${token?.name ?? "unknown decoy"}", ${e.mitre_id} ${e.mitre_name})`
    })
    .join("\n")

  const containment =
    actions.length > 0
      ? actions.map((a) => `- ${a.action}: ${a.details}`).join("\n")
      : "- None: severity stayed below the containment threshold."

  const prompt = `Organisation: ${ORG_NAME}
Department affected: ${department?.name ?? "unknown"}
Source address: ${incident.source_ip}
Severity: ${incident.severity}
Status: ${incident.status}

What happened, in order:
${timeline}

Automated response taken:
${containment}

Background you may rely on: every item above is a decoy planted by us. None of them grant access to any real system, so nothing was actually reached. An "opened" event is weak evidence on its own — a backup job produces those. A "submitted" event is strong evidence, because no legitimate process submits a decoy credential.

Write the summary.`

  const result = await writeNarrative(prompt)
  if (!result) {
    return Response.json(
      { error: "No AI provider configured", configured: false },
      { status: 503 }
    )
  }

  return Response.json(result, { headers: { "cache-control": "no-store" } })
}
