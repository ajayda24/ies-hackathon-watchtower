import { Blueprint, Kicker, TopNav } from "@/components/wt"
import { ORG_NAME } from "@/lib/org"

/**
 * Screen 07 — Architecture & Scope.
 *
 * Static by design: this is the claim the rest of the product has to live up
 * to, so it is written once and read out loud rather than computed. Every
 * capability carries one of three tiers, and the tiers are stated plainly —
 * a deception platform that overstates itself is the one thing it cannot be.
 */

interface Item {
  label: string
  detail?: string
}

const LIVE: Item[] = [
  { label: "Honeytoken planting across four decoy types" },
  { label: "AI decoy generation", detail: "contextual to each department" },
  { label: "Access vs. use event classification", detail: "the false-positive defence" },
  { label: "Telemetry stream and live org map" },
  { label: "Incident correlation with a severity ladder" },
  { label: "Scoped automated containment" },
  { label: "MITRE ATT&CK mapping on every event" },
]

const SIMPLIFIED: Item[] = [
  {
    label: "Attribution",
    detail: "rule-based scoring, not a trained model — explainable by design",
  },
  {
    label: "Attribution narrative",
    detail: "derived from event data; an LLM writes it when a key is configured",
  },
  {
    label: "Containment",
    detail: "revokes the decoy; never issues a network-level block",
  },
  {
    label: "Decoy placement",
    detail: "recorded as a path; no agent writes to a real host",
  },
  {
    label: "Storage",
    detail: "in-memory for the demo; Postgres schema written and ready",
  },
  { label: "Multi-tenancy", detail: "one organisation per instance" },
]

const ROADMAP: Item[] = [
  { label: "Cloud decoys (M365, Google Workspace)" },
  { label: "Real SIEM/SOAR ingestion", detail: "payload shape only, unvalidated" },
  { label: "Behavioural analytics beyond thresholds" },
  { label: "Endpoint sensor for legacy hardware" },
  { label: "Auto-learned allowlisting for internal automation" },
]

export default function ScopePage() {
  return (
    <div className="wt wt-board">
      <Blueprint className="wt-shell">
        <TopNav active="scope" orgName={ORG_NAME} />

        <div style={{ padding: "30px 26px 34px" }}>
          <h3
            style={{
              margin: "0 0 8px",
              fontSize: "clamp(22px, 3.4vw, 30px)",
              maxWidth: 640,
            }}
          >
            What is real in this build, what is simplified, and what is next
          </h3>
          <p
            style={{
              margin: "0 0 28px",
              maxWidth: 680,
              fontSize: 14.5,
              color: "var(--color-dim)",
              lineHeight: 1.65,
            }}
          >
            A deception platform earns trust by being exact about its own limits.
            Every capability below carries one of three tiers. We would rather
            tell you where the edges are than have you find them.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: 18,
            }}
          >
            <TierCard
              tier="LIVE"
              count={LIVE.length}
              title="Fully built"
              blurb="Runs end to end. Everything in the demo you are watching."
              items={LIVE}
              color="var(--ok)"
              border="rgba(47,191,155,.5)"
              bg="rgba(47,191,155,.05)"
              marker="✓"
            />
            <TierCard
              tier="SIMPLIFIED"
              count={SIMPLIFIED.length}
              title="Works, with a shortcut"
              blurb="Real logic, reduced surface. Each one names its shortcut."
              items={SIMPLIFIED}
              color="var(--warn)"
              border="rgba(229,166,60,.45)"
              bg="rgba(229,166,60,.04)"
            />
            <TierCard
              tier="ROADMAP"
              count={ROADMAP.length}
              title="Not built yet"
              blurb="Designed and specified, deliberately out of scope for 24 hours."
              items={ROADMAP}
              color="var(--color-faint)"
              border="var(--color-divider)"
              bg="transparent"
              marker="□"
            />
          </div>

          <Blueprint
            style={{
              marginTop: 26,
              padding: 18,
              borderColor: "var(--color-hairline)",
            }}
          >
            <Kicker style={{ marginBottom: 10 }}>
              THE ONE DESIGN DECISION WORTH ARGUING WITH
            </Kicker>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.7,
                color: "var(--color-dim)",
                maxWidth: 780,
              }}
            >
              Containment revokes the triggered decoy and stops there. It never
              blocks a source address or isolates a device, even at critical
              severity. A clinic or a campus sits behind shared NAT, so a wrong
              block takes real systems offline — while revoking a credential
              that was never real cannot hurt anything. We treat that asymmetry
              as the whole point: the actions we automate are the ones that are
              safe to be wrong about, and everything else waits for a person.
            </p>
          </Blueprint>
        </div>
      </Blueprint>
    </div>
  )
}

function TierCard({
  tier,
  count,
  title,
  blurb,
  items,
  color,
  border,
  bg,
  marker,
}: {
  tier: string
  count: number
  title: string
  blurb: string
  items: Item[]
  color: string
  border: string
  bg: string
  marker?: string
}) {
  return (
    <Blueprint
      cornerColor={border}
      style={{ padding: 20, borderColor: border, background: bg }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <span
          className="wt-mono"
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: ".14em",
            background: tier === "ROADMAP" ? "transparent" : color,
            border: tier === "ROADMAP" ? "1px solid #2a333c" : undefined,
            color: tier === "ROADMAP" ? "var(--color-dim)" : "#0b0e11",
            padding: "4px 9px",
          }}
        >
          {tier}
        </span>
        <span
          style={{ fontFamily: "var(--font-heading)", fontSize: 30, color }}
        >
          {count}
        </span>
      </div>

      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 21,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <p
        style={{
          margin: "0 0 16px",
          fontSize: 13,
          color: "var(--color-dim)",
          lineHeight: 1.6,
        }}
      >
        {blurb}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {items.map((item, i) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              gap: 9,
              fontSize: 13.5,
              paddingBottom: 9,
              borderBottom:
                i === items.length - 1
                  ? undefined
                  : "1px solid var(--color-hairline)",
            }}
          >
            {marker && (
              <span className="wt-mono" style={{ color, flex: "none" }}>
                {marker}
              </span>
            )}
            <span style={{ color: marker ? undefined : "var(--color-text)" }}>
              {item.label}
              {item.detail && (
                <span
                  className="wt-mono"
                  style={{
                    fontSize: 11.5,
                    color,
                    display: "block",
                    marginTop: 2,
                  }}
                >
                  → {item.detail}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </Blueprint>
  )
}
