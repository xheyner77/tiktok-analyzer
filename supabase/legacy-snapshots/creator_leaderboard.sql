create table if not exists public.creator_leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete cascade,
  scope text not null default 'creator' check (scope in ('creator', 'niche', 'team')),
  category text not null check (category in (
    'main',
    'top_progression_week',
    'best_repost_transformations',
    'most_improved_creator',
    'best_hook_rewrites',
    'strongest_retention_structures'
  )),
  niche text,
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  hook_quality integer not null default 0 check (hook_quality between 0 and 100),
  structure_quality integer not null default 0 check (structure_quality between 0 and 100),
  retention_signals integer not null default 0 check (retention_signals between 0 and 100),
  repost_improvement integer not null default 0 check (repost_improvement between 0 and 100),
  creator_progress integer not null default 0 check (creator_progress between 0 and 100),
  consistency integer not null default 0 check (consistency between 0 and 100),
  movement text not null default 'new' check (movement in ('up', 'down', 'stable', 'new')),
  evidence text,
  signal_weights jsonb not null default '{}'::jsonb,
  source_signals jsonb not null default '{}'::jsonb,
  engine_version text,
  scoring_version text,
  created_at timestamptz not null default now()
);

create index if not exists creator_leaderboard_entries_user_created_idx
  on public.creator_leaderboard_entries (user_id, created_at desc);

create index if not exists creator_leaderboard_entries_category_score_idx
  on public.creator_leaderboard_entries (category, quality_score desc, created_at desc);

create index if not exists creator_leaderboard_entries_niche_score_idx
  on public.creator_leaderboard_entries (niche, quality_score desc, created_at desc)
  where niche is not null;

create table if not exists public.creator_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  label text not null,
  score integer not null default 0 check (score between 0 and 100),
  unlocked boolean not null default false,
  evidence text,
  source_analysis_id uuid references public.analyses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

create index if not exists creator_badges_user_unlocked_idx
  on public.creator_badges (user_id, unlocked, updated_at desc);

create table if not exists public.team_leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_key text not null default 'default',
  account_label text not null,
  category text not null,
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  progression_score integer not null default 0 check (progression_score between 0 and 100),
  repost_score integer not null default 0 check (repost_score between 0 and 100),
  consistency_score integer not null default 0 check (consistency_score between 0 and 100),
  evidence text,
  source_signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists team_leaderboard_entries_team_score_idx
  on public.team_leaderboard_entries (team_key, quality_score desc, created_at desc);

alter table public.creator_leaderboard_entries enable row level security;
alter table public.creator_badges enable row level security;
alter table public.team_leaderboard_entries enable row level security;

drop policy if exists "Users can read their leaderboard entries" on public.creator_leaderboard_entries;
create policy "Users can read their leaderboard entries"
  on public.creator_leaderboard_entries
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their badges" on public.creator_badges;
create policy "Users can read their badges"
  on public.creator_badges
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their team leaderboard entries" on public.team_leaderboard_entries;
create policy "Users can read their team leaderboard entries"
  on public.team_leaderboard_entries
  for select
  using (auth.uid() = user_id);

drop policy if exists "Service role manages leaderboard entries" on public.creator_leaderboard_entries;
create policy "Service role manages leaderboard entries"
  on public.creator_leaderboard_entries
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages creator badges" on public.creator_badges;
create policy "Service role manages creator badges"
  on public.creator_badges
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages team leaderboard entries" on public.team_leaderboard_entries;
create policy "Service role manages team leaderboard entries"
  on public.team_leaderboard_entries
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
