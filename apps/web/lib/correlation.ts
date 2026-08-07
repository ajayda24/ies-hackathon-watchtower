import {
  attachEventToIncident,
  countRecentUseEvents,
  createContainmentAction,
  createEvent,
  findOpenIncident,
  createIncident,
  listEvents,
  listIncidents,
  markHoneytokenTriggered,
  setSecurityLevel,
  updateIncident,
} from "./store"
import { classify } from "./mitre"
import type {
  Event,
  EventType,
  Honeytoken,
  Incident,
  SecurityLevel,
  Severity,
} from "./types"

/** Window used for the severity ladder — repeated use from one IP escalates. */
const USE_WINDOW_MS = 10 * 60 * 1000

/** Window for the "2+ triggers means warning" half of the security level rule. */
const SECURITY_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Sources permitted to `access` decoys without ever being surfaced as alerts —
 * backup jobs, indexers, vulnerability scanners.
 *
 * Manually configured, not learned. Note this only ever suppresses `access`;
 * a `use` event from an allowlisted source still escalates, because no backup
 * job has a reason to submit a password.
 */
const KNOWN_AUTOMATION_SOURCES = new Set<string>(["10.0.0.9"])

export function isKnownAutomation(sourceIp: string): boolean {
  return KNOWN_AUTOMATION_SOURCES.has(sourceIp)
}

export interface TriggerResult {
  event: Event
  incident: Incident | null
  contained: boolean
  /** True when the event was logged but deliberately not escalated. */
  suppressed: boolean
}

/**
 * Single entry point for every honeytoken trigger.
 *
 * `access` events are recorded and stop there. Only `use` events — where decoy
 * content was actually submitted somewhere — run correlation, escalate
 * severity, and can fire containment.
 */
export function recordTrigger(params: {
  token: Honeytoken
  eventType: EventType
  sourceIp: string
  details?: Record<string, unknown>
}): TriggerResult {
  const { token, eventType, sourceIp, details = {} } = params
  const technique = classify(token.type, eventType)

  const event = createEvent({
    token_id: token.id,
    department_id: token.department_id,
    event_type: eventType,
    source_ip: sourceIp,
    mitre_id: technique.id,
    mitre_name: technique.name,
    raw_details: details,
  })

  // An 'access' never escalates on its own. This is the false-positive defence:
  // a backup job reading every file on a share produces these all day and no
  // one gets paged.
  if (eventType === "access") {
    recomputeSecurityLevel(token.department_id)
    return {
      event,
      incident: null,
      contained: false,
      suppressed: isKnownAutomation(sourceIp),
    }
  }

  // --- 'use': decoy content was actually used. Hard signal. ---
  const recentUseCount = countRecentUseEvents(sourceIp, USE_WINDOW_MS)
  const severity = severityFor(recentUseCount)

  let incident = findOpenIncident(sourceIp, token.department_id)
  if (incident) {
    incident = updateIncident(incident.id, { severity })!
  } else {
    incident = createIncident({
      department_id: token.department_id,
      source_ip: sourceIp,
      severity,
      attribution_profile: "Unclassified",
      attribution_confidence: 0,
      attribution_narrative: "",
      status: "open",
    })
  }

  attachEventToIncident(incident.id, event.id)
  markHoneytokenTriggered(token.id)

  let contained = false
  if (severity === "high" || severity === "critical") {
    triggerContainment(incident, token)
    contained = true
    incident = updateIncident(incident.id, { status: "contained" }) ?? incident
  }

  recomputeSecurityLevel(token.department_id)
  return { event, incident, contained, suppressed: false }
}

/** Severity ladder: repeated use from one source inside the window escalates. */
export function severityFor(recentUseCount: number): Severity {
  if (recentUseCount >= 3) return "critical"
  if (recentUseCount === 2) return "high"
  return "medium"
}

/**
 * Containment is deliberately scoped to the triggered decoy.
 *
 * We never block an IP or isolate a device: small orgs sit behind shared NAT,
 * so a wrong block could take a whole clinic offline. Revoking the specific
 * fake credential is safe by construction — no real system depends on it.
 */
export function triggerContainment(incident: Incident, token: Honeytoken): void {
  markHoneytokenTriggered(token.id)

  createContainmentAction({
    incident_id: incident.id,
    action: "CREDENTIAL_REVOKED",
    automated: true,
    details: `Revoked honeytoken "${token.name}" (${token.tracking_id}) after ${incident.severity} severity use from ${incident.source_ip}.`,
  })

  createContainmentAction({
    incident_id: incident.id,
    action: "ALERT_ESCALATED",
    automated: true,
    details: `Incident ${incident.id} escalated to ${incident.severity}. Scoped containment applied; no network-level block issued.`,
  })
}

/**
 * Recomputes a department's badge from its current incidents and recent
 * triggers. Called after every event so the org map reflects live state.
 */
export function recomputeSecurityLevel(departmentId: string): SecurityLevel {
  // "Contained" is not "resolved" — the credential was revoked, but an attacker
  // demonstrably used it and nobody has reviewed the blast radius yet. Counting
  // only open incidents would flip a department back to green the instant
  // containment fired, hiding the very incident we just caught. A human closes
  // the incident to clear the badge.
  const active = listIncidents(departmentId).filter((i) => i.status !== "closed")

  let level: SecurityLevel = "secure"

  if (active.some((i) => i.severity === "high" || i.severity === "critical")) {
    level = "critical"
  } else {
    const cutoff = Date.now() - SECURITY_WINDOW_MS
    const recentTriggers = listEvents(1000).filter(
      (e) =>
        e.department_id === departmentId &&
        new Date(e.timestamp).getTime() >= cutoff
    ).length

    if (active.some((i) => i.severity === "medium") || recentTriggers >= 2) {
      level = "warning"
    }
  }

  setSecurityLevel(departmentId, level)
  return level
}
