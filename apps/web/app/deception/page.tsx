"use client"

import { useEffect, useMemo, useState } from "react"

import { Blueprint, Kicker, LiveDot, Tag, TopNav } from "@/components/wt"
import { ORG_NAME } from "@/lib/org"
import { useOverview } from "@/lib/useOverview"
import type { Honeytoken, HoneytokenType } from "@/lib/types"

interface Proposal {
  name: string
  content: string
  location: string
  rationale: string
  source: "ai" | "fallback"
  provider: "groq" | "anthropic" | "fallback"
  model?: string
  elapsed_ms: number
  error?: string
  type: HoneytokenType
  department_id: string
  department_name: string
  configured_provider: { name: string; model?: string }
}

const TYPES: Array<{ value: HoneytokenType; label: string; hint: string }> = [
  { value: "credential", label: "Credential", hint: "saved login" },
  { value: "document", label: "Document", hint: "xlsx / pdf" },
  { value: "api_key", label: "API key", hint: "token" },
  { value: "source_code_secret", label: "Source secret", hint: "repo .env" },
]

/**
 * Screen 03 — Deception Management Console.
 *
 * Generate → review → deploy. Generation and planting are separate steps so an
 * operator can regenerate until the bait reads right, and so a demo can show
 * the proposed decoy on screen before anything is committed.
 */
export default function DeceptionPage() {
  const { data } = useOverview(4000)
  const departments = data?.departments ?? []

  const [departmentId, setDepartmentId] = useState<string>("")
  const [type, setType] = useState<HoneytokenType>("credential")
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [deployed, setDeployed] = useState<Honeytoken | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Default to the first department once the overview lands.
  useEffect(() => {
    if (!departmentId && departments.length > 0) {
      setDepartmentId(departments[0]!.id)
    }
  }, [departments, departmentId])

  const tokens = useMemo(
    () => (data?.honeytokens ?? []).filter((t) => t.department_id === departmentId),
    [data, departmentId]
  )

  const activeDept = departments.find((d) => d.id === departmentId)

  async function generate() {
    if (!departmentId) return
    setBusy(true)
    setError(null)
    setDeployed(null)
    try {
      const res = await fetch("/api/decoys/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ department_id: departmentId, type }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setProposal((await res.json()) as Proposal)
    } catch (err) {
      setError(err instanceof Error ? err.message : "generation failed")
    } finally {
      setBusy(false)
    }
  }

  async function deploy() {
    if (!proposal) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/decoys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          department_id: proposal.department_id,
          type: proposal.type,
          name: proposal.name,
          content: proposal.content,
          location: proposal.location,
          ai_generated: proposal.source === "ai",
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { honeytoken: Honeytoken }
      setDeployed(json.honeytoken)
      setProposal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "deploy failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wt wt-board">
      <Blueprint className="wt-shell">
        <TopNav
          active="deception"
          orgName={ORG_NAME}
          right={
            <span
              className="wt-mono"
              style={{ fontSize: 11, color: "var(--color-faint)" }}
            >
              {(data?.honeytokens ?? []).length} DECOYS ACTIVE
            </span>
          }
        />

        <div className="wt-split" style={{ ["--rail" as string]: "1fr" }}>
          <div style={{ padding: "26px 24px 28px", minWidth: 0 }}>
            <h4 style={{ margin: "0 0 4px", fontSize: 20 }}>Plant a new decoy</h4>
            <p
              style={{
                margin: "0 0 22px",
                fontSize: 13,
                color: "var(--color-dim)",
                maxWidth: 460,
              }}
            >
              Watchtower writes the bait so it matches the department&apos;s real
              language. Nothing is planted until you deploy it.
            </p>

            <Kicker style={{ marginBottom: 9 }}>STEP 1 — DEPARTMENT</Kicker>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 22,
              }}
            >
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setDepartmentId(dept.id)}
                  className="wt-mono"
                  style={{
                    fontSize: 12,
                    padding: "7px 12px",
                    cursor: "pointer",
                    border: "1px solid var(--color-divider)",
                    background:
                      dept.id === departmentId
                        ? "var(--color-accent)"
                        : "transparent",
                    color:
                      dept.id === departmentId ? "#0b0e11" : "var(--color-dim)",
                  }}
                >
                  {dept.name}
                </button>
              ))}
              {departments.length === 0 && (
                <span
                  className="wt-mono"
                  style={{ fontSize: 12, color: "var(--color-faint)" }}
                >
                  LOADING DEPARTMENTS…
                </span>
              )}
            </div>

            <Kicker style={{ marginBottom: 9 }}>STEP 2 — DECOY TYPE</Kicker>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                gap: 10,
                marginBottom: 22,
              }}
            >
              {TYPES.map((t) => {
                const active = t.value === type
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    style={{
                      textAlign: "left",
                      padding: 13,
                      cursor: "pointer",
                      border: `1px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
                      background: active
                        ? "rgba(143,182,220,.09)"
                        : "transparent",
                      color: "var(--color-text)",
                    }}
                  >
                    <div style={{ fontSize: 14 }}>{t.label}</div>
                    <div
                      className="wt-mono"
                      style={{ fontSize: 10, color: "var(--color-faint)" }}
                    >
                      {t.hint}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={generate}
                disabled={busy || !departmentId}
                className="wt-btn wt-btn-primary"
                style={{ opacity: busy || !departmentId ? 0.5 : 1 }}
              >
                {busy ? "Working…" : proposal ? "Regenerate" : "Generate decoy"}
              </button>
              {proposal && (
                <button
                  type="button"
                  onClick={deploy}
                  disabled={busy}
                  className="wt-btn wt-btn-secondary"
                >
                  Deploy to {proposal.department_name}
                </button>
              )}
            </div>

            {error && (
              <div
                className="wt-mono"
                style={{ marginTop: 14, fontSize: 12, color: "var(--crit-text)" }}
              >
                ERROR — {error}
              </div>
            )}

            {deployed && (
              <Blueprint
                cornerColor="rgba(47,191,155,.8)"
                style={{
                  marginTop: 18,
                  padding: 13,
                  borderColor: "rgba(47,191,155,.5)",
                  background: "rgba(47,191,155,.06)",
                }}
              >
                <Kicker color="var(--ok)" style={{ marginBottom: 6 }}>
                  DECOY PLANTED
                </Kicker>
                <div style={{ fontSize: 14, marginBottom: 8 }}>
                  {deployed.name}
                </div>
                <div
                  className="wt-mono"
                  style={{ fontSize: 11, color: "var(--color-dim)", lineHeight: 1.7 }}
                >
                  tracking id: {deployed.tracking_id}
                  <br />
                  <a href={`/share/${deployed.tracking_id}`}>
                    open as an attacker would →
                  </a>
                </div>
              </Blueprint>
            )}
          </div>

          <div className="wt-rail">
            <Proposed proposal={proposal} busy={busy} />
          </div>
        </div>

        <div style={{ padding: "8px 24px 26px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              margin: "18px 0 10px",
              flexWrap: "wrap",
            }}
          >
            <h4 style={{ margin: 0, fontSize: 17 }}>
              Decoys in {activeDept?.name ?? "this department"}
            </h4>
            <span
              className="wt-mono"
              style={{
                fontSize: 10,
                letterSpacing: ".1em",
                color: "var(--color-faint)",
              }}
            >
              {tokens.length} TOTAL ·{" "}
              {tokens.filter((t) => t.status === "triggered").length} TRIGGERED
            </span>
          </div>

          <div className="wt-scroll-x">
            <table className="wt-table wt-table-cards" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ width: 130 }}>Type</th>
                  <th style={{ width: 130 }}>Origin</th>
                  <th>Location</th>
                  <th style={{ width: 120 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id}>
                    <td
                      data-label="Name"
                      className="wt-mono"
                      style={{
                        fontSize: 12.5,
                        color:
                          token.status === "triggered"
                            ? "var(--crit-text)"
                            : "var(--color-text)",
                      }}
                    >
                      {token.name}
                    </td>
                    <td data-label="Type" style={{ fontSize: 13 }}>
                      {TYPES.find((t) => t.value === token.type)?.label ??
                        token.type}
                    </td>
                    <td data-label="Origin">
                      <Tag
                        bg={
                          token.ai_generated
                            ? "rgba(143,182,220,.14)"
                            : "transparent"
                        }
                        color={
                          token.ai_generated
                            ? "var(--color-accent-bright)"
                            : "var(--color-faint)"
                        }
                      >
                        {token.ai_generated ? "AI" : "SEEDED"}
                      </Tag>
                    </td>
                    <td
                      data-label="Location"
                      className="wt-mono"
                      style={{
                        fontSize: 11.5,
                        color: "var(--color-dim)",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {token.location}
                    </td>
                    <td data-label="Status">
                      <Tag
                        bg={
                          token.status === "triggered"
                            ? "rgba(232,70,78,.16)"
                            : "rgba(47,191,155,.14)"
                        }
                        color={
                          token.status === "triggered"
                            ? "var(--crit-text)"
                            : "var(--ok-text)"
                        }
                      >
                        {token.status.toUpperCase()}
                      </Tag>
                    </td>
                  </tr>
                ))}
                {tokens.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      data-label=""
                      className="wt-mono"
                      style={{
                        padding: "24px 8px",
                        fontSize: 12,
                        color: "var(--color-faint)",
                      }}
                    >
                      NO DECOYS IN THIS DEPARTMENT YET
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

/** The proposed-decoy panel — the screen's centrepiece during a demo. */
function Proposed({
  proposal,
  busy,
}: {
  proposal: Proposal | null
  busy: boolean
}) {
  if (!proposal) {
    return (
      <>
        <Kicker style={{ marginBottom: 12 }}>PROPOSED DECOY</Kicker>
        <div
          className="wt-mono"
          style={{ fontSize: 12, color: "var(--color-faint)", lineHeight: 1.8 }}
        >
          {busy
            ? "GENERATING…"
            : "PICK A DEPARTMENT AND TYPE, THEN GENERATE. NOTHING IS PLANTED UNTIL YOU DEPLOY."}
        </div>
      </>
    )
  }

  const live = proposal.source === "ai"

  return (
    <Blueprint
      cornerColor="var(--color-accent)"
      style={{
        padding: 18,
        background: "var(--color-panel)",
        borderColor: "rgba(143,182,220,.5)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        <Kicker color={live ? "var(--color-accent)" : "var(--warn)"}>
          {live
            ? `AI GENERATED · ${proposal.provider.toUpperCase()}`
            : "PRE-CACHED FALLBACK"}
        </Kicker>
        <span
          className="wt-mono"
          style={{ fontSize: 9.5, color: "var(--color-faint)" }}
        >
          {(proposal.elapsed_ms / 1000).toFixed(1)}s
        </span>
        {live && <LiveDot color="var(--ok)" />}
      </div>

      {live && proposal.model && (
        <div
          className="wt-mono"
          style={{
            fontSize: 10,
            color: "var(--color-faint)",
            marginBottom: 8,
            overflowWrap: "anywhere",
          }}
        >
          {proposal.model}
        </div>
      )}

      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 19,
          marginBottom: 14,
        }}
      >
        {proposal.name}
      </div>

      <div
        className="wt-mono"
        style={{
          fontSize: 12.5,
          lineHeight: 1.85,
          background: "#080b0d",
          border: "1px solid var(--color-hairline)",
          padding: 14,
          color: "#c8d3de",
          marginBottom: 14,
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
        }}
      >
        {proposal.content}
      </div>

      <p
        style={{
          margin: "0 0 12px",
          fontSize: 13,
          color: "var(--color-dim)",
          lineHeight: 1.6,
        }}
      >
        {proposal.rationale}
      </p>

      <div
        className="wt-mono"
        style={{
          fontSize: 11,
          color: "var(--color-faint)",
          marginBottom: 14,
          overflowWrap: "anywhere",
        }}
      >
        {proposal.location}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Tag bg="rgba(47,191,155,.14)" color="var(--ok-text)">
          grants no access
        </Tag>
        <Tag bg="rgba(143,182,220,.14)" color="var(--color-accent-bright)">
          tripwire armed on deploy
        </Tag>
      </div>

      {/* Stated plainly rather than hidden: a fallback that claimed to be a
          live generation would undercut the same honesty the Scope screen
          argues for. */}
      {!live && (
        <div
          className="wt-mono"
          style={{
            marginTop: 12,
            fontSize: 11,
            color: "var(--warn-text)",
            lineHeight: 1.6,
          }}
        >
          {proposal.error
            ? `LIVE CALL FAILED (${proposal.error}) — SERVED FROM CACHE`
            : "NO API KEY CONFIGURED — SERVED FROM PRE-WRITTEN CACHE"}
        </div>
      )}
    </Blueprint>
  )
}
