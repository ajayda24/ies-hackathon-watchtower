"use client"

import { useState } from "react"

import { Blueprint, Kicker, LiveDot, TopNav } from "@/components/wt"
import { ORG_NAME } from "@/lib/org"
import { useOverview } from "@/lib/useOverview"
import type { Department, Honeytoken } from "@/lib/types"

interface RegisterResult {
  department: Department
  honeytokens: Honeytoken[]
  generation: { source: "ai" | "fallback"; provider: string; elapsed_ms: number }
}

/**
 * Screen 02 — Department Registration.
 *
 * The onboarding step, shown on the device that is joining. Registering plants
 * the department's first decoys immediately: a department with none is
 * invisible to the platform, so leaving that to a later manual step would mean
 * a zone that appears on the map but cannot detect anything.
 */
export default function RegisterPage() {
  const { data } = useOverview(4000)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RegisterResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const existing = data?.departments ?? []

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setResult(json as RegisterResult)
      setName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "registration failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wt wt-board">
      <Blueprint className="wt-shell">
        <TopNav active="map" orgName={ORG_NAME} />

        <div style={{ padding: "44px 24px 56px" }}>
          <div style={{ maxWidth: 520, margin: "0 auto" }}>
            {result ? (
              <Registered result={result} onAnother={() => setResult(null)} />
            ) : (
              <form onSubmit={submit} style={{ textAlign: "center" }}>
                <Kicker style={{ marginBottom: 12 }}>
                  DEPARTMENT ONBOARDING
                </Kicker>
                <h2
                  style={{
                    margin: "0 0 10px",
                    fontSize: "clamp(26px, 5vw, 38px)",
                  }}
                >
                  Join {ORG_NAME}
                </h2>
                <p
                  style={{
                    margin: "0 0 28px",
                    fontSize: 15,
                    color: "var(--color-dim)",
                    lineHeight: 1.6,
                  }}
                >
                  Name the department joining Watchtower. Decoys are written for
                  it and planted straight away — files and saved logins that look
                  ordinary, which no real person has any reason to open. Nothing
                  else changes about how anyone works.
                </p>

                <input
                  className="wt-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Civil Engineering"
                  aria-label="Department name"
                  maxLength={60}
                  autoFocus
                  style={{
                    marginBottom: 12,
                    // 16px keeps iOS from zooming the viewport on focus.
                    fontSize: 16,
                    minHeight: 44,
                    textAlign: "center",
                  }}
                />

                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="wt-btn wt-btn-primary"
                  style={{
                    width: "100%",
                    minHeight: 42,
                    opacity: busy || !name.trim() ? 0.5 : 1,
                  }}
                >
                  {busy ? "Planting decoys…" : "Register department"}
                </button>

                {error && (
                  <div
                    className="wt-mono"
                    style={{
                      marginTop: 14,
                      fontSize: 12,
                      color: "var(--crit-text)",
                    }}
                  >
                    {error.toUpperCase()}
                  </div>
                )}

                {existing.length > 0 && (
                  <div style={{ marginTop: 34 }}>
                    <Kicker style={{ marginBottom: 12 }}>
                      ALREADY ON THE MAP
                    </Kicker>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        justifyContent: "center",
                      }}
                    >
                      {existing.map((d) => (
                        <span
                          key={d.id}
                          className="wt-mono"
                          style={{
                            fontSize: 11,
                            padding: "4px 9px",
                            border: "1px solid var(--color-divider)",
                            color: "var(--color-faint)",
                          }}
                        >
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </Blueprint>
    </div>
  )
}

function Registered({
  result,
  onAnother,
}: {
  result: RegisterResult
  onAnother: () => void
}) {
  const { department, honeytokens, generation } = result

  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{ position: "relative", width: 78, height: 78, margin: "0 auto 26px" }}
      >
        <span
          className="wt-ring"
          style={{
            position: "absolute",
            inset: 0,
            border: "1px solid rgba(47,191,155,.55)",
            borderRadius: "50%",
          }}
        />
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            border: "1px solid rgba(47,191,155,.7)",
            borderRadius: "50%",
            background: "rgba(47,191,155,.08)",
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ok)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      </div>

      <Kicker color="var(--ok)" style={{ marginBottom: 12 }}>
        DEPARTMENT REGISTERED
      </Kicker>
      <h2 style={{ margin: "0 0 10px", fontSize: "clamp(26px, 5vw, 38px)" }}>
        {department.name}
      </h2>
      <p
        style={{
          margin: "0 0 26px",
          fontSize: 15,
          color: "var(--color-dim)",
          lineHeight: 1.6,
        }}
      >
        {honeytokens.length} decoys are planted and armed. Any interaction with
        one is an intrusion signal — no legitimate process has a reason to touch
        them.
      </p>

      <Blueprint style={{ textAlign: "left", padding: "16px 18px", marginBottom: 18 }}>
        <Row label="Registration token" value={department.registration_token} />
        <Row label="Decoys planted" value={String(honeytokens.length)} />
        <Row
          label="Written by"
          value={
            generation.source === "ai"
              ? `${generation.provider} · ${(generation.elapsed_ms / 1000).toFixed(1)}s`
              : "pre-written cache"
          }
          tone={generation.source === "ai" ? "var(--ok)" : "var(--warn)"}
        />
        <Row label="Status" value="ARMED" tone="var(--ok)" />
      </Blueprint>

      <div style={{ textAlign: "left", marginBottom: 22 }}>
        <Kicker style={{ marginBottom: 10 }}>PLANTED NOW</Kicker>
        {honeytokens.map((token) => (
          <div
            key={token.id}
            style={{
              padding: "9px 0",
              borderBottom: "1px solid var(--color-hairline)",
            }}
          >
            <div style={{ fontSize: 14 }}>{token.name}</div>
            <div
              className="wt-mono"
              style={{
                fontSize: 11,
                color: "var(--color-faint)",
                overflowWrap: "anywhere",
              }}
            >
              {token.location}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <a href="/" className="wt-btn wt-btn-primary" style={{ flex: "1 1 160px" }}>
          See it on the map
        </a>
        <button
          type="button"
          onClick={onAnother}
          className="wt-btn wt-btn-secondary"
          style={{ flex: "1 1 140px" }}
        >
          Register another
        </button>
      </div>

      <div
        className="wt-mono"
        style={{
          marginTop: 20,
          fontSize: 10.5,
          color: "var(--color-faint)",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <LiveDot />
        THIS ZONE IS NOW REPORTING
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        padding: "6px 0",
        fontSize: 13,
        color: "var(--color-dim)",
      }}
    >
      <span>{label}</span>
      <span
        className="wt-mono"
        style={{ color: tone ?? "var(--color-text)", overflowWrap: "anywhere" }}
      >
        {value}
      </span>
    </div>
  )
}
