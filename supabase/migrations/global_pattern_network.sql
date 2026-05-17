create table if not exists public.global_pattern_cohorts (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null unique,
  niche text,
  format_type text,
  hook_type text,
  cta_type text,
  style_type text,
  sample_size integer not null default 0,
  avg_hook_score integer not null default 0 check (avg_hook_score between 0 and 100),
  avg_retention_score integer not null default 0 check (avg_retention_score between 0 and 100),
  avg_cta_score integer not null default 0 check (avg_cta_score between 0 and 100),
  avg_repost_score integer not null default 0 check (avg_repost_score between 0 and 100),
  confidence numeric(4, 3) not null default 0.5,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists global_pattern_cohorts_lookup_idx
  on public.global_pattern_cohorts (niche, format_type, hook_type, confidence desc);

create table if not exists public.global_pattern_observations (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null references public.global_pattern_cohorts(cohort_key) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  anonymized_user_hash text,
  pattern_type text not null check (pattern_type in ('hook', 'structure', 'cta', 'retention', 'weakness', 'risk')),
  signal_json jsonb not null default '{}'::jsonb,
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  confidence integer not null default 0 check (confidence between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists global_pattern_observations_cohort_created_idx
  on public.global_pattern_observations (cohort_key, created_at desc);

create table if not exists public.anonymous_benchmark_network (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null references public.global_pattern_cohorts(cohort_key) on delete cascade,
  compare_on text not null check (compare_on in ('hooks', 'structures', 'cta', 'rhythm', 'intro', 'payoff')),
  benchmark_json jsonb not null default '{}'::jsonb,
  privacy_level text not null default 'anonymous_aggregate',
  confidence integer not null default 0 check (confidence between 0 and 100),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (cohort_key, compare_on)
);

create table if not exists public.community_pattern_signals (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null references public.global_pattern_cohorts(cohort_key) on delete cascade,
  title text not null,
  body text not null,
  trend text not null default 'learning' check (trend in ('rising', 'stable', 'learning')),
  confidence integer not null default 0 check (confidence between 0 and 100),
  source_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists community_pattern_signals_trend_idx
  on public.community_pattern_signals (trend, confidence desc, updated_at desc);

create table if not exists public.public_creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null unique,
  enabled boolean not null default false,
  headline text,
  badges jsonb not null default '[]'::jsonb,
  creator_dna jsonb not null default '{}'::jsonb,
  repost_transformations jsonb not null default '[]'::jsonb,
  progression_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_creator_profiles_user_idx
  on public.public_creator_profiles (user_id, enabled);

alter table public.global_pattern_cohorts enable row level security;
alter table public.global_pattern_observations enable row level security;
alter table public.anonymous_benchmark_network enable row level security;
alter table public.community_pattern_signals enable row level security;
alter table public.public_creator_profiles enable row level security;

drop policy if exists "Service role manages global cohorts" on public.global_pattern_cohorts;
create policy "Service role manages global cohorts"
  on public.global_pattern_cohorts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages global observations" on public.global_pattern_observations;
create policy "Service role manages global observations"
  on public.global_pattern_observations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages benchmark network" on public.anonymous_benchmark_network;
create policy "Service role manages benchmark network"
  on public.anonymous_benchmark_network for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages community pattern signals" on public.community_pattern_signals;
create policy "Service role manages community pattern signals"
  on public.community_pattern_signals for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Users read own public profile" on public.public_creator_profiles;
create policy "Users read own public profile"
  on public.public_creator_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Public enabled creator profiles are readable" on public.public_creator_profiles;
create policy "Public enabled creator profiles are readable"
  on public.public_creator_profiles for select
  using (enabled = true);

drop policy if exists "Service role manages public creator profiles" on public.public_creator_profiles;
create policy "Service role manages public creator profiles"
  on public.public_creator_profiles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
