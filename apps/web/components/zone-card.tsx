"use client"

import { Blueprint, LiveDot, STATUS } from "@/components/wt"
import type { DepartmentView } from "@/lib/useOverview"
import type { Event } from "@/lib/types"

/**
 * One department block on the org map.
 *
 * The whole point of the map is that a judge can watch a specific block go
 * green → amber → red during the demo, so status drives the border, the
 * background wash, the corner marks, and the sparkline together — one glance
 * should read at the back of a room.
 */
export function ZoneCard({
  dept,
  index,
  events,
  onSelect,
}: {
  dept: DepartmentView
  index: number
  events: Event[]
  onSelect?: (dept: DepartmentView) => void
}) {
  const theme = STATUS[dept.security_level]
  const critical = dept.security_level === "critical"

  const activity = activitySeries(events, dept.id)
  const statusLine = statusCaption(dept)

  return (
    <Blueprint
      className={critical ? "wt-pulse" : undefined}
      cornerColor={
        dept.security_level === "secure" ? undefined : theme.border
      }
      style={{
        position: "relative",
        padding: 16,
        background: dept.security_level === "secure" ? "transparent" : theme.bg,
        borderColor:
          dept.security_level === "secure"
            ? "var(--color-divider)"
            : theme.border,
        cursor: onSelect ? "pointer" : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => onSelect?.(dept)}
        aria-label={`${dept.name} — ${theme.label}`}
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          border: 0,
          cursor: onSelect ? "pointer" : "default",
          padding: 0,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <span
          className="wt-mono"
          style={{
            fontSize: 9.5,
            letterSpacing: ".14em",
            color: dept.security_level === "secure" ? "var(--color-faint)" : theme.text,
          }}
        >
          ZONE {String(index + 1).padStart(2, "0")}
        </span>
        {critical ? (
          <span style={{ position: "relative", width: 9, height: 9 }}>
            <span
              style={{
                position: "absolute",
                inset: 0,
                background: "var(--crit)",
                borderRadius: "50%",
              }}
            />
            <span
              className="wt-ring"
              style={{
                position: "absolute",
                inset: 0,
                border: "1px solid var(--crit)",
                borderRadius: "50%",
              }}
            />
          </span>
        ) : (
          <span
            style={{
              width: 9,
              height: 9,
              background: theme.color,
              borderRadius: "50%",
            }}
          />
        )}
      </div>

      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 26,
          lineHeight: 1.1,
          marginBottom: 10,
        }}
      >
        {dept.name}
      </div>

      <div
        className="wt-mono"
        style={{
          fontSize: 10,
          letterSpacing: ".1em",
          color: theme.color,
          marginBottom: 12,
        }}
      >
        {statusLine}
      </div>

      <div
        className="wt-mono"
        style={{ display: "flex", gap: 20, fontSize: 11, color: "var(--color-dim)" }}
      >
        <span>
          <b style={{ color: "var(--color-text)", fontSize: 15, fontWeight: 600 }}>
            {dept.honeytoken_count}
          </b>{" "}
          decoys
        </span>
        <span>
          <b
            style={{
              color:
                dept.open_incidents + dept.contained_incidents > 0
                  ? theme.color
                  : "var(--color-text)",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {dept.open_incidents + dept.contained_incidents}
          </b>{" "}
          incidents
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 2,
          height: 22,
          marginTop: 14,
        }}
      >
        {activity.map((height, i) => {
          const hot = critical && i >= activity.length - 2 && height > 0
          return (
            <span
              key={i}
              className={hot ? "wt-bar" : undefined}
              style={{
                flex: 1,
                height: `${Math.max(height, 12)}%`,
                background:
                  height === 0
                    ? "var(--color-hairline)"
                    : dept.security_level === "secure"
                      ? "#2a333c"
                      : theme.color,
                opacity: height === 0 ? 1 : 0.35 + 0.65 * (height / 100),
                transformOrigin: "bottom",
              }}
            />
          )
        })}
      </div>
    </Blueprint>
  )
}

/**
 * Buckets this department's recent events into 7 slots for the sparkline.
 * Purely illustrative of tempo — the numbers above it carry the real counts.
 */
function activitySeries(events: Event[], departmentId: string): number[] {
  const buckets = new Array(7).fill(0) as number[]
  const mine = events.filter((e) => e.department_id === departmentId)
  if (mine.length === 0) return buckets

  const now = Date.now()
  const span = 30 * 60 * 1000 // 30 minutes across the whole strip
  for (const event of mine) {
    const age = now - new Date(event.timestamp).getTime()
    if (age > span || age < 0) continue
    const slot = Math.min(6, Math.floor((1 - age / span) * 7))
    buckets[slot] = (buckets[slot] ?? 0) + 1
  }

  const peak = Math.max(...buckets, 1)
  return buckets.map((count) => Math.round((count / peak) * 100))
}

function statusCaption(dept: DepartmentView): string {
  if (dept.security_level === "critical") return "CRITICAL — DECOY CREDENTIAL USED"
  if (dept.security_level === "warning") {
    return dept.open_incidents > 0
      ? "WARNING — DECOY ACTIVITY DETECTED"
      : "WARNING — DECOYS TOUCHED"
  }
  return "SECURE — NO ACTIVITY"
}
