"use client"

import { use, useEffect, useState } from "react"

import { Blueprint, Kicker, TopNav } from "@/components/wt"
import { ORG_NAME } from "@/lib/org"

interface Report {
  text: string
  provider: string
  model?: string
  elapsed_ms: number
  incident_id: string
  department: string | null
  severity: string
  status: string
  generated_at: string
}

/**
 * Screen 06 — Incident Report.
 *
 * A document view: light paper on the dark console, sized to print. The report
 * body is Markdown from the model, rendered by a deliberately small subset
 * renderer — headings, numbered and bulleted lists, paragraphs — because the
 * report prompt constrains output to exactly those.
 */
export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [report, setReport] = useState<Report | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(
    "loading"
  )

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/incidents/${id}/report`, { method: "POST" })
        if (!alive) return
        if (!res.ok) {
          setState("unavailable")
          return
        }
        setReport(await res.json())
        setState("ready")
      } catch {
        if (alive) setState("unavailable")
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  return (
    <div className="wt wt-board">
      <Blueprint className="wt-shell">
        <TopNav active="incidents" orgName={ORG_NAME} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 22px",
            borderBottom: "1px solid var(--color-divider)",
            background: "var(--color-panel)",
            flexWrap: "wrap",
          }}
        >
          <span
            className="wt-mono"
            style={{ fontSize: 11, letterSpacing: ".1em", color: "var(--color-dim)" }}
          >
            INCIDENT REPORT
          </span>
          {report && (
            <span
              className="wt-mono"
              style={{ fontSize: 11, color: "var(--color-faint)" }}
            >
              {report.provider.toUpperCase()} ·{" "}
              {(report.elapsed_ms / 1000).toFixed(1)}s
            </span>
          )}
          <div
            style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <a href={`/incidents/${id}`} className="wt-btn wt-btn-secondary">
              Back to timeline
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="wt-btn wt-btn-primary"
              disabled={state !== "ready"}
            >
              Print / PDF
            </button>
          </div>
        </div>

        <div style={{ padding: "clamp(14px, 3vw, 34px)", background: "#07090b" }}>
          {state === "loading" && (
            <div
              className="wt-mono"
              style={{
                fontSize: 12,
                color: "var(--color-faint)",
                padding: 40,
                textAlign: "center",
              }}
            >
              WRITING REPORT…
            </div>
          )}

          {state === "unavailable" && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <Kicker color="var(--warn)" style={{ marginBottom: 10 }}>
                REPORT UNAVAILABLE
              </Kicker>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "var(--color-dim)",
                  lineHeight: 1.6,
                }}
              >
                No AI provider is configured, so there is nothing to generate the
                report with. The Threat Timeline still shows the full correlated
                event chain and containment log.
              </p>
            </div>
          )}

          {state === "ready" && report && (
            <article className="wt-paper">
              <header
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 16,
                  paddingBottom: 16,
                  borderBottom: "2px solid #1d1f20",
                  marginBottom: 28,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    className="wt-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: ".16em",
                      color: "#5d5d60",
                      marginBottom: 6,
                    }}
                  >
                    WATCHTOWER · SECURITY INCIDENT REPORT
                  </div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "clamp(22px, 4vw, 32px)",
                      color: "#1d1f20",
                    }}
                  >
                    {report.department ?? "Unknown department"}
                  </h2>
                </div>
                <span
                  className="wt-mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: ".12em",
                    background:
                      report.severity === "critical" || report.severity === "high"
                        ? "#c4353c"
                        : "#b07d1e",
                    color: "#fff",
                    padding: "5px 9px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {report.severity.toUpperCase()}
                </span>
              </header>

              <dl className="wt-paper-meta">
                <Meta label="INCIDENT" value={report.incident_id.slice(0, 8)} />
                <Meta label="ORGANISATION" value={ORG_NAME} />
                <Meta label="STATUS" value={report.status} />
                <Meta label="DATA EXPOSED" value="None" tone="#1a7a63" />
              </dl>

              <Markdown source={report.text} />

              <footer
                className="wt-mono"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingTop: 14,
                  marginTop: 28,
                  borderTop: "1px solid rgba(29,31,32,.2)",
                  fontSize: 10.5,
                  color: "#5d5d60",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  WATCHTOWER · {ORG_NAME} · {report.incident_id.slice(0, 8)}
                </span>
                <span>
                  WRITTEN BY {report.model ?? report.provider} — REVIEW BEFORE
                  CIRCULATING
                </span>
              </footer>
            </article>
          )}
        </div>
      </Blueprint>
    </div>
  )
}

function Meta({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div>
      <dt
        className="wt-mono"
        style={{
          fontSize: 9.5,
          letterSpacing: ".12em",
          color: "#5d5d60",
          marginBottom: 4,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: 14,
          color: tone ?? "#1d1f20",
          textTransform: label === "STATUS" ? "capitalize" : undefined,
        }}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * Minimal Markdown renderer.
 *
 * Deliberately not a library: the report prompt constrains output to `## `
 * headings, numbered lists, bullets and paragraphs, so supporting exactly that
 * subset avoids pulling a parser and its sanitiser into the bundle. Anything
 * unrecognised renders as a paragraph rather than raw markup — the model's
 * output is never injected as HTML.
 */
function Markdown({ source }: { source: string }) {
  const blocks: React.ReactNode[] = []
  const lines = source.split("\n")
  let list: string[] = []
  let ordered = false

  const flushList = () => {
    if (list.length === 0) return
    const items = list.map((item, i) => <li key={i}>{inline(item)}</li>)
    blocks.push(
      ordered ? (
        <ol key={blocks.length}>{items}</ol>
      ) : (
        <ul key={blocks.length}>{items}</ul>
      )
    )
    list = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (!line.trim()) {
      flushList()
      continue
    }

    const heading = /^#{2,3}\s+(.*)$/.exec(line)
    if (heading) {
      flushList()
      blocks.push(<h3 key={blocks.length}>{inline(heading[1]!)}</h3>)
      continue
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (numbered) {
      if (!ordered) flushList()
      ordered = true
      list.push(numbered[1]!)
      continue
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      if (ordered) flushList()
      ordered = false
      list.push(bullet[1]!)
      continue
    }

    flushList()
    blocks.push(<p key={blocks.length}>{inline(line)}</p>)
  }
  flushList()

  return <div className="wt-paper-body">{blocks}</div>
}

/**
 * Renders **bold**, *italic* and `code` spans as elements, never as HTML.
 *
 * Single-asterisk emphasis is matched too: models reach for it around file
 * paths, and an unhandled marker leaks literal asterisks into a document
 * someone is about to forward. The bold alternative is ordered first so `**`
 * wins over `*`.
 */
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="wt-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}
