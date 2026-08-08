# Gamma prompt — Neurobots Round 2 deck

Paste everything between the rules into Gamma. Before you do, replace the four
`[BRACKETED]` fields on Slide 1 and the repo URL on Slide 5.

Recommended Gamma settings: **8 cards**, text density **Detailed**, theme
**dark** (the product is a dark security console — a light deck fights the
screenshots).

---

Create an 8-slide technical presentation for a national hackathon Round 2
judging panel. Audience: cybersecurity and software engineering judges who will
ask hard questions. Tone: precise, confident, evidence-led. No marketing
adjectives, no "revolutionary", no emoji. Every claim must sound like it can be
demonstrated on request, because it can.

Visual direction: dark technical console aesthetic — near-black background,
one steel-blue accent, status colours only where they mean something (teal =
secure, amber = warning, red = critical). Monospace for machine values
(timestamps, IDs, latencies), condensed sans for headings. Think mission
control, not startup pitch.

Use exactly these 8 slides with this content.

---

**SLIDE 1 — Team Introduction**

Title: Watchtower — Autonomous Deception Intelligence Platform

- Team Name: **[TEAM NAME]**
- Domain: Cybersecurity — Active Defence & Threat Detection
- Team Members: **[MEMBER 1, MEMBER 2, MEMBER 3, MEMBER 4]**
- College: **[COLLEGE NAME]**

One-line positioning under the details:
"Detection that does not depend on knowing the attack."

---

**SLIDE 2 — Problem Statement**

Headline: Attackers are already inside, and static defences cannot see them.

Content:
- Intruders dwell inside networks for weeks after the initial compromise,
  moving laterally to find valuable assets. The perimeter has already failed by
  the time damage occurs.
- Signature and anomaly tools detect what they have seen before. They are blind
  to novel intrusions and to insider threats, where the person already holds
  valid credentials and their behaviour looks normal.
- The deeper failure is alert fatigue: tools that flag ambiguous activity
  generate so much noise that teams stop reading the alerts. A detection system
  that is ignored has a real-world accuracy of zero.

Target users:
Small and mid-sized institutions with real data and no security operations
centre — colleges, clinics, local government, mid-market firms. They cannot
staff a 24/7 SOC and cannot afford enterprise deception platforms.

Closing line: The question is not "can we block them at the door" — it is
"how do we know, with certainty, when someone is already walking the halls."

---

**SLIDE 3 — Proposed Solution**

Headline: Plant assets nobody has a reason to touch. Then watch who touches
them.

Explain: Watchtower plants AI-generated decoys — credentials, documents, API
keys, source-code secrets — across an organisation's departments. Each decoy is
believable and contextual, but connects to nothing real. Any interaction with
one is, by construction, a signal.

Key features, as a list:
- AI-generated decoys contextual to each department, so they are worth taking
- Access vs. use classification — the false-positive defence
- Correlation into incidents with a severity ladder
- Automated containment scoped to the decoy itself
- MITRE ATT&CK mapping on every event
- AI-written incident report, print-ready

**The core innovation — present this as a two-row comparison table:**

| Signal | What it means | Innocent explanation | Our response |
|---|---|---|---|
| **ACCESS** | The decoy was read | Backup jobs, search indexers, curious staff | Logged. Never escalates. |
| **USE** | Its contents were submitted somewhere | **None** | Opens an incident immediately. |

Explain underneath: A backup job reads every file on a share every night. None
of them submits a password to a login form. That asymmetry is why we can claim
near-zero false positives structurally, rather than by tuning thresholds.

What makes it unique:
- No signature, no baseline, no training data. Works against a zero-day exactly
  as well as against a known tool, because the trigger is not "this looks
  malicious" — it is "you touched something that exists only to be touched by
  an intruder."
- There is no confidence score anywhere in the system, and that is deliberate.
  A decoy has no legitimate use, so there is nothing to be uncertain about.

---

**SLIDE 4 — Technical Architecture**

Include a flow diagram, top to bottom, with two entry points merging into one:

```
        ATTACKER
            |
    +-------+-------+
    |               |
opens decoy    submits decoy
 document       credential
    |               |
GET /api/track  POST /api/decoy/login
(tracking pixel) (mock portal, always 401)
    |               |
    +-------+-------+
            v
    recordTrigger()   <- single entry point
            |
    +-------+-------+
    |               |
 ACCESS          USE
 log only    severity ladder
 no alert    1=medium 2=high 3+=critical
                    |
            triggerContainment()
            revoke decoy - raise alert - stamp latency
                    |
        +-----------+-----------+
        v           v           v
    Dashboards   AI report   SIEM payload
    (2s poll)               (ECS-shaped)
```

Caption the diagram: Both detection surfaces funnel into one function, so the
access/use rule cannot be bypassed by adding a new decoy type later.

Technology stack:
- Frontend / Backend: Next.js 16 (App Router, Turbopack), React 19, TypeScript
- AI: Groq — openai/gpt-oss-120b, behind a provider interface with curated
  fallbacks
- Data: In-memory store for the demo; PostgreSQL schema written and ready
- Integration: ECS-shaped JSON payload over HTTP to any SIEM/SOAR webhook
- No hardware components — this is a pure software platform

AI models — three distinct calls:
1. Decoy generation — department-contextual names, paths and content
2. Attribution narrative — plain-English summary of an incident, on demand
3. Incident report — formal document, print-ready

State this constraint explicitly as a bullet: Every prompt carries only facts
already stored by the platform. The model's job is structure and plain
language, never inference about who the attacker was. If the AI provider fails,
the system falls back to curated content and the interface says so — a dead API
key degrades the demo, it does not break it.

---

**SLIDE 5 — Current Progress**

Headline: Built and running, not a mockup.

GitHub: **[REPO URL]**

Proof-of-work figures, presented as stat tiles:
- 8 UI screens, all functional
- 10 API routes
- ~6,175 lines of TypeScript
- 11 commits with descriptive history
- 3 live AI calls in production use
- Responsive 320px to 2560px

What is verified working, as a checklist:
- Department registration plants AI decoys in about 1.6 seconds
- Decoy use opens an incident and fires containment automatically, with the
  elapsed time measured per incident and displayed in the interface rather
  than asserted
- SIEM forwarding delivers to a live HTTP receiver — 200 OK, valid JSON, all
  five ECS fields an indexer keys on
- Incident reports generate in 2 to 3 seconds
- MITRE ATT&CK technique mapped on every single event

Screens to show as thumbnails, labelled:
Org Map, Deception Console, Telemetry Stream, Threat Timeline, Incident Report,
Architecture and Scope

Add this line at the bottom: Full design rationale is documented in
ARCHITECTURE.md in the repository.

---

**SLIDE 6 — Live Demo**

Headline: Five steps, ninety seconds.

Present as a numbered walkthrough:
1. Register a department — AI generates and plants decoys live on stage
2. Open the Deception Console — generate a decoy and read what the model wrote
3. Switch to the attacker's view — submit a planted credential twice
4. Return to the dashboard — the zone has turned red and an incident is open
5. Generate the incident report — AI writes it in about 2 seconds

Call out the moment that matters, in a highlighted box:
During step 3 the attacker's screen shows only "Invalid username or password" —
the same response a wrong password gives. They learn nothing. Meanwhile the
dashboard has already opened an incident, revoked the credential and alerted an
operator. That contrast, both windows visible at once, is the demonstration.

Add: Every number shown on screen during the demo is measured at runtime.
Nothing is hardcoded.

---

**SLIDE 7 — Challenges & Next Plan**

Headline: What we know is missing.

Challenges solved, as a short list:
- False positives — solved structurally with the access/use split rather than
  by threshold tuning
- Containment safety — an early design blocked source IP addresses. We removed
  it. Institutions sit behind shared NAT, so a wrong block takes real systems
  offline, while revoking a credential that was never real cannot hurt
  anything. We automate only the actions that are safe to be wrong about.
- Honest scoping — we removed an attribution scoring feature during development
  because the fields were never actually computed. A confidence score we
  cannot defend is worth less than admitting we do not have one.

Not built yet, stated plainly:
- Persistent storage — PostgreSQL schema written, not yet wired
- Cloud decoys for Microsoft 365 and Google Workspace
- Behavioural analytics beyond time-window thresholds
- Operator authentication on the dashboard
- SIEM field mapping confirmed against a live Splunk or Sentinel instance
  (delivery is verified; index-time mapping is not)

Plan before the final round, in priority order:
1. Wire PostgreSQL persistence so incidents survive a restart
2. Add operator authentication
3. Cloud decoy support for at least one provider
4. Confirm SIEM field mapping against a real indexer

Close with: The platform carries a Scope screen that states exactly this,
in-product. We would rather show a judge where the edges are than have them
find one.

---

**SLIDE 8 — Impact**

Headline: Detection that small institutions can actually afford to run.

Expected users:
Colleges, hospitals and clinics, local government offices, mid-market firms —
organisations holding genuinely sensitive records with no dedicated security
team.

Scalability:
- Decoys are data, not agents. Planting more costs storage, not compute, and
  detection cost does not rise with the number of decoys deployed.
- All data access sits behind a single module, so the move from in-memory to
  PostgreSQL touches one file.
- Multi-tenant by design at the schema level — departments already isolate
  cleanly.

Impact:
- A detection layer that needs no security analyst to interpret it. The incident
  report is written in plain English and is ready to forward to a dean or a
  hospital administrator.
- Near-zero false positives means alerts stay meaningful, which is what
  determines whether a small team keeps reading them.
- Catches insider threats, which credential-based tools structurally cannot —
  an insider with valid credentials still has no reason to use a decoy.

Future scope:
- Adaptive decoys that regenerate as an organisation's naming conventions
  change
- Multi-cloud deception across AWS, Azure and Google Cloud
- Decoy placement agents that write to real file shares
- Cross-organisation threat intelligence sharing between institutions

Closing line for the deck: A decoy has no legitimate use. That single property
is the entire product, and it is why this works against attacks nobody has seen
before.
