"use client"

import { use, useEffect, useState } from "react"

import {
  Blueprint,
  Kicker,
  LiveDot,
  Tag,
  TopNav,
  severityTheme,
} from "@/components/wt"
import { useClock } from "@/components/use-clock"
import { PROFILE_CAVEAT, type BehaviourProfile } from "@/lib/profile"
import { formatLatency } from "@/lib/time"
import { ORG_NAME } from "@/lib/org"
import type {
  ContainmentActionRecord,
  Department,
  Event,
  Honeytoken,
  Incident,
} from "@/lib/types"

interface Detail {
  incident: Incident
  department: Department | null
  events: Event[]
  honeytokens: Honeytoken[]
  containment_actions: ContainmentActionRecord[]
  profile: BehaviourProfile
}

/**
 * Screen 05 — Threat Timeline.
 *
 * Reads the correlated event chain in order and narrates why each step did or
 * did not escalate. The narration is derived from the event data itself, not
 * written ahead of time, so it stays true to whatever actually happened during
 * the demo.
 */
export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const clock = useClock()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ai, setAi] = useState<{
    text: string
    provider: string
    model?: string
    elapsed_ms: number
  } | null>(null)
  const [aiState, setAiState] = useState<"idle" | "busy" | "unavailable">("idle")

  async function requestNarrative() {
    setAiState("busy")
    try {
      const res = await fetch(`/api/incidents/${id}/narrative`, {
        method: "POST",
      })
      if (res.status === 503) {
        setAiState("unavailable")
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setAi(await res.json())
      setAiState("idle")
    } catch {
      setAiState("unavailable")
    }
  }

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>

    const tick = async () => {
      try {
        const res = await fetch(`/api/incidents/${id}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as Detail
        if (alive) {
          setDetail(json)
          setError(null)
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "fetch failed")
      } finally {
        if (alive) timer = setTimeout(tick, 2000)
      }
    }

    void tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [id])

  if (!detail) {
    return (
      <div className="wt" style={{ padding: "40px 44px" }}>
        <div className="wt-mono" style={{ fontSize: 12, color: "var(--color-faint)" }}>
          {error ? `ERROR — ${error}` : "LOADING INCIDENT…"}
        </div>
      </div>
    )
  }

  const { incident, department, events, honeytokens, containment_actions } = detail
  const theme = severityTheme(incident.severity)
  const tokenById = new Map(honeytokens.map((t) => [t.id, t]))

  const mitre = Array.from(
    new Map(events.map((e) => [e.mitre_id, e])).values()
  )

  const contained = containment_actions.length > 0

  return (
    <div className="wt wt-board">
      <Blueprint className="wt-shell">
        <TopNav active="incidents" orgName={ORG_NAME} />

        <div
          style={{
            padding: 24,
            borderBottom: "1px solid var(--color-divider)",
            background: `linear-gradient(180deg, ${theme.bg}, transparent)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="wt-mono"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: ".12em",
                    background: theme.color,
                    color: "#0b0e11",
                    padding: "5px 10px",
                  }}
                >
                  <LiveDot color="#0b0e11" size={6} />
                  {incident.severity.toUpperCase()}
                </span>
                <span
                  className="wt-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: ".1em",
                    color: "var(--color-faint)",
                  }}
                >
                  OPENED {clock.time(incident.created_at)}
                  {contained && ` · CONTAINED ${clock.time(incident.updated_at)}`}
                </span>
                {/* The detection-speed claim, measured rather than asserted. */}
                {incident.containment_latency_ms !== null && (
                  <span
                    className="wt-mono"
                    title="Measured from the triggering event to containment completing"
                    style={{
                      fontSize: 10.5,
                      letterSpacing: ".08em",
                      color: "var(--ok-text)",
                      border: "1px solid rgba(47,191,155,.35)",
                      background: "rgba(47,191,155,.08)",
                      padding: "2px 7px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    CONTAINED IN {formatLatency(incident.containment_latency_ms)}
                  </span>
                )}
              </div>

              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: "clamp(21px, 3.4vw, 30px)",
                }}
              >
                Decoy credential used against {department?.name ?? "a department"}
              </h3>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {mitre.map((event) => (
                  <Tag
                    key={event.mitre_id}
                    bg={
                      event.event_type === "use"
                        ? "rgba(232,70,78,.14)"
                        : "rgba(143,182,220,.12)"
                    }
                    color={
                      event.event_type === "use"
                        ? "var(--crit-text)"
                        : "var(--color-accent-bright)"
                    }
                  >
                    {event.mitre_id} {event.mitre_name}
                  </Tag>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minWidth: 190,
              }}
            >
              <Kicker>SIGNAL</Kicker>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 34,
                  lineHeight: 1,
                  color: theme.color,
                }}
              >
                {events.filter((e) => e.event_type === "use").length}
                <span style={{ fontSize: 17, color: "var(--color-dim)" }}>
                  {" "}
                  use
                </span>
              </span>
              <span style={{ fontSize: 12, color: "var(--color-dim)" }}>
                {events.filter((e) => e.event_type === "access").length} access
                event
                {events.filter((e) => e.event_type === "access").length === 1
                  ? ""
                  : "s"}{" "}
                logged alongside. A decoy has no legitimate use, so a use event
                is attacker activity by construction — there is no confidence
                score to compute.
              </span>
            </div>
          </div>
        </div>

        {/* The evidence sidebar is wider than the map's rail — it carries the
            narrative and containment log, not just stats. */}
        <div className="wt-split" style={{ ["--rail" as string]: "430px" }}>
          <div style={{ padding: "24px 26px", minWidth: 0 }}>
            <Kicker style={{ marginBottom: 20 }}>
              CORRELATED EVENTS · {events.length}
            </Kicker>

            <div style={{ position: "relative", paddingLeft: 26 }}>
              <span
                style={{
                  position: "absolute",
                  left: 5,
                  top: 4,
                  bottom: 8,
                  width: 1,
                  background: "var(--color-divider)",
                }}
              />
              {events.map((event, i) => (
                <TimelineStep
                  key={event.id}
                  event={event}
                  token={tokenById.get(event.token_id)}
                  deptName={department?.name ?? "—"}
                  last={i === events.length - 1}
                />
              ))}
            </div>
          </div>

          <div className="wt-rail">
            <Blueprint
              cornerColor="var(--color-accent)"
              style={{
                padding: 16,
                background: "rgba(143,182,220,.07)",
                borderColor: "rgba(143,182,220,.5)",
                marginBottom: 24,
              }}
            >
              <Kicker
                color="var(--color-accent)"
                style={{ marginBottom: 10 }}
              >
                ATTRIBUTION · PLAIN ENGLISH
                {ai && ` · ${ai.provider.toUpperCase()}`}
              </Kicker>

              {(ai
                ? ai.text.split(/\n{2,}/).filter(Boolean)
                : narrative(incident, events, department?.name)
              ).map((para, i) => (
                <p
                  key={i}
                  style={{ margin: "0 0 10px", fontSize: 14.5, lineHeight: 1.65 }}
                >
                  {para}
                </p>
              ))}

              {ai ? (
                <div
                  className="wt-mono"
                  style={{
                    fontSize: 10.5,
                    color: "var(--color-faint)",
                    lineHeight: 1.6,
                    overflowWrap: "anywhere",
                  }}
                >
                  {ai.model} · {(ai.elapsed_ms / 1000).toFixed(1)}s
                </div>
              ) : (
                <>
                  <p
                    style={{
                      margin: "0 0 10px",
                      fontSize: 12,
                      color: "var(--color-faint)",
                      lineHeight: 1.6,
                    }}
                  >
                    {aiState === "unavailable"
                      ? "Rule-derived summary. No AI provider is configured, so this is what the timeline shows."
                      : "Rule-derived summary, built from the events above."}
                  </p>
                  {aiState !== "unavailable" && (
                    <button
                      type="button"
                      onClick={requestNarrative}
                      disabled={aiState === "busy"}
                      className="wt-btn wt-btn-secondary"
                      style={{ width: "100%" }}
                    >
                      {aiState === "busy"
                        ? "Writing…"
                        : "Rewrite in plain English"}
                    </button>
                  )}
                </>
              )}
            </Blueprint>

            {detail.profile.traits.length > 0 && (
              <ProfilePanel profile={detail.profile} />
            )}

            <Kicker style={{ marginBottom: 14 }}>CONTAINMENT · AUTONOMOUS</Kicker>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {containment_actions.map((action) => (
                <div
                  key={action.id}
                  style={{ display: "flex", gap: 11, alignItems: "flex-start" }}
                >
                  <Check />
                  <div>
                    <div style={{ fontSize: 14 }}>{actionLabel(action)}</div>
                    <div
                      className="wt-mono"
                      style={{ fontSize: 11, color: "var(--color-faint)" }}
                    >
                      {clock.time(action.timestamp)} ·{" "}
                      {action.automated ? "automatic" : "manual"}
                    </div>
                  </div>
                </div>
              ))}

              {containment_actions.length === 0 && (
                <div
                  className="wt-mono"
                  style={{ fontSize: 12, color: "var(--color-faint)" }}
                >
                  NO CONTAINMENT FIRED — SEVERITY BELOW THRESHOLD
                </div>
              )}

              {/* Scoped containment stops at the decoy. Everything that touches
                  a real system stays a human decision, stated plainly. */}
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                <span
                  style={{
                    flex: "none",
                    width: 17,
                    height: 17,
                    border: "1px solid #2a333c",
                    marginTop: 2,
                  }}
                />
                <div>
                  <div style={{ fontSize: 14, color: "var(--color-dim)" }}>
                    Review the source host {incident.source_ip}
                  </div>
                  <div
                    className="wt-mono"
                    style={{ fontSize: 11, color: "var(--color-faint)" }}
                  >
                    PENDING · NEEDS A PERSON
                  </div>
                </div>
              </div>
            </div>

            <a
              href={`/incidents/${incident.id}/report`}
              className="wt-btn wt-btn-primary"
              style={{ marginTop: 22, width: "100%" }}
            >
              Generate incident report
            </a>

            <a
              href={`/api/incidents/${incident.id}/siem`}
              target="_blank"
              rel="noreferrer"
              className="wt-btn wt-btn-secondary"
              style={{ marginTop: 8, width: "100%" }}
            >
              View SIEM/SOAR payload
            </a>
            <div
              className="wt-mono"
              style={{
                marginTop: 6,
                fontSize: 10.5,
                color: "var(--color-faint)",
                lineHeight: 1.6,
              }}
            >
              ECS-SHAPED JSON · DELIVERY VERIFIED · FIELD MAPPING UNCONFIRMED
            </div>

            <Blueprint
              style={{
                marginTop: 22,
                padding: 12,
                borderColor: "var(--color-hairline)",
              }}
            >
              <Kicker style={{ marginBottom: 6 }}>WHY NOT AN IP BLOCK</Kicker>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--color-dim)",
                  lineHeight: 1.6,
                }}
              >
                Containment is scoped to the decoy itself. A small clinic or
                campus sits behind shared NAT, so blocking a source address could
                take real systems offline — revoking a credential that was never
                real cannot.
              </div>
            </Blueprint>
          </div>
        </div>
      </Blueprint>
    </div>
  )
}

function TimelineStep({
  event,
  token,
  deptName,
  last,
}: {
  event: Event
  token: Honeytoken | undefined
  deptName: string
  last: boolean
}) {
  const isUse = event.event_type === "use"
  const clock = useClock()

  return (
    <div style={{ position: "relative", marginBottom: last ? 0 : 24 }}>
      <span
        style={{
          position: "absolute",
          left: -26,
          top: 4,
          width: 11,
          height: 11,
          borderRadius: "50%",
          border: isUse
            ? "1px solid rgba(232,70,78,.8)"
            : "1px solid #2a333c",
          background: isUse ? "var(--crit)" : "var(--color-bg)",
          boxShadow: isUse ? "0 0 14px 3px rgba(232,70,78,.55)" : undefined,
        }}
      />
      <div
        className="wt-mono"
        style={{
          fontSize: 11,
          color: isUse ? "var(--crit-text)" : "var(--color-dim)",
          marginBottom: 3,
        }}
      >
        {clock.time(event.timestamp)} · {deptName.toUpperCase()}
      </div>
      <div style={{ fontSize: 15, marginBottom: 3 }}>
        {stepTitle(event, token)}
      </div>
      <div style={{ fontSize: 13, color: "var(--color-dim)" }}>
        {stepCaption(event)}
      </div>
    </div>
  )
}

function stepTitle(event: Event, token: Honeytoken | undefined): string {
  const name = token?.name ?? "a decoy"
  if (event.event_type === "use") {
    return `${name} submitted to the login portal`
  }
  return `${name} opened on ${token?.location ?? "a share"}`
}

function stepCaption(event: Event): string {
  if (event.event_type === "use") {
    return "Use, not access. The decoy's content was actually submitted — this is the signal that opens an incident."
  }
  return "Logged for forensics. A single access does not escalate on its own — a backup job reading a share looks exactly like this."
}

/** Builds the narrative from the events themselves so it can't drift. */
function narrative(
  incident: Incident,
  events: Event[],
  deptName: string | undefined
): string[] {
  const accesses = events.filter((e) => e.event_type === "access").length
  const uses = events.filter((e) => e.event_type === "use").length

  const first: string[] = []
  first.push(
    `Someone at ${incident.source_ip} ${
      accesses > 0
        ? `opened ${accesses} decoy ${accesses === 1 ? "file" : "files"} and then `
        : ""
    }used a planted credential from ${deptName ?? "this department"} to attempt a login.`
  )

  const second = `The credential was never real, so nothing was reached. ${
    uses > 1
      ? `${uses} separate use attempts from the same source place this above a stray click — it reads as hands-on-keyboard activity.`
      : "No legitimate process submits a decoy credential, which is why this opened an incident where a file read would not have."
  }`

  // The insider case, stated where the question actually arises. Tools that
  // detect intrusion by credential validity or behavioural baseline cannot see
  // an insider: their credentials are genuine and their behaviour is normal
  // for them. A decoy sidesteps that entirely — it is not evidence about who
  // someone is, only that they used something no legitimate role has a reason
  // to touch. Worth saying plainly, because "was this an outsider?" is the
  // first thing anyone reading this will ask.
  const third =
    "This detection does not depend on the account being stolen. An insider with entirely valid credentials still has no legitimate reason to use a decoy, so the same signal holds either way — what it identifies is the action, not the person."

  return [first[0]!, second, third]
}

/**
 * Behavioural profile.
 *
 * The caveat is rendered inside this component, not beside it, so a future
 * layout change cannot separate the traits from the statement that they are
 * behaviour rather than identity. That separation is precisely how a careful
 * feature turns into an overclaim.
 */
function ProfilePanel({ profile }: { profile: BehaviourProfile }) {
  return (
    <>
      <Kicker style={{ marginBottom: 14 }}>
        BEHAVIOURAL PROFILE · OBSERVED
      </Kicker>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 22,
        }}
      >
        {profile.traits.map((trait) => (
          <div key={trait.label}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                marginBottom: 2,
              }}
            >
              <span
                className="wt-mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: ".1em",
                  color: "var(--color-faint)",
                  border: "1px solid var(--color-divider)",
                  padding: "1px 5px",
                  flex: "none",
                }}
              >
                {trait.kind.toUpperCase()}
              </span>
              <span style={{ fontSize: 14 }}>{trait.label}</span>
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--color-dim)",
                lineHeight: 1.55,
              }}
            >
              {trait.evidence}
            </div>
          </div>
        ))}

        <p
          style={{
            margin: 0,
            paddingTop: 10,
            borderTop: "1px solid var(--color-hairline)",
            fontSize: 12,
            color: "var(--color-faint)",
            lineHeight: 1.6,
          }}
        >
          {PROFILE_CAVEAT}
        </p>
      </div>
    </>
  )
}

function actionLabel(action: ContainmentActionRecord): string {
  switch (action.action) {
    case "CREDENTIAL_REVOKED":
      return "Decoy credential revoked and marked triggered"
    case "ALERT_ESCALATED":
      return "Incident escalated and operator alerted"
    case "SESSION_ISOLATED":
      return "Decoy session isolated"
    default:
      return action.action
  }
}

function Check() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ok)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none", marginTop: 2 }}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
