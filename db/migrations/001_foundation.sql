-- Run against Supabase SQL editor or via supabase db push
-- v2 upgrade path: replace current_setting('app.tenant_id') with auth.jwt()->>'tenant_id'
-- for multi-tenant auth once JWT-based authentication is added.

-- Enable RLS helper
create extension if not exists "pgcrypto";

-- Tenants table (even POC gets one row)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_color text not null default '#1a1a2e',
  created_at timestamptz not null default now()
);

-- Sessions table
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  agent_id uuid,                       -- null for PLAT-02 single-tenant POC
  status text not null default 'active'
    check (status in ('active', 'paused', 'ended', 'recovered')),
  consent_confirmed_at timestamptz not null,
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_tenant_id_idx on public.sessions(tenant_id);
create index sessions_status_idx on public.sessions(status) where status != 'ended';

-- Transcript chunks (incremental saves, enables SESS-06 crash recovery)
create table public.transcript_chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  sequence integer not null,           -- ordering within session
  text text not null,
  start_seconds numeric(10,3) not null, -- Deepgram result.start
  duration_seconds numeric(10,3),
  is_final boolean not null default true,
  created_at timestamptz not null default now()
);

create index transcript_chunks_session_idx on public.transcript_chunks(session_id, sequence);
create index transcript_chunks_tenant_idx on public.transcript_chunks(tenant_id);

-- RLS policies
alter table public.sessions enable row level security;
alter table public.transcript_chunks enable row level security;

-- POC policy: all access for the hardcoded tenant
-- v2: replace with auth.jwt()->>'tenant_id' claim check
create policy "tenant_isolation_sessions"
  on public.sessions
  using (tenant_id = current_setting('app.tenant_id')::uuid);

create policy "tenant_isolation_chunks"
  on public.transcript_chunks
  using (tenant_id = current_setting('app.tenant_id')::uuid);

-- Seed: insert default POC tenant (run once after migration)
-- insert into public.tenants (id, name, brand_color)
-- values ('00000000-0000-0000-0000-000000000001', 'Dubai Estate Agency POC', '#1a1a2e')
-- on conflict (id) do nothing;
