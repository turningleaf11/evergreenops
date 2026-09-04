create table if not exists public.property_enrichment_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_id uuid not null references public.ema_candidates(id) on delete cascade,
  ghl_opportunity_id text,
  provider text not null,
  provider_property_id text not null,
  normalized_address text not null,
  facts jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  credits_used integer not null default 0,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint property_enrichment_snapshots_provider_check check (provider = 'dealmachine'),
  constraint property_enrichment_snapshots_facts_object_check check (jsonb_typeof(facts) = 'object'),
  constraint property_enrichment_snapshots_provenance_object_check check (jsonb_typeof(provenance) = 'object'),
  constraint property_enrichment_snapshots_credits_check check (credits_used >= 0)
);

create index if not exists property_enrichment_snapshots_candidate_lookup_idx
  on public.property_enrichment_snapshots (workspace_id, candidate_id, provider, fetched_at desc);

create index if not exists property_enrichment_snapshots_provider_property_idx
  on public.property_enrichment_snapshots (workspace_id, provider, provider_property_id, fetched_at desc);

create index if not exists property_enrichment_snapshots_opportunity_idx
  on public.property_enrichment_snapshots (workspace_id, ghl_opportunity_id, fetched_at desc)
  where ghl_opportunity_id is not null;

alter table public.property_enrichment_snapshots enable row level security;

create policy "Workspace admins can view property enrichment snapshots"
  on public.property_enrichment_snapshots
  for select
  to authenticated
  using (
    has_role(auth.uid(), 'admin'::app_role)
    and workspace_id in (
      select p.workspace_id
      from public.profiles p
      where p.user_id = auth.uid()
    )
  );

comment on table public.property_enrichment_snapshots is
  'Source-backed provider snapshots for property enrichment. Agent Gateway service-role writes; authenticated workspace admins may read their workspace snapshots.';
comment on column public.property_enrichment_snapshots.facts is
  'Sanitized property-only facts returned by the named provider. Do not store provider credentials, Authorization headers, or people/contact enrichment here.';
comment on column public.property_enrichment_snapshots.provenance is
  'Provider request IDs, field catalog/version metadata, cache/source metadata, and other non-secret provenance.';;
