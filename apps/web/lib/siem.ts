import type {
  ContainmentActionRecord,
  Department,
  Event,
  Incident,
} from "./types"

/**
 * SIEM/SOAR forwarding — Tier 3, architected but not validated.
 *
 * This builds a CEF-flavoured JSON envelope and POSTs it to SIEM_WEBHOOK_URL
 * when one is configured. It has NOT been validated against a real Splunk,
 * Sentinel, or Elastic ingestion pipeline — the field names follow the ECS
 * naming convention but no mapping has been confirmed with a live indexer.
 * Say so out loud rather than implying an integration exists.
 */
export interface SiemPayload {
  "@timestamp": string
  event: {
    kind: "alert"
    category: "intrusion_detection"
    severity: number
    action: string
    reason: string
  }
  source: { ip: string }
  organization: { name: string; department: string }
  threat: {
    framework: "MITRE ATT&CK"
    technique: Array<{ id: string; name: string }>
  }
  watchtower: {
    incident_id: string
    status: string
    correlated_events: number
    containment: string[]
    tier: "unvalidated-stub"
  }
}

/** Maps our severity words onto the 0-100 numeric scale SIEMs expect. */
const SEVERITY_SCORE: Record<Incident["severity"], number> = {
  low: 21,
  medium: 47,
  high: 73,
  critical: 99,
}

export function buildSiemPayload(params: {
  incident: Incident
  department: Department | undefined
  events: Event[]
  actions: ContainmentActionRecord[]
  organizationName: string
}): SiemPayload {
  const { incident, department, events, actions, organizationName } = params

  const techniques = Array.from(
    new Map(events.map((e) => [e.mitre_id, { id: e.mitre_id, name: e.mitre_name }])).values()
  )

  return {
    "@timestamp": incident.created_at,
    event: {
      kind: "alert",
      category: "intrusion_detection",
      severity: SEVERITY_SCORE[incident.severity],
      action: incident.status === "contained" ? "contained" : "detected",
      reason: "Decoy credential used — no legitimate process uses a honeytoken",
    },
    source: { ip: incident.source_ip },
    organization: {
      name: organizationName,
      department: department?.name ?? "unknown",
    },
    threat: { framework: "MITRE ATT&CK", technique: techniques },
    watchtower: {
      incident_id: incident.id,
      status: incident.status,
      correlated_events: events.length,
      containment: actions.map((a) => a.action),
      tier: "unvalidated-stub",
    },
  }
}

export interface ForwardResult {
  forwarded: boolean
  status?: number
  reason?: string
}

/**
 * Posts the payload when SIEM_WEBHOOK_URL is set. Never throws — a downstream
 * SIEM being unreachable must not affect detection or containment, which have
 * already happened by the time this runs.
 */
export async function forwardToSiem(
  payload: SiemPayload
): Promise<ForwardResult> {
  const url = process.env.SIEM_WEBHOOK_URL
  if (!url) {
    return { forwarded: false, reason: "SIEM_WEBHOOK_URL not configured" }
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    })
    return { forwarded: res.ok, status: res.status }
  } catch (err) {
    return {
      forwarded: false,
      reason: err instanceof Error ? err.message : "request failed",
    }
  }
}
