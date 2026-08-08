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
  /** Trigger-to-containment milliseconds; null when nothing was contained. */
  latencyMs: number | null
}

/**
 * Single entry point for every honeytoken trigger.
 *
 * `access` events are recorded and stop there. Only `use` events — where decoy
 * content was actually submitted somewhere — run correlation, escalate
 * severity, and can fire containment.
 */
export async function recordTrigger(params: {
  token: Honeytoken
  eventType: EventType
  sourceIp: string
  details?: Record<string, unknown>
}): Promise<TriggerResult> {
  const { token, eventType, sourceIp, details = {} } = params
  const technique = classify(token.type, eventType)

  // Start of the detection clock. Taken before the event is written so the
  // measurement covers the platform's own work — classification, correlation,
  // containment — and not just the final call.
  //
  // This includes storage round-trips, which is the honest thing to measure:
  // against Postgres it reports single-digit to low-double-digit milliseconds,
  // against the in-memory store a fraction of one. Both are the real
  // trigger-to-containment time for that configuration.
  //
  // performance.now(), not Date.now(): on the memory path the whole sequence
  // completes inside a millisecond, and a millisecond-resolution clock reports
  // 0, which reads as broken rather than fast.
  const detectionStart = performance.now()

  const event = await createEvent({
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
    await recomputeSecurityLevel(token.department_id)
    return {
      event,
      incident: null,
      contained: false,
      suppressed: isKnownAutomation(sourceIp),
      latencyMs: null,
    }
  }

  // --- 'use': decoy content was actually used. Hard signal. ---
  const recentUseCount = await countRecentUseEvents(sourceIp, USE_WINDOW_MS)
  const severity = severityFor(recentUseCount)

  let incident = await findOpenIncident(sourceIp, token.department_id)
  if (incident) {
    incident = (await updateIncident(incident.id, { severity }))!
  } else {
    incident = await createIncident({
      department_id: token.department_id,
      source_ip: sourceIp,
      severity,
      status: "open",
    })
  }

  await attachEventToIncident(incident.id, event.id)
  await markHoneytokenTriggered(token.id)

  let contained = false
  let latencyMs: number | null = null
  if (severity === "high" || severity === "critical") {
    await triggerContainment(incident, token)
    contained = true
    // Stamped after containment completes, so the number covers the whole
    // path from trigger to response rather than detection alone. Rounded to
    // three decimals — beyond that the digits are timer noise, not signal.
    latencyMs = Math.round((performance.now() - detectionStart) * 1000) / 1000
    incident =
      (await updateIncident(incident.id, {
        status: "contained",
        containment_latency_ms: latencyMs,
      })) ?? incident
  }

  await recomputeSecurityLevel(token.department_id)
  return { event, incident, contained, suppressed: false, latencyMs }
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
export async function triggerContainment(
  incident: Incident,
  token: Honeytoken
): Promise<void> {
  await markHoneytokenTriggered(token.id)

  // Sequential, not Promise.all: the revocation is the containment, and the
  // escalation announces it. If the revocation fails there is nothing to
  // announce, so the second write must not already be in flight.
  await createContainmentAction({
    incident_id: incident.id,
    action: "CREDENTIAL_REVOKED",
    automated: true,
    details: `Revoked honeytoken "${token.name}" (${token.tracking_id}) after ${incident.severity} severity use from ${incident.source_ip}.`,
  })

  await createContainmentAction({
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
export async function recomputeSecurityLevel(
  departmentId: string
): Promise<SecurityLevel> {
  // "Contained" is not "resolved" — the credential was revoked, but an attacker
  // demonstrably used it and nobody has reviewed the blast radius yet. Counting
  // only open incidents would flip a department back to green the instant
  // containment fired, hiding the very incident we just caught. A human closes
  // the incident to clear the badge.
  //
  // Both reads are independent, so they run concurrently — this sits on the
  // trigger path, where every avoidable round-trip is added latency.
  const [incidents, events] = await Promise.all([
    listIncidents(departmentId),
    listEvents(1000),
  ])
  const active = incidents.filter((i) => i.status !== "closed")

  let level: SecurityLevel = "secure"

  if (active.some((i) => i.severity === "high" || i.severity === "critical")) {
    level = "critical"
  } else {
    const cutoff = Date.now() - SECURITY_WINDOW_MS
    const recentTriggers = events.filter(
      (e) =>
        e.department_id === departmentId &&
        new Date(e.timestamp).getTime() >= cutoff
    ).length

    if (active.some((i) => i.severity === "medium") || recentTriggers >= 2) {
      level = "warning"
    }
  }

  await setSecurityLevel(departmentId, level)
  return level
}
