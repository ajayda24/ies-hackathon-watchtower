"use client"

import { useState } from "react"

import { Perimeter } from "@/components/perimeter"
import { Blueprint, Kicker, LiveDot, TopNav } from "@/components/wt"
import { useClock } from "@/components/use-clock"
import { ZoneCard } from "@/components/zone-card"
import { ORG_NAME } from "@/lib/org"
import { useOverview } from "@/lib/useOverview"

/**
 * Screen 01 — Organization Map. The primary screen and the demo centrepiece:
 * departments as blocks, colour-coded live, so an incident is visible from the
 * back of the room the moment it fires.
 */
export default function MapPage() {
  const { data, error } = useOverview()
  const clock = useClock()

  const departments = data?.departments ?? []
  const events = data?.events ?? []
  const incidents = data?.incidents ?? []

  const activeIncidents = incidents.filter((i) => i.status !== "closed")
  const criticalCount = activeIncidents.filter(
    (i) => i.severity === "critical" || i.severity === "high"
  ).length

  const totalDecoys = departments.reduce((sum, d) => sum + d.honeytoken_count, 0)
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const recent = events.filter((e) => new Date(e.timestamp).getTime() >= dayAgo)
  const touched = recent.filter((e) => e.event_type === "access").length
  const used = recent.filter((e) => e.event_type === "use").length
  const autoContained = incidents.filter((i) => i.status === "contained").length

  const latest = activeIncidents[0]
  const latestDept = departments.find((d) => d.id === latest?.department_id)

  return (
    <div className="wt wt-board">
      <Blueprint className="wt-shell">
        <TopNav
          active="map"
          orgName={ORG_NAME}
          right={
            <>
              {criticalCount > 0 && (
                <span
                  className="wt-mono"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 11,
                    letterSpacing: ".08em",
                    color: "var(--crit-text)",
                    border: "1px solid rgba(232,70,78,.5)",
                    background: "rgba(232,70,78,.1)",
                    padding: "5px 10px",
                  }}
                >
                  <LiveDot color="var(--crit)" size={6} />
                  {criticalCount} CRITICAL INCIDENT
                  {criticalCount > 1 ? "S" : ""}
                </span>
              )}
              <span
                className="wt-mono"
                style={{ fontSize: 11, color: "var(--color-faint)" }}
              >
                {data ? `${clock.time(data.generated_at)} ${clock.zone}` : "CONNECTING…"}
              </span>
            </>
          }
        />

        <div className="wt-split">
          <div style={{ padding: "24px 24px 28px", minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                marginBottom: 18,
                flexWrap: "wrap",
              }}
            >
              <h4 style={{ margin: 0, fontSize: 19 }}>Zone status</h4>
              <span
                className="wt-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: ".12em",
                  color: "var(--color-faint)",
                }}
              >
                {departments.length} DEPARTMENTS · {totalDecoys} DECOYS PLANTED
              </span>
              <span
                className="wt-mono"
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                  letterSpacing: ".1em",
                  color: error ? "var(--warn)" : "var(--ok)",
                }}
              >
                <LiveDot color={error ? "var(--warn)" : "var(--ok)"} />
                {error ? "RECONNECTING" : "LIVE"}
              </span>
            </div>

            <div className="wt-zones">
              {departments.map((dept, i) => (
                <ZoneCard key={dept.id} dept={dept} index={i} events={events} />
              ))}

              {data && (
                <a
                  href="/register"
                  className="wt-blueprint"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 16,
                    minHeight: 150,
                    borderStyle: "dashed",
                    borderColor: "#2a333c",
                    color: "var(--color-faint)",
                  }}
                >
                  <span style={{ fontSize: 26, fontWeight: 300, lineHeight: 1 }}>
                    +
                  </span>
                  <span
                    className="wt-mono"
                    style={{ fontSize: 10, letterSpacing: ".1em" }}
                  >
                    ADD DEPARTMENT
                  </span>
                </a>
              )}

              {!data && (
                <div
                  className="wt-mono"
                  style={{ color: "var(--color-faint)", fontSize: 12 }}
                >
                  LOADING ZONES…
                </div>
              )}
            </div>
          </div>

          <div className="wt-rail">
            <Kicker style={{ marginBottom: 14 }}>PERIMETER</Kicker>
            <Perimeter departments={departments} />

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Stat label="Decoys planted" value={totalDecoys} />
              <Stat
                label="Touched (24h)"
                value={touched}
                color={touched > 0 ? "var(--warn)" : undefined}
              />
              <Stat
                label="Used (24h)"
                value={used}
                color={used > 0 ? "var(--crit)" : undefined}
              />
              <Stat
                label="Auto-contained"
                value={autoContained}
                color={autoContained > 0 ? "var(--ok)" : undefined}
              />
            </div>

            {latest && (
              <Blueprint
                cornerColor="rgba(232,70,78,.8)"
                style={{
                  marginTop: 22,
                  padding: 13,
                  borderColor: "rgba(232,70,78,.5)",
                  background: "rgba(232,70,78,.07)",
                }}
              >
                <div
                  className="wt-mono wt-kicker"
                  style={{
                    color: "var(--crit)",
                    marginBottom: 6,
                  }}
                >
                  {latest.status === "contained" ? "CONTAINED" : "ACTIVE"} ·{" "}
                  {latest.severity.toUpperCase()}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 10 }}>
                  Decoy credential from {latestDept?.name ?? "a department"} used
                  from{" "}
                  <span className="wt-mono" style={{ color: "var(--crit-text)" }}>
                    {latest.source_ip}
                  </span>
                  .
                </div>
                <a
                  href={`/incidents/${latest.id}`}
                  className="wt-btn wt-btn-crit"
                  style={{ width: "100%" }}
                >
                  Open incident
                </a>
              </Blueprint>
            )}

            <DemoReset />
          </div>
        </div>
      </Blueprint>
    </div>
  )
}

/**
 * Demo reset control.
 *
 * Two-step by design. This wipes every incident on the board, and the one
 * moment it would be catastrophic to fire accidentally is the moment it is
 * most likely to be clicked — mid-demo, reaching for something else. The first
 * click only arms it; the second performs the reset, and the armed state
 * expires on its own so it cannot sit primed indefinitely.
 */
function DemoReset() {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      await fetch("/api/demo/reset", { method: "POST" })
      // Full reload rather than waiting for the 2s poll: after a reset the
      // operator wants the clean board immediately, not on the next tick.
      window.location.reload()
    } catch {
      setBusy(false)
      setArmed(false)
    }
  }

  return (
    <div style={{ marginTop: 22 }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (!armed) {
            setArmed(true)
            window.setTimeout(() => setArmed(false), 4000)
            return
          }
          void run()
        }}
        className={`wt-btn ${armed ? "wt-btn-crit" : "wt-btn-secondary"}`}
        style={{ width: "100%" }}
      >
        {busy
          ? "Resetting…"
          : armed
            ? "Confirm — wipe all incidents"
            : "Reset demo board"}
      </button>
      <div
        className="wt-mono"
        style={{
          marginTop: 6,
          fontSize: 10,
          letterSpacing: ".06em",
          color: "var(--color-faint)",
          lineHeight: 1.5,
        }}
      >
        {armed
          ? "CLICK AGAIN TO CONFIRM"
          : "CLEARS EVENTS AND INCIDENTS · RESTORES SEED DECOYS"}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        color: "var(--color-dim)",
      }}
    >
      <span>{label}</span>
      <span className="wt-mono" style={{ color: color ?? "var(--color-text)" }}>
        {value}
      </span>
    </div>
  )
}
