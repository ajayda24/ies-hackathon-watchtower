# Watchtower

**Autonomous Deception Intelligence Platform**

Plants AI-generated decoy credentials, documents, API keys and source secrets
across an organisation. Any interaction with one is, by construction, a signal —
nobody has a legitimate reason to use a decoy. Watchtower detects that
interaction, correlates it into an incident, maps it to MITRE ATT&CK, and
contains what is safe to contain automatically.

> Built for a 24-hour hackathon. See [ARCHITECTURE.md](./ARCHITECTURE.md) for
> the full design, and the in-product `/scope` screen for exactly what is real,
> what is simplified, and what is not built.

## The idea in one table

| | Meaning | Innocent explanation | Response |
|---|---|---|---|
| **`access`** | The decoy was read | Backup jobs, indexers, curious staff | Logged. Never escalates. |
| **`use`** | Its contents were submitted somewhere | **None** | Opens an incident. |

That split is the false-positive defence. A backup job reads every file on a
share all night; none of them submits a password to a login form.

## Running it

```bash
npm install
npm run dev -w apps/web        # http://localhost:3000
```

Optional keys in `apps/web/.env.local` — copy from `.env.local.example`. The
platform runs with none: decoy generation serves curated content and the UI
says so.

## Demo path

1. `/register` — create a department; starter decoys are generated and planted
2. `/deception` — generate and deploy a decoy
3. `/portal/login` — as the attacker, submit a planted credential **twice**
4. `/incidents` — watch the zone flip and the incident open
5. `/incidents/[id]/report` — generate the report

Keep the attacker window visible during step 3. It shows nothing but
`Invalid username or password` while the dashboard lights up — that contrast is
the point.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · npm workspaces ·
Groq (`openai/gpt-oss-120b`) behind a provider interface with curated
fallbacks.
