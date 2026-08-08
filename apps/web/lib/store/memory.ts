import { randomUUID } from "node:crypto"

import type {
  ContainmentActionRecord,
  Department,
  Event,
  Honeytoken,
  Incident,
  IncidentEvent,
  SecurityLevel,
} from "../types"

/**
 * In-memory store for the demo.
 *
 * Everything the correlation engine and the API routes need goes through this
 * module, so swapping in Supabase means reimplementing this file's exported
 * functions against the client — no route handler changes.
 *
 * Next dev-mode hot reload re-evaluates modules, which would wipe state and
 * silently reset a demo mid-run. Stashing the tables on `globalThis` keeps them
 * alive across reloads.
 */
// No `seeded` flag: ensureSeeded() asks whether any departments exist, because
// a per-process flag is meaningless once the rows live in a shared database.
interface Tables {
  departments: Department[]
  honeytokens: Honeytoken[]
  events: Event[]
  incidents: Incident[]
  incident_events: IncidentEvent[]
  containment_actions: ContainmentActionRecord[]
}

const globalStore = globalThis as unknown as { __watchtower?: Tables }

export function db(): Tables {
  globalStore.__watchtower ??= {
    departments: [],
    honeytokens: [],
    events: [],
    incidents: [],
    incident_events: [],
    containment_actions: [],
  }
  return globalStore.__watchtower
}

/**
 * Empties every table.
 *
 * Mutates the existing object rather than reassigning `globalStore.__watchtower`:
 * a fresh object would strand any module holding a reference to the old one,
 * and the resulting split-brain store is exactly the kind of failure that
 * surfaces mid-demo.
 *
 * The caller re-seeds — with the tables empty, `ensureSeeded()` sees no
 * departments and refills the fixtures on the next call.
 */
export function resetStore(): void {
  const store = db()
  store.departments.length = 0
  store.honeytokens.length = 0
  store.events.length = 0
  store.incidents.length = 0
  store.incident_events.length = 0
  store.containment_actions.length = 0
}

export const newId = () => randomUUID()
export const now = () => new Date().toISOString()

/** Short, unguessable id embedded in a decoy so a trigger can identify itself. */
export function newTrackingId(): string {
  return `wt_${randomUUID().replace(/-/g, "").slice(0, 16)}`
}

// ---------------------------------------------------------------- departments

export function listDepartments(): Department[] {
  return db().departments
}

export function getDepartment(id: string): Department | undefined {
  return db().departments.find((d) => d.id === id)
}

export function getDepartmentByToken(token: string): Department | undefined {
  return db().departments.find((d) => d.registration_token === token)
}

export function createDepartment(
  name: string,
  registrationToken: string
): Department {
  const dept: Department = {
    id: newId(),
    name,
    registration_token: registrationToken,
    security_level: "secure",
    created_at: now(),
  }
  db().departments.push(dept)
  return dept
}

export function setSecurityLevel(id: string, level: SecurityLevel): void {
  const dept = getDepartment(id)
  if (dept) dept.security_level = level
}

// ---------------------------------------------------------------- honeytokens

export function listHoneytokens(departmentId?: string): Honeytoken[] {
  const tokens = db().honeytokens
  return departmentId
    ? tokens.filter((t) => t.department_id === departmentId)
    : tokens
}

export function getHoneytokenByTrackingId(
  trackingId: string
): Honeytoken | undefined {
  return db().honeytokens.find((t) => t.tracking_id === trackingId)
}

export function createHoneytoken(
  input: Omit<Honeytoken, "id" | "created_at" | "status"> &
    Partial<Pick<Honeytoken, "status">>
): Honeytoken {
  const token: Honeytoken = {
    ...input,
    id: newId(),
    status: input.status ?? "active",
    created_at: now(),
  }
  db().honeytokens.push(token)
  return token
}

export function markHoneytokenTriggered(id: string): void {
  const token = db().honeytokens.find((t) => t.id === id)
  if (token) token.status = "triggered"
}

// --------------------------------------------------------------------- events

export function createEvent(input: Omit<Event, "id" | "timestamp">): Event {
  const event: Event = { ...input, id: newId(), timestamp: now() }
  db().events.push(event)
  return event
}

export function listEvents(limit = 100): Event[] {
  return [...db().events]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)
}

/**
 * Counts `use` events from one IP inside a time window — the input to the
 * severity ladder in the correlation engine.
 */
export function countRecentUseEvents(sourceIp: string, windowMs: number): number {
  const cutoff = Date.now() - windowMs
  return db().events.filter(
    (e) =>
      e.event_type === "use" &&
      e.source_ip === sourceIp &&
      new Date(e.timestamp).getTime() >= cutoff
  ).length
}

// ------------------------------------------------------------------ incidents

export function findOpenIncident(
  sourceIp: string,
  departmentId: string
): Incident | undefined {
  return db().incidents.find(
    (i) =>
      i.status === "open" &&
      i.source_ip === sourceIp &&
      i.department_id === departmentId
  )
}

export function createIncident(
  input: Omit<
    Incident,
    "id" | "created_at" | "updated_at" | "containment_latency_ms"
  > & { containment_latency_ms?: number | null }
): Incident {
  const incident: Incident = {
    // An incident always opens uncontained, so latency starts null and is
    // stamped by recordTrigger() only if containment actually fires.
    containment_latency_ms: null,
    ...input,
    id: newId(),
    created_at: now(),
    updated_at: now(),
  }
  db().incidents.push(incident)
  return incident
}

export function updateIncident(
  id: string,
  patch: Partial<Omit<Incident, "id" | "created_at">>
): Incident | undefined {
  const incident = db().incidents.find((i) => i.id === id)
  if (!incident) return undefined
  Object.assign(incident, patch, { updated_at: now() })
  return incident
}

export function listIncidents(departmentId?: string): Incident[] {
  const incidents = departmentId
    ? db().incidents.filter((i) => i.department_id === departmentId)
    : db().incidents
  return [...incidents].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function attachEventToIncident(incidentId: string, eventId: string): void {
  const links = db().incident_events
  if (links.some((l) => l.incident_id === incidentId && l.event_id === eventId)) {
    return
  }
  links.push({ incident_id: incidentId, event_id: eventId })
}

export function listIncidentEvents(incidentId: string): Event[] {
  const ids = new Set(
    db()
      .incident_events.filter((l) => l.incident_id === incidentId)
      .map((l) => l.event_id)
  )
  return db()
    .events.filter((e) => ids.has(e.id))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

// -------------------------------------------------------- containment actions

export function createContainmentAction(
  input: Omit<ContainmentActionRecord, "id" | "timestamp">
): ContainmentActionRecord {
  const action: ContainmentActionRecord = {
    ...input,
    id: newId(),
    timestamp: now(),
  }
  db().containment_actions.push(action)
  return action
}

export function listContainmentActions(
  incidentId?: string
): ContainmentActionRecord[] {
  const actions = db().containment_actions
  return incidentId
    ? actions.filter((a) => a.incident_id === incidentId)
    : actions
}
