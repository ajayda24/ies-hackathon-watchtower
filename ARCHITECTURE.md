# Watchtower — Architecture

Autonomous deception intelligence platform. Plants AI-generated decoy assets
across an organisation, detects interaction with them, correlates that
interaction into incidents, and contains what is safe to contain automatically.

This document describes what is built. Where something is simplified or absent,
it says so — the same claim the `/scope` screen makes in the product.

---

## 1. The central idea

A decoy has no legitimate purpose. Nobody has a reason to use one. That single
property is what the whole platform is built on, and it is why detection here
does not need a signature, a baseline, or a trained model.

But "nobody has a reason to use one" is not the same as "nobody will ever
touch one", and conflating those two is how deception tools become noise
generators. Watchtower splits every interaction into two kinds:

| | Meaning | Innocent explanation | Response |
|---|---|---|---|
| **`access`** | The decoy was read | Backup jobs, search indexers, curious staff | Logged. Never escalates. |
| **`use`** | The decoy's contents were submitted somewhere | **None** | Opens an incident. |

A backup job reads every file on a share every night and produces `access`
events forever. Paging someone for that is how a security tool gets muted. But
no backup job submits a password to a login form. A `use` event is attacker
activity *by construction* — which is why there is no confidence score anywhere
in this system. There is nothing to be uncertain about.

`lib/correlation.ts` enforces this: the `access` path returns before any
escalation logic runs.

---

## 2. Request flow

```
                        ATTACKER
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
   opens a decoy doc                  submits a credential
          │                                   │
   GET /api/track/[id]                POST /api/decoy/login
   (1×1 tracking pixel)               (mock portal, always 401)
          │                                   │
          └─────────────────┬─────────────────┘
                            ▼
                  lib/correlation.ts
                   recordTrigger()
                            │
              ┌─────────────┴─────────────┐
         event_type = access        event_type = use
              │                             │
        log + return              count uses from this IP
        (no incident)              in a 10-minute window
                                            │
                                   severity ladder
                                   1 → medium
                                   2 → high      ─┐
                                   3+ → critical ─┤
                                            │     │
                                   open or update │
                                     incident     │
                                            │     │
                                            ▼     ▼
                                    triggerContainment()
                                    • revoke the decoy
                                    • raise the alert
                                    • stamp latency
                                            │
                                            ▼
                                   recomputeSecurityLevel()
                                            │
                     ┌──────────────────────┼──────────────────────┐
                     ▼                      ▼                      ▼
               dashboards            AI narrative /          SIEM payload
              (2s polling)              report                (on demand)
```

Both entry points funnel into one function. There is no second code path for
"the other kind of trigger", so the access/use rule cannot be bypassed by
adding a new decoy type later.

---

## 3. Components

### Detection surfaces

| Route | Kind | Notes |
|---|---|---|
| `GET /api/track/[trackingId]` | `access` | Returns a real 1×1 GIF **even for unknown IDs**, so a probing attacker cannot distinguish a live decoy from a dead link. `no-store`, or a cached pixel means the second open never reports. |
| `POST /api/decoy/login` | `use` | Matches the submitted username against every planted credential. Returns an identical `401 Invalid username or password` whether or not it matched. |

The uniform failure response is deliberate. If the attacker learns they hit a
decoy, they learn the environment is monitored, and everything after that is
harder.

**The submitted password is never stored** — only its length
(`app/api/decoy/login/route.ts`). Enough to show the planted value was used
verbatim, without the platform accumulating secrets.

### Correlation (`lib/correlation.ts`)

The product logic, in one file:

- **Severity ladder** — uses from one source inside a 10-minute window:
  `1 → medium`, `2 → high`, `3+ → critical`. Two attempts read as
  hands-on-keyboard persistence rather than a stray click.
- **Grouping** — one open incident per (source IP, department). Repeat activity
  escalates the existing incident rather than fragmenting into many.
- **Containment threshold** — fires at `high` and above.
- **Latency** — `performance.now()` around the whole path. Measured, not
  estimated; typically **under 1ms** against the in-memory store.
- **Automation allowlist** — a static set of source IPs whose `access` events
  are marked suppressed. Note it only ever suppresses `access`; a `use` from an
  allowlisted source still escalates, because no backup job submits a password.

### Containment — and its limit

Automatic:
- Revoke the triggered decoy
- Raise and escalate the alert

Never automatic:
- Blocking a source address
- Isolating a device

**This is the one design decision worth arguing with.** A campus or clinic sits
behind shared NAT, so blocking one address can take real systems offline —
while revoking a credential that was never real cannot hurt anything.

The rule: **automate the actions that are safe to be wrong about.** Everything
else appears in the incident as `PENDING · NEEDS A PERSON`, an unchecked item
so nobody mistakes a contained incident for a resolved one.

A contained incident also does *not* clear the department badge.
`recomputeSecurityLevel()` counts incidents with `status !== "closed"`, because
counting only open ones would flip a zone back to green the instant containment
fired — hiding the incident at the moment it most needs looking at. A human
closes it.

### AI layer (`lib/ai/`)

Three calls, all behind one `Provider` interface (`groq | anthropic | fallback`):

1. **Decoy generation** — department-contextual names, paths and content.
2. **Attribution narrative** — on demand, not automatic. An incident opens in
   under a millisecond; putting a model round-trip in the containment path
   would make the slowest component gate the most time-critical one.
3. **Incident report** — a formal document, print-ready.

Two constraints hold across all three:

- **Prompts carry only facts already in the store.** The model's job is
  structure and plain language, never inference about who the attacker was.
  The report prompt explicitly states the evidence identifies an address and a
  sequence of actions, not a person, an organisation, or a country.
- **Failure is never fatal.** Every call falls back to curated content and the
  UI states which path ran. A dead API key degrades the demo; it does not break
  it.

Current provider: Groq, `openai/gpt-oss-120b`.

### MITRE ATT&CK mapping (`lib/mitre.ts`)

A static lookup table, deliberately not an inference step. Every technique tag
in the UI traces to one line of code:

| Trigger | Technique |
|---|---|
| credential `use` | T1078 Valid Accounts |
| document `access` | T1552 Unsecured Credentials |
| api_key / source-secret `use` | T1552.001 Credentials In Files |
| source-code `access` | T1213 Data from Information Repositories |

This is the explainability answer. A judge can point at any tag on screen and
be shown the line that produced it.

### SIEM/SOAR forwarding (`lib/siem.ts`)

Builds an ECS-shaped envelope and POSTs it to `SIEM_WEBHOOK_URL`.

- **Verified:** delivery. Run against a live HTTP receiver — 200 OK,
  well-formed JSON, all five ECS fields an indexer keys on present
  (`@timestamp`, `event.kind`, `event.severity`, `source.ip`,
  `threat.framework`).
- **Not verified:** index-time field mapping against a real Splunk, Sentinel or
  Elastic pipeline.

The payload carries `tier: "delivery-verified"` so the distinction travels with
the data. Forwarding never throws — detection and containment have already
happened by the time it runs, and a downstream outage must not affect them.

---

## 4. Data model

`lib/types.ts`, mirrored by `db/schema.sql` (Postgres-ready, not yet wired).

```
departments ──< honeytokens ──< events
     │                            │
     └──< incidents ──< incident_events
              │
              └──< containment_actions
```

Two decisions worth stating:

**No attribution fields.** An earlier draft carried `attribution_profile`,
`attribution_confidence` and `attribution_narrative`. All three were written
once at incident creation and never computed — dead columns implying a
classifier that did not exist, which is worse than absent because a reader
assumes something scored them. They were removed. What the evidence supports is
a source address and an ordered sequence of actions.

**`containment_latency_ms` is nullable.** Null until containment fires. An
incident below the threshold has no containment to measure, and reporting `0`
there would misrepresent it.

---

## 5. Storage

In-memory, parked on `globalThis` to survive Next's hot reload:

```ts
const globalStore = globalThis as unknown as { __watchtower?: Tables }
```

Every operation goes through plain functions in `lib/store.ts`, so swapping to
Postgres touches one file. `db/schema.sql` is written and ready to paste into
Supabase.

**This is a deliberate 24-hour trade.** State resets on server restart — which
is also a convenient way to clear a dirty board before a demo.

---

## 6. Frontend

Next.js 16 (App Router, Turbopack), React 19, TypeScript. npm workspaces:
`apps/web`, `packages/ui`.

| Screen | Route |
|---|---|
| Org Map | `/` |
| Registration | `/register` |
| Deception Console | `/deception` |
| Telemetry | `/telemetry` |
| Threat Timeline | `/incidents/[id]` |
| Incident Report | `/incidents/[id]/report` |
| Architecture & Scope | `/scope` |
| Attacker props | `/portal/login`, `/share/[trackingId]` |

**Polling, not realtime.** 2-second interval. Supabase realtime fails
*silently* when the publication or RLS policy is missing — a demo that appears
to work until it doesn't. Polling is boring and observable.

**Timezone.** Clocks render in the viewer's zone via `useClock()`, which
returns UTC formatters until after mount and local ones thereafter — locale
formatting during SSR would hydrate mismatched. Server-rendered strings (AI
prompts, report bodies) stay UTC, since the server's zone is a datacentre's.

**Responsive** 320px → 2560px. The board reflows rather than rescales: side
rails stack below 1180px, tables become cards below 620px, and shell width and
type scale up together above 1600px.

---

## 7. What is not built

Stated plainly, and visible in-product on `/scope`.

**Absent:**
- Cloud deception (M365, Google Workspace, AWS) — no code
- Behavioural analytics — thresholds and a static allowlist, not analytics
- Attack attribution — removed on purpose; see §4
- Persistent storage — schema ready, not wired
- Operator authentication on the dashboard
- Real agent-based decoy placement (a path is recorded; nothing writes to a
  real host)

**Simplified:**
- One organisation per instance
- SIEM field mapping unconfirmed (delivery is verified)

---

## 8. Evaluation summary

| Metric | Where it stands |
|---|---|
| **Detection speed** | Measured per incident, sub-millisecond, displayed |
| **False positives** | Structural — access/use split, not tuning |
| **Threat attribution** | Action attributed (MITRE, source, sequence); actor deliberately not |
| **Automation quality** | Scoped by design, with the reasoning written down |
| **Explainability** | Every tag and severity traces to one readable line |
| **Scalability** | Store abstracted behind one module; Postgres schema ready |

---

## 9. Running it

```bash
npm install
npm run dev -w apps/web        # http://localhost:3000
```

`apps/web/.env.local` (see `.env.local.example`):

```
GROQ_API_KEY=...               # optional — falls back to curated decoys
GROQ_MODEL=openai/gpt-oss-120b # optional
AI_PROVIDER=groq|anthropic|fallback
SIEM_WEBHOOK_URL=...           # optional
```

The platform runs with no keys at all: decoy generation falls back to curated
content and the UI says so.

**Demo path:** `/register` → `/deception` → `/portal/login` (submit a planted
credential twice) → `/incidents` → report.
