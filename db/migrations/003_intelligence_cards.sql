-- Phase 3 Intelligence Cards Migration
-- Run against Supabase SQL editor.
-- v2 upgrade path: replace current_setting with auth.jwt()->>'tenant_id' for JWT-based multi-tenant auth.

-- 1. answer_cards table
create table if not exists public.answer_cards (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  topic_key text not null,
  question_text text not null,
  terse_answer text not null,
  full_answer text not null,
  source_ref text not null default '',
  card_type text not null check (card_type in ('listing', 'rag', 'stats')),
  fired_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2. Indexes
create index if not exists answer_cards_session_id_idx on public.answer_cards (session_id);
create index if not exists answer_cards_session_topic_idx on public.answer_cards (session_id, topic_key);
create index if not exists answer_cards_tenant_id_idx on public.answer_cards (tenant_id);

-- 3. Enable RLS
alter table public.answer_cards enable row level security;

-- 4. RLS policy (tenant isolation — same pattern as Phase 2)
create policy tenant_isolation on public.answer_cards
  using (tenant_id = current_setting('app.tenant_id')::uuid);

-- IMPORTANT: After running this migration, enable Realtime on answer_cards in Supabase Dashboard:
-- Database -> Replication -> Tables -> answer_cards -> toggle ON
-- Without this, postgres_changes events will not fire for browser clients.
-- Alternatively, run:
--   alter publication supabase_realtime add table public.answer_cards;
-- (requires superuser privileges not available in Supabase managed SQL editor)
