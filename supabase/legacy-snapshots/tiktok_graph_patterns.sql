-- TikTok Graph: structured content intelligence layer.
-- Stores internal Viralynz signals only. It must not store invented TikTok analytics.

create table if not exists public.video_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  video_id text not null,
  niche text,
  format_type text,
  hook_type text,
  cta_type text,
  structured_signals jsonb not null default '{}'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  signal_quality integer not null default 0 check (signal_quality between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.benchmark_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_key text not null,
  niche text,
  format_type text,
  hook_type text,
  sample_size integer not null default 1,
  avg_score integer not null default 0 check (avg_score between 0 and 100),
  avg_hook_score integer not null default 0 check (avg_hook_score between 0 and 100),
  avg_retention_score integer not null default 0 check (avg_retention_score between 0 and 100),
  internal_observations jsonb not null default '[]'::jsonb,
  confidence numeric(4, 3) not null default 0.5,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.hook_types (
  id uuid primary key default gen_random_uuid(),
  hook_type text not null,
  hook_text text,
  niche text,
  format_type text,
  score integer not null default 0 check (score between 0 and 100),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.structure_types (
  id uuid primary key default gen_random_uuid(),
  structure_type text not null,
  niche text,
  format_type text,
  intro_duration numeric(6, 2),
  payoff_position numeric(6, 2),
  visual_density text,
  speech_speed text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.repost_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  pattern_key text not null,
  hook_type text,
  cta_type text,
  structure_json jsonb not null default '{}'::jsonb,
  source_signals jsonb not null default '{}'::jsonb,
  confidence numeric(4, 3) not null default 0.5,
  created_at timestamptz not null default now()
);

create table if not exists public.niche_patterns (
  id uuid primary key default gen_random_uuid(),
  niche text not null,
  pattern_key text not null,
  format_type text,
  hook_type text,
  observations jsonb not null default '[]'::jsonb,
  sample_size integer not null default 1,
  confidence numeric(4, 3) not null default 0.5,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists video_signals_user_video_key on public.video_signals(user_id, video_id);
create unique index if not exists benchmark_patterns_pattern_key_key on public.benchmark_patterns(pattern_key);
create unique index if not exists niche_patterns_niche_pattern_key on public.niche_patterns(niche, pattern_key);

create index if not exists video_signals_user_created_idx on public.video_signals(user_id, created_at desc);
create index if not exists video_signals_tags_gin_idx on public.video_signals using gin(tags);
create index if not exists video_signals_structured_gin_idx on public.video_signals using gin(structured_signals);
create index if not exists hook_types_lookup_idx on public.hook_types(hook_type, niche, format_type);
create index if not exists structure_types_lookup_idx on public.structure_types(structure_type, niche, format_type);
create index if not exists repost_patterns_lookup_idx on public.repost_patterns(pattern_key, created_at desc);

alter table public.video_signals enable row level security;
alter table public.benchmark_patterns enable row level security;
alter table public.hook_types enable row level security;
alter table public.structure_types enable row level security;
alter table public.repost_patterns enable row level security;
alter table public.niche_patterns enable row level security;

drop policy if exists "Service role full access" on public.video_signals;
create policy "Service role full access" on public.video_signals for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.benchmark_patterns;
create policy "Service role full access" on public.benchmark_patterns for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.hook_types;
create policy "Service role full access" on public.hook_types for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.structure_types;
create policy "Service role full access" on public.structure_types for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.repost_patterns;
create policy "Service role full access" on public.repost_patterns for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.niche_patterns;
create policy "Service role full access" on public.niche_patterns for all to service_role using (true) with check (true);
