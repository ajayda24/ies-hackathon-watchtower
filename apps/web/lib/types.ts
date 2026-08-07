/**
 * Watchtower domain model.
 *
 * Field names match the Postgres schema in `db/schema.sql` exactly (snake_case),
 * so rows can move between the in-memory store and Supabase without a mapping layer.
 */

export type SecurityLevel = "secure" | "warning" | "critical"

export type HoneytokenType =
  | "credential"
  | "document"
  | "api_key"
  | "source_code_secret"

export type HoneytokenStatus = "active" | "triggered" | "revoked"

/**
 * The central distinction of the product.
 *
 * `access` — something merely read or touched the decoy (a backup job scanning
 * files). Logged for forensics, never escalates on its own.
 * `use`    — the decoy's *content* was used: a login with the fake credential,
 * a call with the fake key. No legitimate process does this, so it is treated
 * as a hard attacker signal and drives incident creation.
 */
export type EventType = "access" | "use"

export type Severity = "low" | "medium" | "high" | "critical"

export type IncidentStatus = "open" | "contained" | "closed"

export type ContainmentAction =
  | "CREDENTIAL_REVOKED"
  | "SESSION_ISOLATED"
  | "ALERT_ESCALATED"

export interface Department {
  id: string
  name: string
  registration_token: string
  security_level: SecurityLevel
  created_at: string
}

export interface Honeytoken {
  id: string
  department_id: string
  type: HoneytokenType
  /** Human-facing label shown in the dashboard, e.g. "CAD Server Backup Account". */
  name: string
  /** The decoy payload itself — the fake password, key, or document body. */
  content: string
  /** Where the decoy was planted, e.g. "\\\\fileserver\\mech\\backups". */
  location: string
  /** Unguessable id embedded in the decoy; how a trigger identifies itself. */
  tracking_id: string
  ai_generated: boolean
  status: HoneytokenStatus
  created_at: string
}

export interface Event {
  id: string
  token_id: string
  department_id: string
  event_type: EventType
  source_ip: string
  mitre_id: string
  mitre_name: string
  timestamp: string
  /** Free-form context: user agent, submitted username, endpoint hit, etc. */
  raw_details: Record<string, unknown>
}

export interface Incident {
  id: string
  department_id: string
  source_ip: string
  severity: Severity
  status: IncidentStatus
  created_at: string
  updated_at: string
  /*
   * No attribution fields by design. Earlier drafts carried a profile, a
   * confidence score and a stored narrative; all three were written once at
   * creation and never computed, which is worse than absent — a reader would
   * reasonably assume something scored them. What the evidence supports is a
   * source address and an ordered sequence of actions, so that is all the
   * record holds. The plain-English summary is derived on read.
   */
}

export interface IncidentEvent {
  incident_id: string
  event_id: string
}

export interface ContainmentActionRecord {
  id: string
  incident_id: string
  action: ContainmentAction
  automated: boolean
  timestamp: string
  details: string
}
