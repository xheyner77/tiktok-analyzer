-- Proprietary Viralynz analysis engine tables.
-- Stores internal signals only. No invented TikTok analytics.

create table if not exists public.creator_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  pattern_type text not null check (pattern_type in ('hook', 'retention', 'cta', 'format', 'style', 'repost', 'risk')),
  label text not null,
  evidence text not null default '',
  confidence numeric(4, 3) not null default 0.5,
  source text not null default 'viralynz_engine',
  created_at timestamptz not null default now()
);

create table if not exists public.hook_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  hook_text text,
  hook_score integer not null default 0 check (hook_score between 0 and 100),
  hook_style text,
  payoff_timestamp text,
  evidence jsonb not null default '{}'::jsonb,
  confidence numeric(4, 3) not null default 0.5,
  created_at timestamptz not null default now()
);

create table if not exists public.repost_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  repost_json jsonb not null default '{}'::jsonb,
  source_signals jsonb not null default '{}'::jsonb,
  repost_score integer not null default 0 check (repost_score between 0 and 100),
  confidence numeric(4, 3) not null default 0.5,
  created_at timestamptz not null default now()
);

create table if not exists public.retention_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  timestamp text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  reason text not null,
  evidence text not null default '',
  confidence numeric(4, 3) not null default 0.5,
  source text not null default 'technical_pipeline',
  created_at timestamptz not null default now()
);

create table if not exists public.score_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  global_score integer not null default 0 check (global_score between 0 and 100),
  hook_score integer not null default 0 check (hook_score between 0 and 100),
  retention_score integer not null default 0 check (retention_score between 0 and 100),
  cta_score integer not null default 0 check (cta_score between 0 and 100),
  clarity_score integer not null default 0 check (clarity_score between 0 and 100),
  repost_potential integer not null default 0 check (repost_potential between 0 and 100),
  engine_version text,
  scoring_version text,
  prompt_version text,
  rules_version text,
  replay_key text,
  scoring_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.creator_stats (
  user_id uuid primary key references public.users(id) on delete cascade,
  analysis_count integer not null default 0,
  avg_score integer not null default 0,
  avg_hook_score integer not null default 0,
  avg_retention_score integer not null default 0,
  avg_cta_score integer not null default 0,
  recurring_patterns jsonb not null default '[]'::jsonb,
  style_evolution jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_technical_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  video_id text,
  technical_json jsonb not null default '{}'::jsonb,
  signal_quality integer not null default 0 check (signal_quality between 0 and 100),
  source text not null default 'browser_sampling',
  created_at timestamptz not null default now()
);

create index if not exists creator_patterns_user_created_idx on public.creator_patterns(user_id, created_at desc);
create index if not exists hook_history_user_created_idx on public.hook_history(user_id, created_at desc);
create index if not exists repost_history_user_created_idx on public.repost_history(user_id, created_at desc);
create index if not exists retention_signals_user_created_idx on public.retention_signals(user_id, created_at desc);
create index if not exists score_history_user_created_idx on public.score_history(user_id, created_at desc);
create index if not exists analysis_technical_signals_user_created_idx on public.analysis_technical_signals(user_id, created_at desc);

alter table public.creator_patterns enable row level security;
alter table public.hook_history enable row level security;
alter table public.repost_history enable row level security;
alter table public.retention_signals enable row level security;
alter table public.score_history enable row level security;
alter table public.creator_stats enable row level security;
alter table public.analysis_technical_signals enable row level security;

drop policy if exists "Service role full access" on public.creator_patterns;
create policy "Service role full access" on public.creator_patterns for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.hook_history;
create policy "Service role full access" on public.hook_history for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.repost_history;
create policy "Service role full access" on public.repost_history for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.retention_signals;
create policy "Service role full access" on public.retention_signals for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.score_history;
create policy "Service role full access" on public.score_history for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.creator_stats;
create policy "Service role full access" on public.creator_stats for all to service_role using (true) with check (true);

drop policy if exists "Service role full access" on public.analysis_technical_signals;
create policy "Service role full access" on public.analysis_technical_signals for all to service_role using (true) with check (true);
