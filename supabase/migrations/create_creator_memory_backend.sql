-- Real creator memory backend for Viralynz.
-- Active plans: free, starter, pro, lifetime.
-- Legacy aliases may exist in old rows, but new application code writes only active plans.

create extension if not exists vector with schema extensions;

create table if not exists public.creator_memory_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  plan text not null default 'free',
  memory_tier text not null default 'locked',
  memory_score int not null default 0,
  analyses_learned int not null default 0,
  active_facts_count int not null default 0,
  creator_style_summary text,
  hook_style_summary text,
  common_mistakes_summary text,
  strongest_formats_summary text,
  weak_patterns_summary text,
  v2_opportunities_summary text,
  last_learned_at timestamptz,
  last_consolidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_memory_profiles add column if not exists id uuid default gen_random_uuid();
alter table public.creator_memory_profiles add column if not exists memory_tier text not null default 'locked';
alter table public.creator_memory_profiles add column if not exists memory_score int not null default 0;
alter table public.creator_memory_profiles add column if not exists analyses_learned int not null default 0;
alter table public.creator_memory_profiles add column if not exists active_facts_count int not null default 0;
alter table public.creator_memory_profiles add column if not exists creator_style_summary text;
alter table public.creator_memory_profiles add column if not exists hook_style_summary text;
alter table public.creator_memory_profiles add column if not exists common_mistakes_summary text;
alter table public.creator_memory_profiles add column if not exists strongest_formats_summary text;
alter table public.creator_memory_profiles add column if not exists weak_patterns_summary text;
alter table public.creator_memory_profiles add column if not exists v2_opportunities_summary text;
alter table public.creator_memory_profiles add column if not exists last_learned_at timestamptz;
alter table public.creator_memory_profiles add column if not exists last_consolidated_at timestamptz;

update public.creator_memory_profiles
set id = gen_random_uuid()
where id is null;

alter table public.creator_memory_profiles alter column id set not null;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.creator_memory_profiles'::regclass
      and contype = 'p'
  ) then
    create unique index if not exists creator_memory_profiles_id_key on public.creator_memory_profiles(id);
  end if;
end;
$$;

alter table public.creator_memory_profiles drop constraint if exists creator_memory_profiles_plan_check;
alter table public.creator_memory_profiles add constraint creator_memory_profiles_plan_check
  check (plan in ('free', 'starter', 'pro', 'lifetime', 'creator', 'scale'));

alter table public.creator_memory_profiles drop constraint if exists creator_memory_profiles_memory_tier_check;
alter table public.creator_memory_profiles add constraint creator_memory_profiles_memory_tier_check
  check (memory_tier in ('locked', 'essential', 'extended', 'permanent'));

alter table public.creator_memory_profiles drop constraint if exists creator_memory_profiles_memory_score_check;
alter table public.creator_memory_profiles add constraint creator_memory_profiles_memory_score_check
  check (memory_score >= 0 and memory_score <= 100);

create table if not exists public.creator_memory_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  source_video_id text,
  type text not null,
  title text not null,
  content text not null,
  evidence text,
  confidence_score int not null default 50,
  importance_score int not null default 50,
  occurrence_count int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_memory_facts_type_check check (type in ('hook', 'mistake', 'format', 'cta', 'retention', 'v2', 'style', 'structure', 'audience', 'risk')),
  constraint creator_memory_facts_status_check check (status in ('active', 'archived', 'consolidated', 'ignored')),
  constraint creator_memory_facts_confidence_check check (confidence_score >= 0 and confidence_score <= 100),
  constraint creator_memory_facts_importance_check check (importance_score >= 0 and importance_score <= 100),
  constraint creator_memory_facts_occurrence_check check (occurrence_count >= 1)
);

create table if not exists public.creator_memory_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  memory_fact_id uuid not null references public.creator_memory_facts(id) on delete cascade,
  embedding extensions.vector(1536),
  embedding_model text,
  created_at timestamptz not null default now()
);

create table if not exists public.creator_memory_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan text not null,
  snapshot_type text not null,
  title text not null,
  summary text not null,
  patterns jsonb not null default '{}'::jsonb,
  facts_included int not null default 0,
  created_at timestamptz not null default now(),
  constraint creator_memory_snapshots_plan_check check (plan in ('free', 'starter', 'pro', 'lifetime', 'creator', 'scale')),
  constraint creator_memory_snapshots_type_check check (snapshot_type in ('weekly', 'monthly', 'consolidation', 'milestone'))
);

create table if not exists public.creator_memory_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  status text not null default 'pending',
  job_type text not null,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint creator_memory_jobs_status_check check (status in ('pending', 'running', 'success', 'failed')),
  constraint creator_memory_jobs_type_check check (job_type in ('learn_from_analysis', 'consolidate', 'rebuild_profile'))
);

create table if not exists public.creator_memory_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan text not null,
  operation text not null,
  model text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  estimated_cost_usd numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint creator_memory_usage_plan_check check (plan in ('free', 'starter', 'pro', 'lifetime', 'creator', 'scale')),
  constraint creator_memory_usage_operation_check check (operation in ('extraction', 'embedding', 'retrieval', 'consolidation'))
);

create index if not exists creator_memory_facts_user_type_status_idx on public.creator_memory_facts(user_id, type, status);
create index if not exists creator_memory_facts_user_importance_idx on public.creator_memory_facts(user_id, importance_score desc);
create index if not exists creator_memory_facts_user_last_seen_idx on public.creator_memory_facts(user_id, last_seen_at desc);
create index if not exists creator_memory_facts_analysis_idx on public.creator_memory_facts(analysis_id);
create index if not exists creator_memory_embeddings_user_idx on public.creator_memory_embeddings(user_id);
create index if not exists creator_memory_embeddings_fact_idx on public.creator_memory_embeddings(memory_fact_id);
create index if not exists creator_memory_snapshots_user_created_idx on public.creator_memory_snapshots(user_id, created_at desc);
create index if not exists creator_memory_jobs_status_created_idx on public.creator_memory_jobs(status, created_at);
create index if not exists creator_memory_jobs_user_idx on public.creator_memory_jobs(user_id);
create index if not exists creator_memory_jobs_analysis_idx on public.creator_memory_jobs(analysis_id);
create index if not exists creator_memory_usage_user_created_idx on public.creator_memory_usage(user_id, created_at);

create or replace function public.set_creator_memory_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_creator_memory_profiles_updated_at on public.creator_memory_profiles;
create trigger set_creator_memory_profiles_updated_at
  before update on public.creator_memory_profiles
  for each row
  execute function public.set_creator_memory_updated_at();

drop trigger if exists set_creator_memory_facts_updated_at on public.creator_memory_facts;
create trigger set_creator_memory_facts_updated_at
  before update on public.creator_memory_facts
  for each row
  execute function public.set_creator_memory_updated_at();

alter table public.creator_memory_profiles enable row level security;
alter table public.creator_memory_facts enable row level security;
alter table public.creator_memory_embeddings enable row level security;
alter table public.creator_memory_snapshots enable row level security;
alter table public.creator_memory_jobs enable row level security;
alter table public.creator_memory_usage enable row level security;

drop policy if exists "Users can read own memory profiles" on public.creator_memory_profiles;
create policy "Users can read own memory profiles" on public.creator_memory_profiles
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read own memory facts" on public.creator_memory_facts;
create policy "Users can read own memory facts" on public.creator_memory_facts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read own memory embeddings" on public.creator_memory_embeddings;
create policy "Users can read own memory embeddings" on public.creator_memory_embeddings
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read own memory snapshots" on public.creator_memory_snapshots;
create policy "Users can read own memory snapshots" on public.creator_memory_snapshots
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read own memory jobs" on public.creator_memory_jobs;
create policy "Users can read own memory jobs" on public.creator_memory_jobs
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can read own memory usage" on public.creator_memory_usage;
create policy "Users can read own memory usage" on public.creator_memory_usage
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Service role full access memory profiles" on public.creator_memory_profiles;
create policy "Service role full access memory profiles" on public.creator_memory_profiles
  for all to service_role using (true) with check (true);

drop policy if exists "Service role full access memory facts" on public.creator_memory_facts;
create policy "Service role full access memory facts" on public.creator_memory_facts
  for all to service_role using (true) with check (true);

drop policy if exists "Service role full access memory embeddings" on public.creator_memory_embeddings;
create policy "Service role full access memory embeddings" on public.creator_memory_embeddings
  for all to service_role using (true) with check (true);

drop policy if exists "Service role full access memory snapshots" on public.creator_memory_snapshots;
create policy "Service role full access memory snapshots" on public.creator_memory_snapshots
  for all to service_role using (true) with check (true);

drop policy if exists "Service role full access memory jobs" on public.creator_memory_jobs;
create policy "Service role full access memory jobs" on public.creator_memory_jobs
  for all to service_role using (true) with check (true);

drop policy if exists "Service role full access memory usage" on public.creator_memory_usage;
create policy "Service role full access memory usage" on public.creator_memory_usage
  for all to service_role using (true) with check (true);

revoke all on function public.set_creator_memory_updated_at() from public, anon, authenticated;
grant execute on function public.set_creator_memory_updated_at() to service_role;
