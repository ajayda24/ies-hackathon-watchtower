import type { CSSProperties, ReactNode } from "react"

import type { SecurityLevel, Severity } from "@/lib/types"

/**
 * Blueprint frame — the system's one container primitive. Registration marks
 * are drawn outside the border, so anything wrapping this must not clip.
 */
export function Blueprint({
  children,
  style,
  cornerColor,
  className = "",
}: {
  children?: ReactNode
  style?: CSSProperties
  /** Corner marks pick up status colour when the frame is an alert. */
  cornerColor?: string
  className?: string
}) {
  const corner = cornerColor ? { color: cornerColor } : undefined
  return (
    <div className={`wt-blueprint ${className}`} style={style}>
      <i className="wt-corner tl" style={corner} />
      <i className="wt-corner tr" style={corner} />
      <i className="wt-corner bl" style={corner} />
      <i className="wt-corner br" style={corner} />
      {children}
    </div>
  )
}

/** Small caps machine label — section kickers, field names. */
export function Kicker({
  children,
  color,
  style,
}: {
  children: ReactNode
  color?: string
  style?: CSSProperties
}) {
  return (
    <div className="wt-kicker" style={{ color, ...style }}>
      {children}
    </div>
  )
}

export interface StatusTheme {
  color: string
  text: string
  border: string
  bg: string
  label: string
}

/** One place mapping a security level to its colour set. */
export const STATUS: Record<SecurityLevel, StatusTheme> = {
  secure: {
    color: "var(--ok)",
    text: "var(--ok-text)",
    border: "rgba(47,191,155,.5)",
    bg: "rgba(47,191,155,.05)",
    label: "SECURE",
  },
  warning: {
    color: "var(--warn)",
    text: "var(--warn-text)",
    border: "rgba(229,166,60,.4)",
    bg: "rgba(229,166,60,.04)",
    label: "WARNING",
  },
  critical: {
    color: "var(--crit)",
    text: "var(--crit-text)",
    border: "rgba(232,70,78,.55)",
    bg: "rgba(232,70,78,.05)",
    label: "CRITICAL",
  },
}

/** Severity shares the status palette; low/medium read as warning. */
export function severityTheme(severity: Severity): StatusTheme {
  if (severity === "critical" || severity === "high") return STATUS.critical
  if (severity === "medium") return STATUS.warning
  return STATUS.secure
}

/** Live indicator — a pulsing dot plus a label. */
export function LiveDot({
  color = "var(--ok)",
  size = 5,
}: {
  color?: string
  size?: number
}) {
  return (
    <span
      className="wt-dot"
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: "50%",
        flex: "none",
      }}
    />
  )
}

export function Tag({
  children,
  bg,
  color,
  style,
}: {
  children: ReactNode
  bg?: string
  color?: string
  style?: CSSProperties
}) {
  return (
    <span className="wt-tag" style={{ background: bg, color, ...style }}>
      {children}
    </span>
  )
}

/** Top chrome shared by every dashboard screen. */
export function TopNav({
  active,
  orgName,
  right,
}: {
  active: "map" | "deception" | "telemetry" | "incidents" | "scope"
  orgName: string
  right?: ReactNode
}) {
  const items: Array<{ key: typeof active; label: string; href: string }> = [
    { key: "map", label: "Map", href: "/" },
    { key: "deception", label: "Deception", href: "/deception" },
    { key: "telemetry", label: "Telemetry", href: "/telemetry" },
    { key: "incidents", label: "Incidents", href: "/incidents" },
    { key: "scope", label: "Scope", href: "/scope" },
  ]

  return (
    <div className="wt-nav">
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 17,
          letterSpacing: ".08em",
        }}
      >
        WATCHTOWER
      </span>
      <span
        className="wt-mono wt-nav-org"
        style={{
          fontSize: 10,
          letterSpacing: ".12em",
          color: "var(--color-faint)",
          borderLeft: "1px solid var(--color-divider)",
          paddingLeft: 16,
          textTransform: "uppercase",
        }}
      >
        {orgName}
      </span>
      <div
        className="wt-nav-links"
        style={{
          display: "flex",
          gap: 20,
          fontSize: 13,
          color: "var(--color-dim)",
        }}
      >
        {items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            style={
              item.key === active
                ? {
                    color: "var(--color-text)",
                    borderBottom: "1px solid var(--color-accent)",
                    paddingBottom: 2,
                  }
                : { color: "var(--color-dim)" }
            }
          >
            {item.label}
          </a>
        ))}
      </div>
      <div className="wt-nav-right">{right}</div>
    </div>
  )
}

// No clock re-export here on purpose. Screens render in the viewer's timezone
// via useClock() (components/use-clock.ts), which is hydration-safe; server
// routes import the UTC formatters from @/lib/time directly. Re-exporting the
// UTC helpers under a neutral name is what let a server-side formatter drift
// into client screens in the first place.
