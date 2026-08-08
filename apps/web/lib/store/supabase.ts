import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type {
  ContainmentActionRecord,
  Department,
  Event,
  Honeytoken,
  Incident,
  SecurityLevel,
} from "../types"

/**
 * Supabase backend.
 *
 * Mirrors lib/store/memory.ts function for function. Column names in
 * db/schema.sql match the TypeScript field names exactly, so rows map to domain
 * objects without translation — the one exception is `timestamptz`, which comes
 * back as an ISO string already, which is the shape the domain types expect.
 *
 * Uses the service role key and runs only in server routes. That key bypasses
 * RLS, which is why the schema enables RLS with no policies: the browser's anon
 * key can reach nothing, and nothing in this app ever queries from a browser.
 */
let client: SupabaseClient | null | undefined

export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return (client = null)

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

export function supabaseConfigured(): boolean {
  return supabase() !== null
}

/** Throws with the Postgres message attached — a silent failure here would
 *  look like "the decoy vanished", which is the bug this migration fixes. */
function db(): SupabaseClient {
  const c = supabase()
  if (!c) throw new Error("Supabase is not configured")
  return c
}

// ---------------------------------------------------------------- departments

export async function listDepartments(): Promise<Department[]> {
  const { data, error } = await db()
    .from("departments")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getDepartment(id: string): Promise<Department | undefined> {
  const { data, error } = await db()
    .from("departments")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data ?? undefined
}

export async function getDepartmentByToken(
  token: string
): Promise<Department | undefined> {
  const { data, error } = await db()
    .from("departments")
    .select("*")
    .eq("registration_token", token)
    .maybeSingle()
  if (error) throw error
  return data ?? undefined
}

export async function createDepartment(
  name: string,
  registrationToken: string
): Promise<Department> {
  const { data, error } = await db()
    .from("departments")
    .insert({ name, registration_token: registrationToken })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setSecurityLevel(
  id: string,
  level: SecurityLevel
): Promise<void> {
  const { error } = await db()
    .from("departments")
    .update({ security_level: level })
    .eq("id", id)
  if (error) throw error
}

// ---------------------------------------------------------------- honeytokens

export async function listHoneytokens(
  departmentId?: string
): Promise<Honeytoken[]> {
  let q = db().from("honeytokens").select("*").order("created_at")
  if (departmentId) q = q.eq("department_id", departmentId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getHoneytokenByTrackingId(
  trackingId: string
): Promise<Honeytoken | undefined> {
  const { data, error } = await db()
    .from("honeytokens")
    .select("*")
    .eq("tracking_id", trackingId)
    .maybeSingle()
  if (error) throw error
  return data ?? undefined
}

export async function createHoneytoken(
  input: Omit<Honeytoken, "id" | "created_at" | "status"> &
    Partial<Pick<Honeytoken, "status">>
): Promise<Honeytoken> {
  const { data, error } = await db()
    .from("honeytokens")
    .insert({ ...input, status: input.status ?? "active" })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markHoneytokenTriggered(id: string): Promise<void> {
  const { error } = await db()
    .from("honeytokens")
    .update({ status: "triggered" })
    .eq("id", id)
  if (error) throw error
}

// --------------------------------------------------------------------- events

export async function createEvent(
  input: Omit<Event, "id" | "timestamp">
): Promise<Event> {
  const { data, error } = await db()
    .from("events")
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listEvents(limit = 100): Promise<Event[]> {
  const { data, error } = await db()
    .from("events")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function countRecentUseEvents(
  sourceIp: string,
  windowMs: number
): Promise<number> {
  const cutoff = new Date(Date.now() - windowMs).toISOString()
  // head+count: the ladder needs the number, never the rows.
  const { count, error } = await db()
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "use")
    .eq("source_ip", sourceIp)
    .gte("timestamp", cutoff)
  if (error) throw error
  return count ?? 0
}

// ------------------------------------------------------------------ incidents

/** Matches anything not closed — see the memory backend for why. */
export async function findOpenIncident(
  sourceIp: string,
  departmentId: string
): Promise<Incident | undefined> {
  const { data, error } = await db()
    .from("incidents")
    .select("*")
    .neq("status", "closed")
    .eq("source_ip", sourceIp)
    .eq("department_id", departmentId)
    // Several may match once an incident has been contained and reopened by
    // further activity; the newest is the one still being added to.
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ?? undefined
}

export async function createIncident(
  input: Omit<
    Incident,
    "id" | "created_at" | "updated_at" | "containment_latency_ms"
  > & { containment_latency_ms?: number | null }
): Promise<Incident> {
  const { data, error } = await db()
    .from("incidents")
    .insert({ containment_latency_ms: null, ...input })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateIncident(
  id: string,
  patch: Partial<Omit<Incident, "id" | "created_at">>
): Promise<Incident | undefined> {
  const { data, error } = await db()
    .from("incidents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data ?? undefined
}

export async function listIncidents(
  departmentId?: string
): Promise<Incident[]> {
  let q = db()
    .from("incidents")
    .select("*")
    .order("created_at", { ascending: false })
  if (departmentId) q = q.eq("department_id", departmentId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function attachEventToIncident(
  incidentId: string,
  eventId: string
): Promise<void> {
  // The link table's primary key makes this idempotent; ignoring duplicates
  // matches the memory backend, which silently skips an existing pair.
  const { error } = await db()
    .from("incident_events")
    .upsert(
      { incident_id: incidentId, event_id: eventId },
      { onConflict: "incident_id,event_id", ignoreDuplicates: true }
    )
  if (error) throw error
}

export async function listIncidentEvents(incidentId: string): Promise<Event[]> {
  const { data, error } = await db()
    .from("incident_events")
    .select("events(*)")
    .eq("incident_id", incidentId)
  if (error) throw error

  const events = (data ?? [])
    .flatMap((row) => (row as unknown as { events: Event | null }).events ?? [])
    .filter(Boolean) as Event[]
  // Chronological: the timeline reads top-down as the attack unfolded.
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

// -------------------------------------------------------- containment actions

export async function createContainmentAction(
  input: Omit<ContainmentActionRecord, "id" | "timestamp">
): Promise<ContainmentActionRecord> {
  const { data, error } = await db()
    .from("containment_actions")
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listContainmentActions(
  incidentId?: string
): Promise<ContainmentActionRecord[]> {
  let q = db().from("containment_actions").select("*").order("timestamp")
  if (incidentId) q = q.eq("incident_id", incidentId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

// ------------------------------------------------------------------- lifecycle

/**
 * Deletes every row. Ordered child-first even though the schema cascades, so
 * the intent is explicit rather than relying on foreign-key side effects.
 */
export async function resetStore(): Promise<void> {
  const c = db()
  // Child-first. The schema cascades, but deleting in dependency order keeps
  // the intent explicit rather than relying on foreign-key side effects.
  // Each entry carries a column guaranteed non-null on every row, because
  // PostgREST refuses an unfiltered delete — incident_events is a composite
  // key with no `id`, so it filters on incident_id instead.
  const tables: Array<[string, string]> = [
    ["containment_actions", "id"],
    ["incident_events", "incident_id"],
    ["incidents", "id"],
    ["events", "id"],
    ["honeytokens", "id"],
    ["departments", "id"],
  ]
  for (const [table, column] of tables) {
    const { error } = await c.from(table).delete().not(column, "is", null)
    if (error) throw error
  }
}
