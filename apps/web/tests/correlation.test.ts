import assert from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"

import { recordTrigger, severityFor } from "../lib/correlation.ts"
import { resetStore } from "../lib/store/memory.ts"
import {
  createDepartment,
  createHoneytoken,
  listContainmentActions,
  listEvents,
  listIncidents,
} from "../lib/store/index.ts"
import type { Honeytoken } from "../lib/types.ts"

/**
 * Integration tests for the detection path: recordTrigger() through the
 * severity ladder to incident creation and containment.
 *
 * This path is worth testing above everything else because every decoy type
 * funnels through it — a bug here does not break one feature, it breaks
 * detection for all four at once, silently, in the direction of not alerting.
 *
 * These run against the in-memory backend. That is the point rather than a
 * compromise: the correlation logic is storage-agnostic by construction, so
 * testing it without a database keeps the suite fast and hermetic, and the
 * Supabase backend is exercised separately by the running application.
 */

let seq = 0

/** A planted decoy belonging to a fresh department. */
async function plantDecoy(
  overrides: Partial<Pick<Honeytoken, "type" | "content">> = {}
): Promise<Honeytoken> {
  seq += 1
  const dept = await createDepartment(`Dept ${seq}`, `dept-${seq}`)
  return createHoneytoken({
    department_id: dept.id,
    type: overrides.type ?? "credential",
    name: "Test Decoy",
    content: overrides.content ?? "svc_test / Pa55phrase!",
    location: "\\\\fileserver\\test\\decoy.txt",
    tracking_id: `wt_test_${seq}`,
    ai_generated: false,
  })
}

describe("severity ladder", () => {
  it("maps use counts to severities", () => {
    assert.equal(severityFor(1), "medium")
    assert.equal(severityFor(2), "high")
    assert.equal(severityFor(3), "critical")
    assert.equal(severityFor(9), "critical")
  })

  it("treats zero as medium rather than throwing", () => {
    // Defensive: the ladder is called with a freshly counted value, and a
    // count of zero would mean the event that triggered it was not yet
    // visible. Failing closed (an incident) beats failing open (silence).
    assert.equal(severityFor(0), "medium")
  })
})

describe("access events", () => {
  beforeEach(() => resetStore())

  it("logs the event but opens no incident", async () => {
    const token = await plantDecoy()

    const result = await recordTrigger({
      token,
      eventType: "access",
      sourceIp: "203.0.113.10",
    })

    assert.equal(result.incident, null, "access must not open an incident")
    assert.equal(result.contained, false)
    assert.equal(result.latencyMs, null)
    assert.equal((await listIncidents()).length, 0)
    assert.equal((await listEvents()).length, 1, "the event is still recorded")
  })

  it("never escalates however many times it repeats", async () => {
    const token = await plantDecoy()

    // A backup job reading a share all night is exactly this shape. If this
    // ever opens an incident, the false-positive defence is gone.
    for (let i = 0; i < 10; i++) {
      await recordTrigger({
        token,
        eventType: "access",
        sourceIp: "203.0.113.11",
      })
    }

    assert.equal((await listIncidents()).length, 0)
    assert.equal((await listEvents()).length, 10)
  })
})

describe("use events", () => {
  beforeEach(() => resetStore())

  it("opens a medium incident on first use, without containment", async () => {
    const token = await plantDecoy()

    const result = await recordTrigger({
      token,
      eventType: "use",
      sourceIp: "203.0.113.20",
    })

    assert.ok(result.incident, "use must open an incident")
    assert.equal(result.incident.severity, "medium")
    assert.equal(result.incident.status, "open")
    assert.equal(result.contained, false, "medium is below the threshold")
    assert.equal(result.incident.containment_latency_ms, null)
    assert.equal((await listContainmentActions()).length, 0)
  })

  it("escalates to high on the second use and fires containment", async () => {
    const token = await plantDecoy()

    await recordTrigger({ token, eventType: "use", sourceIp: "203.0.113.21" })
    const second = await recordTrigger({
      token,
      eventType: "use",
      sourceIp: "203.0.113.21",
    })

    assert.equal(second.incident?.severity, "high")
    assert.equal(second.incident?.status, "contained")
    assert.equal(second.contained, true)

    // Both containment actions fire, and the latency is measured rather than
    // left null.
    const actions = await listContainmentActions(second.incident!.id)
    assert.deepEqual(
      actions.map((a) => a.action).sort(),
      ["ALERT_ESCALATED", "CREDENTIAL_REVOKED"]
    )
    assert.equal(typeof second.latencyMs, "number")
    assert.ok(second.latencyMs! >= 0)
  })

  it("reaches critical on the third use", async () => {
    const token = await plantDecoy()

    for (let i = 0; i < 2; i++) {
      await recordTrigger({ token, eventType: "use", sourceIp: "203.0.113.22" })
    }
    const third = await recordTrigger({
      token,
      eventType: "use",
      sourceIp: "203.0.113.22",
    })

    assert.equal(third.incident?.severity, "critical")
    assert.equal(third.contained, true)
  })

  it("groups repeat activity into one incident, not many", async () => {
    const token = await plantDecoy()

    for (let i = 0; i < 4; i++) {
      await recordTrigger({ token, eventType: "use", sourceIp: "203.0.113.23" })
    }

    assert.equal(
      (await listIncidents()).length,
      1,
      "one source against one department is one incident"
    )
  })

  it("keeps different sources in separate incidents", async () => {
    const token = await plantDecoy()

    await recordTrigger({ token, eventType: "use", sourceIp: "203.0.113.30" })
    await recordTrigger({ token, eventType: "use", sourceIp: "203.0.113.31" })

    const incidents = await listIncidents()
    assert.equal(incidents.length, 2)
    // Neither reached the threshold, because the ladder counts per source.
    assert.deepEqual(
      incidents.map((i) => i.severity),
      ["medium", "medium"]
    )
  })

  it("counts uses per source, so one attacker cannot hide behind another", async () => {
    const token = await plantDecoy()

    await recordTrigger({ token, eventType: "use", sourceIp: "198.51.100.1" })
    await recordTrigger({ token, eventType: "use", sourceIp: "198.51.100.1" })
    // A third use from a different address must not push the first to critical.
    const other = await recordTrigger({
      token,
      eventType: "use",
      sourceIp: "198.51.100.2",
    })

    assert.equal(other.incident?.severity, "medium")
  })
})

describe("mixed access and use", () => {
  beforeEach(() => resetStore())

  it("ignores access when computing severity", async () => {
    const token = await plantDecoy()

    // Six reads then one use is still a first use: only submissions count.
    for (let i = 0; i < 6; i++) {
      await recordTrigger({ token, eventType: "access", sourceIp: "203.0.113.40" })
    }
    const use = await recordTrigger({
      token,
      eventType: "use",
      sourceIp: "203.0.113.40",
    })

    assert.equal(use.incident?.severity, "medium")
    assert.equal(use.contained, false)
    assert.equal((await listEvents()).length, 7)
  })
})

describe("MITRE mapping", () => {
  beforeEach(() => resetStore())

  it("tags credential use as T1078 Valid Accounts", async () => {
    const token = await plantDecoy({ type: "credential" })
    const r = await recordTrigger({
      token,
      eventType: "use",
      sourceIp: "203.0.113.50",
    })
    assert.equal(r.event.mitre_id, "T1078")
  })

  it("tags document access as T1552 Unsecured Credentials", async () => {
    const token = await plantDecoy({ type: "document" })
    const r = await recordTrigger({
      token,
      eventType: "access",
      sourceIp: "203.0.113.51",
    })
    assert.equal(r.event.mitre_id, "T1552")
  })

  it("tags source-code secret access as T1213", async () => {
    const token = await plantDecoy({ type: "source_code_secret" })
    const r = await recordTrigger({
      token,
      eventType: "access",
      sourceIp: "203.0.113.52",
    })
    assert.equal(r.event.mitre_id, "T1213")
  })
})

describe("decoy lifecycle", () => {
  beforeEach(() => resetStore())

  it("marks a decoy triggered once its contents are used", async () => {
    const token = await plantDecoy()
    await recordTrigger({ token, eventType: "use", sourceIp: "203.0.113.60" })

    const { listHoneytokens } = await import("../lib/store/index.ts")
    const stored = (await listHoneytokens()).find((t) => t.id === token.id)
    assert.equal(stored?.status, "triggered")
  })

  it("never stores a submitted password", async () => {
    const token = await plantDecoy()
    await recordTrigger({
      token,
      eventType: "use",
      sourceIp: "203.0.113.61",
      details: {
        submitted_username: "svc_test",
        submitted_password_length: 12,
      },
    })

    const raw = JSON.stringify((await listEvents())[0]!.raw_details)
    assert.ok(!raw.includes("Pa55phrase"), "the secret must never be persisted")
    assert.ok(raw.includes("submitted_password_length"))
  })
})
