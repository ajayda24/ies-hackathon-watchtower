"use client"

import { useMemo, useRef, useState } from "react"

import { Blueprint, LiveDot, Tag, TopNav, clockTimeMs } from "@/components/wt"
import { ORG_NAME } from "@/lib/org"
import { useOverview } from "@/lib/useOverview"
import type { Event, Honeytoken } from "@/lib/types"

/**
 * Screen 04 — Telemetry Dashboard.
 *
 * The visual argument for the whole product: `use` rows are loud (red rule,
 * filled badge, pulsing dot), `access` rows are deliberately quiet (hairline
 * outline, no colour). A judge should see the difference before reading it.
 */
export default function TelemetryPage() {
  const { data, error } = useOverview()
  const [filter, setFilter] = useState<"all" | "access" | "use">("all")

  const events = data?.events ?? []
  const departments = data?.departments ?? []
  const honeytokens = data?.honeytokens ?? []

  const tokensById = useMemo(() => {
    const map = new Map<string, Honeytoken>()
    for (const token of honeytokens) map.set(token.id, token)
    return map
  }, [honeytokens])

  const deptNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const dept of departments) map.set(dept.id, dept.name)
    return map
  }, [departments])

  const accessCount = events.filter((e) => e.event_type === "access").length
  const useCount = events.filter((e) => e.event_type === "use").length

  const shown = filter === "all" ? events : events.filter((e) => e.event_type === filter)

  // Rows animate in only when they are genuinely new, not on every 2s poll —
  // otherwise the whole table would flash on each tick.
  const seen = useRef(new Set<string>())
  const isNew = (id: string) => {
    if (seen.current.has(id)) return false
    seen.current.add(id)
    return true
  }

  return (
    <div className="wt" style={{ padding: "40px 44px 80px" }}>
      <Blueprint
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          background: "var(--color-bg)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <TopNav
          active="telemetry"
          orgName={ORG_NAME}
          right={
            <span
              className="wt-mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 10,
                letterSpacing: ".1em",
                color: error ? "var(--warn)" : "var(--ok)",
              }}
            >
              <LiveDot color={error ? "var(--warn)" : "var(--ok)"} />
              {error ? "RECONNECTING" : `STREAMING · ${events.length} EVENTS`}
            </span>
          }
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 22px",
            borderBottom: "1px solid var(--color-hairline)",
            flexWrap: "wrap",
          }}
        >
          <span
            className="wt-kicker"
            style={{ marginRight: 6 }}
          >
            FILTER
          </span>
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="ALL EVENTS"
          />
          <FilterChip
            active={filter === "access"}
            onClick={() => setFilter("access")}
            label={`ACCESS ${accessCount}`}
          />
          <FilterChip
            active={filter === "use"}
            onClick={() => setFilter("use")}
            label={`USE ${useCount}`}
            tone="crit"
          />
          <span
            className="wt-mono"
            style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-faint)" }}
          >
            NEWEST FIRST · AUTO-REFRESH ON
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="wt-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 132 }}>Timestamp</th>
                <th style={{ width: 160 }}>Department</th>
                <th style={{ width: 190 }}>Event</th>
                <th>Decoy</th>
                <th style={{ width: 150 }}>Source</th>
                <th style={{ width: 210 }}>MITRE</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  token={tokensById.get(event.token_id)}
                  deptName={deptNames.get(event.department_id) ?? "—"}
                  fresh={isNew(event.id)}
                />
              ))}
              {shown.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="wt-mono"
                    style={{
                      padding: "28px 8px",
                      color: "var(--color-faint)",
                      fontSize: 12,
                    }}
                  >
                    {data
                      ? "NO EVENTS YET — TRIGGER A DECOY TO POPULATE THE STREAM"
                      : "CONNECTING TO STREAM…"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className="wt-mono"
          style={{
            padding: "14px 22px 18px",
            fontSize: 11,
            color: "var(--color-faint)",
            borderTop: "1px solid var(--color-hairline)",
            lineHeight: 1.7,
          }}
        >
          ▲ NEW EVENTS APPEAR AT THE TOP · ACCESS EVENTS ARE LOGGED QUIETLY · USE
          EVENTS OPEN AN INCIDENT IMMEDIATELY
        </div>
      </Blueprint>
    </div>
  )
}

function EventRow({
  event,
  token,
  deptName,
  fresh,
}: {
  event: Event
  token: Honeytoken | undefined
  deptName: string
  fresh: boolean
}) {
  const isUse = event.event_type === "use"

  return (
    <tr
      className={fresh ? "wt-row-in" : undefined}
      style={isUse ? { borderLeft: "2px solid var(--crit)" } : undefined}
    >
      <td
        className="wt-mono"
        style={{ fontSize: 12, color: isUse ? "var(--color-text)" : "#c8d3de" }}
      >
        {clockTimeMs(event.timestamp)}
      </td>
      <td style={{ fontSize: 13 }}>{deptName}</td>
      <td>
        {isUse ? (
          <span
            className="wt-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 11,
              letterSpacing: ".06em",
              color: "var(--crit-text)",
              background: "rgba(232,70,78,.16)",
              border: "1px solid rgba(232,70,78,.45)",
              padding: "3px 8px",
            }}
          >
            <LiveDot color="var(--crit)" size={5} />
            {labelFor(event, token)}
          </span>
        ) : (
          <span
            className="wt-mono"
            style={{
              fontSize: 11,
              letterSpacing: ".06em",
              color: "var(--color-dim)",
              border: "1px solid #2a333c",
              padding: "3px 8px",
            }}
          >
            {labelFor(event, token)}
          </span>
        )}
      </td>
      <td
        className="wt-mono"
        style={{ fontSize: 12, color: isUse ? "var(--crit-text)" : "#c8d3de" }}
      >
        {token?.name ?? "—"}
      </td>
      <td className="wt-mono" style={{ fontSize: 12, color: "var(--color-dim)" }}>
        {event.source_ip}
      </td>
      <td>
        <Tag
          bg={isUse ? "rgba(232,70,78,.14)" : "rgba(143,182,220,.12)"}
          color={isUse ? "var(--crit-text)" : "var(--color-accent-bright)"}
        >
          {event.mitre_id} {event.mitre_name}
        </Tag>
      </td>
    </tr>
  )
}

/** Human-readable event label derived from the decoy type and event class. */
function labelFor(event: Event, token: Honeytoken | undefined): string {
  if (event.event_type === "use") {
    switch (token?.type) {
      case "api_key":
        return "API KEY USED"
      case "source_code_secret":
        return "SOURCE SECRET USED"
      default:
        return "CREDENTIAL USED"
    }
  }
  switch (token?.type) {
    case "credential":
      return "FILE READ"
    case "api_key":
      return "KEY FILE READ"
    case "source_code_secret":
      return "REPO FILE READ"
    default:
      return "DOCUMENT OPENED"
  }
}

function FilterChip({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean
  onClick: () => void
  label: string
  tone?: "crit"
}) {
  const activeStyle =
    tone === "crit"
      ? { background: "var(--crit)", color: "#0b0e11", borderColor: "var(--crit)" }
      : {
          background: "var(--color-accent)",
          color: "#0b0e11",
          borderColor: "var(--color-accent)",
        }

  return (
    <button
      type="button"
      onClick={onClick}
      className="wt-mono"
      style={{
        fontSize: 11,
        letterSpacing: ".02em",
        padding: "3px 10px",
        cursor: "pointer",
        border: "1px solid #2a333c",
        background: "transparent",
        color: tone === "crit" ? "var(--crit-text)" : "var(--color-dim)",
        ...(active ? activeStyle : {}),
      }}
    >
      {label}
    </button>
  )
}
