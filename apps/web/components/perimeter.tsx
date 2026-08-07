"use client"

import { STATUS } from "@/components/wt"
import type { DepartmentView } from "@/lib/useOverview"

/**
 * Perimeter radar — departments placed evenly around a sweep.
 *
 * Position carries no data (we have no real topology); the ring exists so
 * status reads as one glanceable picture next to the zone grid. Blips are
 * ordered deterministically by department so they don't jump between polls.
 */
export function Perimeter({ departments }: { departments: DepartmentView[] }) {
  return (
    <div
      style={{
        position: "relative",
        // Fluid, but never wider than the rail nor larger than its design
        // size. aspectRatio keeps it circular at every width.
        width: "min(224px, 100%)",
        aspectRatio: "1",
        margin: "0 auto 22px",
        border: "1px solid var(--color-divider)",
        borderRadius: "50%",
      }}
    >
      {/* Rings inset proportionally so they hold their spacing when the dial
          scales down. */}
      <div
        style={{
          position: "absolute",
          inset: "15%",
          border: "1px solid var(--color-hairline)",
          borderRadius: "50%",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "33%",
          border: "1px solid var(--color-hairline)",
          borderRadius: "50%",
        }}
      />

      <div
        className="wt-sweep"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: "50%",
            height: "50%",
            background:
              "conic-gradient(from 0deg, rgba(143,182,220,.22), transparent 60%)",
            transformOrigin: "0 100%",
          }}
        />
      </div>

      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 5,
          height: 5,
          margin: -2.5,
          background: "var(--color-accent)",
          borderRadius: "50%",
        }}
      />

      {departments.map((dept, i) => {
        const theme = STATUS[dept.security_level]
        const angle = (i / Math.max(departments.length, 1)) * Math.PI * 2 - Math.PI / 2
        // Alert zones ride further out so they sit clear of the centre.
        const radius = dept.security_level === "secure" ? 0.3 : 0.38
        const left = 50 + Math.cos(angle) * radius * 100
        const top = 50 + Math.sin(angle) * radius * 100
        const size = dept.security_level === "critical" ? 9 : 7

        return (
          <span
            key={dept.id}
            title={`${dept.name} — ${theme.label}`}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              background: theme.color,
              borderRadius: "50%",
              boxShadow:
                dept.security_level === "critical"
                  ? "0 0 12px 3px rgba(232,70,78,.5)"
                  : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
