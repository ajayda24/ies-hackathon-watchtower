"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Blueprint, Kicker } from "@/components/wt"
import { ORG_NAME } from "@/lib/org"

/**
 * Operator sign-in.
 *
 * Deliberately unlike /portal/login, which is the decoy an attacker is meant
 * to reach. That one always fails and never says why; this one is the real
 * door and behaves like it.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [passphrase, setPassphrase] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Sign-in failed.")
        setBusy(false)
        return
      }
      // Full navigation, not router.push: the middleware decides on the
      // server, and a client-side transition would race the new cookie.
      const next = params.get("next")
      window.location.href = next && next.startsWith("/") ? next : "/"
    } catch {
      setError("Could not reach the server.")
      setBusy(false)
    }
  }

  return (
    <div
      className="wt wt-board"
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <Blueprint
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "clamp(20px, 5vw, 32px)",
          background: "var(--color-panel)",
        }}
      >
        <div
          className="wt-mono"
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: ".18em",
            marginBottom: 6,
          }}
        >
          WATCHTOWER
        </div>
        <Kicker style={{ marginBottom: 18 }}>{ORG_NAME.toUpperCase()}</Kicker>

        <h3 style={{ margin: "0 0 6px", fontSize: 22 }}>Operator sign-in</h3>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13.5,
            color: "var(--color-dim)",
            lineHeight: 1.6,
          }}
        >
          The deception console shows live incident data. Decoy assets stay
          reachable without a session — that is what makes them work.
        </p>

        <form onSubmit={submit}>
          <label
            className="wt-mono"
            htmlFor="passphrase"
            style={{
              display: "block",
              fontSize: 10.5,
              letterSpacing: ".12em",
              color: "var(--color-faint)",
              marginBottom: 6,
            }}
          >
            PASSPHRASE
          </label>
          <input
            id="passphrase"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 11px",
              fontSize: 14,
              fontFamily: "var(--mono)",
              color: "var(--color-text)",
              background: "var(--color-bg)",
              border: "1px solid var(--color-divider)",
              borderRadius: 0,
              marginBottom: 14,
            }}
          />

          {error && (
            <div
              className="wt-mono"
              role="alert"
              style={{
                fontSize: 11.5,
                color: "var(--crit-text)",
                border: "1px solid rgba(232,70,78,.4)",
                background: "rgba(232,70,78,.08)",
                padding: "8px 10px",
                marginBottom: 14,
              }}
            >
              {error.toUpperCase()}
            </div>
          )}

          <button
            type="submit"
            className="wt-btn wt-btn-primary"
            style={{ width: "100%" }}
            disabled={busy || passphrase.length === 0}
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
        </form>
      </Blueprint>
    </div>
  )
}
