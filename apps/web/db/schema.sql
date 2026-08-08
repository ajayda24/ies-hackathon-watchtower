-- Watchtower schema. Paste into the Supabase SQL editor when the project exists.
-- Field names match apps/web/lib/types.ts exactly.

create extension if not exists "pgcrypto";

create table if not exists departments (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  registration_token text not null unique,
  security_level     text not null default 'secure'
                       check (security_level in ('secure','warning','critical')),
  created_at         timestamptz not null default now()
);

create table if not exists honeytokens (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  type          text not null
                  check (type in ('credential','document','api_key','source_code_secret')),
  name          text not null,
  content       text not null,
  location      text not null,
  tracking_id   text not null unique,
  ai_generated  boolean not null default false,
  status        text not null default 'active'
                  check (status in ('active','triggered','revoked')),
  created_at    timestamptz not null default now()
);

-- event_type is the access-vs-use distinction: 'access' is logged but never
-- escalates; 'use' means decoy content was actually used and drives incidents.
create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  token_id      uuid not null references honeytokens(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  event_type    text not null check (event_type in ('access','use')),
  source_ip     text not null,
  mitre_id      text not null,
  mitre_name    text not null,
  timestamp     timestamptz not null default now(),
  raw_details   jsonb not null default '{}'::jsonb
);

-- No attribution columns by design. The evidence supports a source address and
-- an ordered sequence of actions; it does not identify a person, an
-- organisation or a country. A stored profile or confidence score would imply
-- something computed one. The plain-English summary is derived on read.
create table if not exists incidents (
  id                     uuid primary key default gen_random_uuid(),
  department_id          uuid not null references departments(id) on delete cascade,
  source_ip              text not null,
  severity               text not null default 'medium'
                           check (severity in ('low','medium','high','critical')),
  status                 text not null default 'open'
                           check (status in ('open','contained','closed')),
  -- Trigger-to-containment milliseconds. Null until containment fires: an
  -- incident below the threshold has nothing to measure, and 0 would read as
  -- an instant response rather than an absent one. Sub-millisecond values are
  -- real, so this is double precision rather than an integer.
  containment_latency_ms double precision,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists incident_events (
  incident_id uuid not null references incidents(id) on delete cascade,
  event_id    uuid not null references events(id) on delete cascade,
  primary key (incident_id, event_id)
);

create table if not exists containment_actions (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  action      text not null
                check (action in ('CREDENTIAL_REVOKED','SESSION_ISOLATED','ALERT_ESCALATED')),
  automated   boolean not null default true,
  timestamp   timestamptz not null default now(),
  details     text not null default ''
);

-- Correlation looks up open incidents by (source_ip, department_id) and counts
-- recent 'use' events per source_ip; these two indexes cover both hot paths.
-- Correlation joins a trigger to any incident that is not closed, so the
-- partial predicate has to match that rather than status = 'open': a contained
-- incident is still the one further activity from the same source belongs to.
create index if not exists idx_incidents_active
  on incidents (department_id, source_ip, created_at desc)
  where status <> 'closed';
create index if not exists idx_events_ip_time
  on events (source_ip, timestamp desc);
create index if not exists idx_events_dept_time
  on events (department_id, timestamp desc);

-- Realtime is NOT required. The dashboard polls every 2 seconds, deliberately:
-- Supabase realtime fails silently when a publication or RLS policy is missing,
-- which produces a dashboard that looks connected and never updates. Polling is
-- boring and observable.
--
-- Enable it only if you want it, and note `add table` errors if the table is
-- already a member, so this block is guarded:
do $$
begin
  alter publication supabase_realtime add table events;
exception when duplicate_object then null;
end $$;

-- Row Level Security: these tables are reached only through server-side routes
-- holding the service role key, which bypasses RLS. Enabling RLS with no policy
-- therefore blocks the anon key (correct — nothing should read these from a
-- browser) while leaving the server free.
alter table departments         enable row level security;
alter table honeytokens         enable row level security;
alter table events              enable row level security;
alter table incidents           enable row level security;
alter table incident_events     enable row level security;
alter table containment_actions enable row level security;
