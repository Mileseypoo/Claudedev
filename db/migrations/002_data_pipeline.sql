-- Phase 2 Data Pipeline Migration
-- Run against Supabase SQL editor.
-- v2 upgrade path: replace current_setting with auth.jwt()->>'tenant_id' for JWT-based multi-tenant auth.

-- 1. Enable pgvector
create extension if not exists vector with schema extensions;

-- 2. uploads table
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  filename text not null,
  file_type text not null check (file_type in ('csv', 'pdf')),
  storage_path text,
  status text not null default 'processing' check (status in ('processing', 'indexed', 'error')),
  error_message text,
  row_count integer,
  chunk_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uploads_tenant_id_idx on public.uploads (tenant_id);
create index if not exists uploads_tenant_status_idx on public.uploads (tenant_id, status);

-- 3. listings table
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  property_id text not null,
  address text not null,
  area text not null,
  price_aed numeric(14,2) not null,
  bedrooms integer not null,
  bathrooms integer not null,
  size_sqft numeric(10,2) not null,
  status text not null check (status in ('available', 'sold', 'reserved')),
  developer text not null,
  community text not null,
  property_type text not null,
  sold_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_tenant_property_unique unique (tenant_id, property_id)
);

create index if not exists listings_tenant_id_idx on public.listings (tenant_id);
create index if not exists listings_tenant_status_idx on public.listings (tenant_id, status);
create index if not exists listings_tenant_area_idx on public.listings (tenant_id, area);

-- 4. document_chunks table
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_tenant_id_idx on public.document_chunks (tenant_id);
create index if not exists document_chunks_hnsw_idx on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- 5. listing_stats table
create table if not exists public.listing_stats (
  tenant_id uuid primary key references public.tenants(id),
  stats jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- 6. Enable RLS on all tables
alter table public.uploads enable row level security;
alter table public.listings enable row level security;
alter table public.document_chunks enable row level security;
alter table public.listing_stats enable row level security;

-- 7. RLS policies (tenant isolation)
create policy tenant_isolation on public.uploads
  using (tenant_id = current_setting('app.tenant_id')::uuid);

create policy tenant_isolation on public.listings
  using (tenant_id = current_setting('app.tenant_id')::uuid);

create policy tenant_isolation on public.document_chunks
  using (tenant_id = current_setting('app.tenant_id')::uuid);

create policy tenant_isolation on public.listing_stats
  using (tenant_id = current_setting('app.tenant_id')::uuid);

-- 8. match_document_chunks function (for Phase 3 similarity search)
create or replace function public.match_document_chunks(
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int,
  p_tenant_id uuid
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.upload_id as document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.tenant_id = p_tenant_id
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding asc
  limit match_count;
$$;

-- 9. recalculate_listing_stats function
create or replace function public.recalculate_listing_stats(p_tenant_id uuid)
returns void
language plpgsql
as $$
declare
  v_stats jsonb;
begin
  select jsonb_build_object(
    'total_listings', count(*),
    'count_by_status', jsonb_build_object(
      'available', count(*) filter (where status = 'available'),
      'sold', count(*) filter (where status = 'sold'),
      'reserved', count(*) filter (where status = 'reserved')
    ),
    'avg_price_by_bedrooms', (
      select jsonb_object_agg(bedrooms::text, avg_price)
      from (
        select bedrooms, round(avg(price_aed)::numeric, 2) as avg_price
        from public.listings
        where tenant_id = p_tenant_id
        group by bedrooms
      ) sub
    ),
    'price_range_by_area', (
      select jsonb_object_agg(area, jsonb_build_object('min', min_price, 'max', max_price, 'median', median_price))
      from (
        select
          area,
          min(price_aed) as min_price,
          max(price_aed) as max_price,
          percentile_cont(0.5) within group (order by price_aed)::numeric(14,2) as median_price
        from public.listings
        where tenant_id = p_tenant_id
        group by area
      ) sub
    ),
    'recently_sold_count', count(*) filter (
      where status = 'sold' and sold_date >= current_date - interval '30 days'
    ),
    'calculated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )
  into v_stats
  from public.listings
  where tenant_id = p_tenant_id;

  insert into public.listing_stats (tenant_id, stats, updated_at)
  values (p_tenant_id, coalesce(v_stats, '{}'), now())
  on conflict (tenant_id) do update
    set stats = excluded.stats,
        updated_at = excluded.updated_at;
end;
$$;
