"use client"

import { Blueprint, LiveDot, Tag, TopNav, clockTime, severityTheme } from "@/components/wt"
import { ORG_NAME } from "@/lib/org"
import { useOverview } from "@/lib/useOverview"

/** Incident index — the way into the Threat Timeline for a given incident. */
export default function IncidentsPage() {
  const { data, error } = useOverview()

  const incidents = data?.incidents ?? []
  const departments = data?.departments ?? []
  const deptName = (id: string) =>
    departments.find((d) => d.id === id)?.name ?? "—"

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
          active="incidents"
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
              {incidents.length} TOTAL
            </span>
          }
        />

        <div style={{ padding: "24px 24px 30px" }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 20 }}>Incidents</h4>
          <p
            style={{
              margin: "0 0 22px",
              fontSize: 13,
              color: "var(--color-dim)",
              maxWidth: 640,
            }}
          >
            Every incident here began with a decoy being <em>used</em>, not merely
            opened. Decoys have no legitimate purpose, so there is nothing here to
            triage away as a false positive.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="wt-table" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Opened</th>
                  <th style={{ width: 120 }}>Severity</th>
                  <th>Department</th>
                  <th style={{ width: 150 }}>Source</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => {
                  const theme = severityTheme(incident.severity)
                  return (
                    <tr key={incident.id}>
                      <td className="wt-mono" style={{ fontSize: 12 }}>
                        {clockTime(incident.created_at)}
                      </td>
                      <td>
                        <Tag bg={theme.bg} color={theme.color}>
                          {incident.severity.toUpperCase()}
                        </Tag>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {deptName(incident.department_id)}
                      </td>
                      <td
                        className="wt-mono"
                        style={{ fontSize: 12, color: "var(--color-dim)" }}
                      >
                        {incident.source_ip}
                      </td>
                      <td
                        className="wt-mono"
                        style={{
                          fontSize: 11,
                          letterSpacing: ".08em",
                          color:
                            incident.status === "contained"
                              ? "var(--ok-text)"
                              : "var(--crit-text)",
                        }}
                      >
                        {incident.status.toUpperCase()}
                      </td>
                      <td>
                        <a
                          href={`/incidents/${incident.id}`}
                          className="wt-mono"
                          style={{ fontSize: 12 }}
                        >
                          Open →
                        </a>
                      </td>
                    </tr>
                  )
                })}
                {incidents.length === 0 && (
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
                        ? "NO INCIDENTS — ALL ZONES NOMINAL"
                        : "CONNECTING…"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Blueprint>
    </div>
  )
}
